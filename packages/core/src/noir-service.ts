import {
  createOfflineDevAccount,
  findStoredAccount,
  getSelectedStoredAccount,
  isAccessTokenExpired,
  isDevOfflineEnabled,
  listAccountSummaries,
  refreshMicrosoftAccount,
  removeStoredAccount,
  saveSelectedAccount,
  SecretVault
} from "../../auth/src";
import os from "node:os";
import {
  ensureLauncherLayout,
  getLauncherPaths,
  LauncherPaths,
  loadInstallState,
  loadInstanceMetadata,
  loadLauncherConfigFile,
  loadSettings,
  saveInstallState,
  saveSettings
} from "../../instance-manager/src";
import {
  InstallState,
  LauncherConfig,
  LauncherSettings,
  LauncherSnapshot
} from "../../shared/src";
import { launchMinecraftInstance, syncSingleModpack } from "../../launcher-runtime/src";
import { FileLogger } from "./logger";

export type ServiceOptions = {
  appVersion: string;
  configPath?: string;
};

function getSafeMaximumRamMb(minimumRamMb: number): number {
  const totalRamMb = Math.floor(os.totalmem() / 1024 / 1024);
  const ratio = process.platform === "win32" ? 0.5 : 0.65;
  const systemBudgetMb = Math.floor(totalRamMb * ratio);
  return Math.max(minimumRamMb, Math.min(8192, systemBudgetMb));
}

function sanitizeSettings(settings: LauncherSettings): LauncherSettings {
  const requestedMinimumRamMb = Number.isFinite(settings.minimumRamMb) ? settings.minimumRamMb : 2048;
  const requestedMaximumRamMb = Number.isFinite(settings.maximumRamMb) ? settings.maximumRamMb : requestedMinimumRamMb;
  const minimumRamMb = Math.max(2048, Math.round(requestedMinimumRamMb));
  const maximumRamMb = Math.max(
    minimumRamMb,
    Math.min(Math.round(requestedMaximumRamMb), getSafeMaximumRamMb(minimumRamMb))
  );
  return {
    ...settings,
    minimumRamMb,
    maximumRamMb,
    resolutionWidth: Math.max(854, settings.resolutionWidth),
    resolutionHeight: Math.max(480, settings.resolutionHeight)
  };
}

function areSettingsEqual(left: LauncherSettings, right: LauncherSettings): boolean {
  return (
    left.minimumRamMb === right.minimumRamMb &&
    left.maximumRamMb === right.maximumRamMb &&
    left.resolutionWidth === right.resolutionWidth &&
    left.resolutionHeight === right.resolutionHeight &&
    left.fullscreen === right.fullscreen &&
    left.minimizeOnGameLaunch === right.minimizeOnGameLaunch &&
    left.javaPath === right.javaPath &&
    left.instanceDirectory === right.instanceDirectory &&
    left.autoUpdateLauncher === right.autoUpdateLauncher &&
    left.autoUpdateModpack === right.autoUpdateModpack &&
    left.updateChannel === right.updateChannel &&
    left.telemetryEnabled === right.telemetryEnabled
  );
}

export class NoirLauncherService {
  private readonly options: ServiceOptions;
  private readonly paths: LauncherPaths;
  readonly logger: FileLogger;
  readonly vault: SecretVault;
  private config: LauncherConfig | null = null;
  private activeLaunch: Promise<void> | null = null;
  private activeSync: Promise<LauncherSnapshot> | null = null;

  constructor(options: ServiceOptions) {
    this.options = options;
    this.paths = getLauncherPaths();
    this.logger = new FileLogger(this.paths);
    this.vault = new SecretVault(this.paths);
  }

  getPaths(): LauncherPaths {
    return this.paths;
  }

  async initialize(): Promise<LauncherSnapshot> {
    await ensureLauncherLayout(this.paths);
    this.config = await loadLauncherConfigFile(this.options.configPath);
    await this.loadEffectiveSettings(this.config);
    await loadInstanceMetadata(this.config, this.paths);
    await loadInstallState(this.paths);
    await this.recoverInterruptedLaunchState();
    await this.logger.log("launcher", "info", "Launcher inicializado");
    return this.getSnapshot();
  }

  private async recoverInterruptedLaunchState(): Promise<void> {
    const installState = await loadInstallState(this.paths);
    if (installState.state !== "launching") {
      return;
    }

    const recoveredState: InstallState = {
      ...installState,
      state: installState.lastSyncedAt ? "ready" : "idle",
      message: installState.lastSyncedAt
        ? "Abertura anterior interrompida. Pronto para tentar novamente."
        : "Aguardando verificacao inicial",
      progress: installState.lastSyncedAt ? 100 : 0,
      currentStep: installState.lastSyncedAt ? "ready" : undefined,
      errorMessage: undefined
    };

    await saveInstallState(recoveredState, this.paths);
    await this.logger.log("launcher", "warn", "Estado de abertura interrompido foi recuperado", {
      previousMessage: installState.message
    });
  }

