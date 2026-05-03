import type { LauncherLogEntry, LauncherSettings, LauncherSnapshot } from "@noir-shared/index";

type Listener<T> = (payload: T) => void;

export type DesktopBridge = {
  getSnapshot(): Promise<LauncherSnapshot>;
  getLogs(): Promise<LauncherLogEntry[]>;
  saveSettings(settings: LauncherSettings): Promise<LauncherSnapshot>;
  syncModpack(): Promise<LauncherSnapshot>;
  play(accountId: string): Promise<void>;
  startMicrosoftLogin(): Promise<LauncherSnapshot>;
  loginOffline(username: string): Promise<LauncherSnapshot>;
  removeAccount(accountId: string): Promise<LauncherSnapshot>;
  selectAccount(accountId: string): Promise<LauncherSnapshot>;
  openInstanceFolder(): Promise<void>;
  openLogsFolder(): Promise<void>;
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  onSnapshot(listener: Listener<LauncherSnapshot>): () => void;
  onMinecraftStatus(listener: Listener<{ state: "started" | "exited" | "error"; message: string; durationMs?: number }>): () => void;
  onUpdaterStatus(listener: Listener<{ state: string; message: string }>): () => void;
};

const mockSnapshot: LauncherSnapshot = {
  launcherVersion: "0.2.0-dev",
  config: {
    modpackName: "NOIR SMP",
    curseforgeProjectId: 1483856,
    minecraftVersion: "1.20.1",
    modLoader: "forge",
    modLoaderVersion: "47.2.0",
    minimumRamMb: 4096,
    recommendedRamMb: 6144,
    javaVersionRequired: 17,
    serverAddress: "play.noir-smp.example",
    branding: {
      applicationName: "NOIR Launcher",
      productName: "NOIR SMP",
      shortName: "NOIR",
      tagline: "Nucleo de operações e investigações de rupturas.",
      accent: "#C9A24E",
      background: "#0A0A0A"
    }
  },
  settings: {
    minimumRamMb: 4096,
    maximumRamMb: 4096,
    resolutionWidth: 1600,
    resolutionHeight: 900,
    fullscreen: false,
    minimizeOnGameLaunch: true,
    javaPath: "",
    instanceDirectory: "~/.noirlauncher/noir-smp",
    autoUpdateLauncher: true,
    autoUpdateModpack: true,
    updateChannel: "stable",
    telemetryEnabled: false
  },
  installState: {
    state: "ready",
    message: "Preview da UI em modo navegador",
    progress: 100,
    totalPlayedMs: 0,
    currentStep: "ready",
    lastSyncedAt: new Date().toISOString()
  },
  instance: {
    instanceName: "noir-smp",
    modpackName: "NOIR SMP",
    minecraftVersion: "1.20.1",
    modLoader: "forge",
    modLoaderVersion: "47.2.0",
    javaVersionRequired: 17,
    installedProjectId: 1483856,
    installedFileId: 0,
    installedVersionLabel: "UI preview",
    serverAddress: "play.noir-smp.example"
  },
  accounts: [],
  devOfflineAvailable: true
};

const noop = () => undefined;

const fallbackBridge: DesktopBridge = {
  async getSnapshot() {
    return mockSnapshot;
  },
  async getLogs() {
    return [
      {
        timestamp: new Date().toISOString(),
        category: "launcher",
        level: "info",
        message: "Bridge mock ativa para desenvolvimento da interface."
      }
    ];
  },
  async saveSettings() {
    return mockSnapshot;
  },
  async syncModpack() {
    return mockSnapshot;
  },
  async play() {
    return;
  },
  async startMicrosoftLogin() {
    return mockSnapshot;
  },
  async loginOffline() {
    return mockSnapshot;
  },
  async removeAccount() {
    return mockSnapshot;
  },
  async selectAccount() {
    return mockSnapshot;
  },
  async openInstanceFolder() {
    return;
  },
  async openLogsFolder() {
    return;
  },
  async minimizeWindow() {
    return;
  },
  async closeWindow() {
    return;
  },
  onSnapshot() {
    return noop;
  },
  onMinecraftStatus() {
    return noop;
  },
  onUpdaterStatus() {
    return noop;
  }
};

export function getDesktopBridge(): DesktopBridge {
  return window.noir || fallbackBridge;
}