  async restoreSelectedSession(): Promise<void> {
    const account = await getSelectedStoredAccount();
    if (!account || account.type !== "microsoft") {
      return;
    }

    if (!isAccessTokenExpired(account)) {
      return;
    }

    try {
      await refreshMicrosoftAccount(account, this.vault);
      await this.logger.log("auth", "info", `Sessao restaurada para ${account.username}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao restaurar sessao";
      await this.logger.log("auth", "warn", message, { accountId: account.id });
    }
  }

  private async requireConfig(): Promise<LauncherConfig> {
    if (!this.config) {
      this.config = await loadLauncherConfigFile(this.options.configPath);
    }
    return this.config;
  }

  private async loadEffectiveSettings(config: LauncherConfig): Promise<LauncherSettings> {
    const settings = await loadSettings(config, this.paths);
    const sanitized = sanitizeSettings(settings);
    if (!areSettingsEqual(settings, sanitized)) {
      await saveSettings(sanitized, this.paths);
      await this.logger.log("launcher", "warn", "Configuracoes ajustadas para limites seguros", {
        requestedMinimumRamMb: settings.minimumRamMb,
        requestedMaximumRamMb: settings.maximumRamMb,
        minimumRamMb: sanitized.minimumRamMb,
        maximumRamMb: sanitized.maximumRamMb,
        totalSystemRamMb: Math.floor(os.totalmem() / 1024 / 1024)
      });
    }
    return sanitized;
  }

  async getSnapshot(): Promise<LauncherSnapshot> {
    const config = await this.requireConfig();
    const settings = await this.loadEffectiveSettings(config);
    const installState = await loadInstallState(this.paths);
    const instance = await loadInstanceMetadata(config, this.paths);
    const accounts = await listAccountSummaries(this.vault);
    return {
      launcherVersion: this.options.appVersion,
      config,
      settings,
      installState,
      instance,
      accounts,
      devOfflineAvailable: isDevOfflineEnabled()
    };
  }

  async getLogs() {
    return this.logger.readLogs();
  }

  async saveSettings(settings: LauncherSettings): Promise<LauncherSettings> {
    const sanitized = sanitizeSettings(settings);
    await saveSettings(sanitized, this.paths);
    await this.logger.log("launcher", "info", "Configuracoes salvas");
    return sanitized;
  }

  async removeAccount(accountId: string): Promise<void> {
    await removeStoredAccount(accountId, this.vault);
    await this.logger.log("auth", "info", "Conta removida", { accountId });
  }

  async createOfflineAccount(username: string) {
    const account = await createOfflineDevAccount(username);
    await saveSelectedAccount(account.id);
    await this.logger.log("auth", "info", "Conta offline criada", { username: account.username });
    return account;
  }

  async selectAccount(accountId: string): Promise<void> {
    await saveSelectedAccount(accountId);
  }

  async updateInstallState(patch: Partial<InstallState>): Promise<InstallState> {
    const current = await loadInstallState(this.paths);
    const next = { ...current, ...patch };
    await saveInstallState(next, this.paths);
    return next;
  }

  async syncModpack(
    onProgress?: (payload: { message: string; progress: number; step: string; snapshot: LauncherSnapshot }) => Promise<void> | void
  ): Promise<LauncherSnapshot> {
    if (this.activeSync) {
      return this.activeSync;
    }

    this.activeSync = (async () => {
      const config = await this.requireConfig();
      const currentState = await loadInstallState(this.paths);
      const startedState: InstallState = {
        ...currentState,
        state: "syncing",
        progress: 1,
        message: "Iniciando verificacao do modpack",
        currentStep: "bootstrap",
        errorMessage: undefined
      };
      await saveInstallState(startedState, this.paths);

      try {
        await syncSingleModpack({
          config,
          paths: this.paths,
          logger: this.logger,
          onProgress: async ({ message, progress, step }) => {
            const state = await this.updateInstallState({
              state: progress >= 100 ? "ready" : "syncing",
              message,
              progress,
              currentStep: step,
              lastSyncedAt: progress >= 100 ? new Date().toISOString() : undefined,
              errorMessage: undefined
            });
            const snapshot = await this.getSnapshot();
            await onProgress?.({ message: state.message, progress: state.progress, step: state.currentStep || step, snapshot });
          }
        });
        return this.getSnapshot();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao sincronizar modpack";
        await this.updateInstallState({
          state: "error",
          progress: 100,
          message,
          errorMessage: message
        });
        await this.logger.log("install", "error", message);
        throw error;
      } finally {
        this.activeSync = null;
      }
    })();

    return this.activeSync;
  }

  async play(
    accountId: string,
    onStatus?: (payload: { state: "started" | "exited" | "error"; message: string; durationMs?: number }) => Promise<void> | void
  ): Promise<void> {
    if (this.activeSync) {
      throw new Error("Aguarde a sincronizacao do modpack terminar");
    }
    if (this.activeLaunch) {
      throw new Error("Ja existe uma instancia do Minecraft em execucao");
    }

    const config = await this.requireConfig();
    const account = await findStoredAccount(accountId);
    if (!account) {
      throw new Error("Conta nao encontrada");
    }

    const settings = await this.loadEffectiveSettings(config);
    const instance = await loadInstanceMetadata(config, this.paths);
    await saveSelectedAccount(account.id);
    await this.updateInstallState({
      state: "launching",
      progress: 100,
      message: "Preparando inicializacao do Minecraft",
      currentStep: "launch"
    });

    this.activeLaunch = launchMinecraftInstance({
      account,
      settings,
      instance,
      paths: this.paths,
      logger: this.logger,
      onStatus: async (payload) => {
        if (payload.state === "started") {
          await this.updateInstallState({
            state: "launching",
            message: "Minecraft em execucao",
            progress: 100,
            currentStep: "running",
            errorMessage: undefined
          });
        }
        if (payload.state === "exited") {
          const currentState = await loadInstallState(this.paths);
          await this.updateInstallState({
            state: "ready",
            message: payload.message,
            progress: 100,
            totalPlayedMs: currentState.totalPlayedMs + (payload.durationMs || 0),
            lastPlayedAt: new Date().toISOString(),
            currentStep: "ready",
            errorMessage: undefined
          });
        }
        if (payload.state === "error") {
          await this.updateInstallState({
            state: "error",
            message: payload.message,
            progress: 100,
            errorMessage: payload.message
          });
        }
        await onStatus?.(payload);
      }
    })
      .catch(() => undefined)
      .finally(() => {
        this.activeLaunch = null;
      });
  }
}
