import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNumber,
  expectObject,
  expectOptionalString,
  expectString
} from "./validation";

export const MOD_LOADERS = ["forge", "fabric", "neoforge", "quilt"] as const;
export const UPDATE_CHANNELS = ["stable", "beta"] as const;
export const LOG_LEVELS = ["info", "warn", "error"] as const;
export const LOG_CATEGORIES = ["launcher", "auth", "install", "minecraft"] as const;

export type ModLoader = (typeof MOD_LOADERS)[number];
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogCategory = (typeof LOG_CATEGORIES)[number];

export type BrandingConfig = {
  applicationName: string;
  productName: string;
  shortName: string;
  tagline: string;
  accent: string;
  background: string;
};

export type LauncherConfig = {
  modpackName: string;
  curseforgeProjectId: number;
  preferredFileId?: number;
  minecraftVersion: string;
  modLoader: ModLoader;
  modLoaderVersion: string;
  minimumRamMb: number;
  recommendedRamMb: number;
  javaVersionRequired: number;
  serverAddress?: string;
  branding: BrandingConfig;
};

export type LauncherSettings = {
  minimumRamMb: number;
  maximumRamMb: number;
  resolutionWidth: number;
  resolutionHeight: number;
  fullscreen: boolean;
  minimizeOnGameLaunch: boolean;
  javaPath: string;
  instanceDirectory: string;
  autoUpdateLauncher: boolean;
  autoUpdateModpack: boolean;
  updateChannel: UpdateChannel;
  telemetryEnabled: boolean;
};

export type StoredMicrosoftAccount = {
  id: string;
  type: "microsoft";
  username: string;
  uuid: string;
  accessToken: string;
  clientToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenKey: string;
  xuid?: string;
  isDemo?: boolean;
  avatarUrl?: string;
  lastValidatedAt?: string;
  createdAt: string;
};

export type StoredOfflineAccount = {
  id: string;
  type: "offline";
  username: string;
  uuid: string;
  avatarUrl?: string;
  createdAt: string;
};

export type StoredAccount = StoredMicrosoftAccount | StoredOfflineAccount;

export type AccountsStore = {
  selectedAccountId?: string;
  accounts: StoredAccount[];
};

export type AccountSummary = {
  id: string;
  type: "microsoft" | "offline";
  username: string;
  uuid: string;
  avatarUrl?: string;
  lastValidatedAt?: string;
  hasRefreshToken: boolean;
};

export type ModpackLockEntry = {
  projectId: number;
  fileId: number;
  required: boolean;
  fileName?: string;
  sha1?: string;
};

export type ModpackLock = {
  projectId: number;
  fileId: number;
  fileName: string;
  versionLabel: string;
  minecraftVersion: string;
  modLoader: ModLoader;
  modLoaderVersion: string;
  generatedAt: string;
  files: ModpackLockEntry[];
};

export type InstallState = {
  state: "idle" | "syncing" | "ready" | "launching" | "error";
  message: string;
  progress: number;
  totalPlayedMs: number;
  currentStep?: string;
  installedFileId?: number;
  launcherUpdatedAt?: string;
  lastSyncedAt?: string;
  lastPlayedAt?: string;
  errorMessage?: string;
};

export type InstanceMetadata = {
  instanceName: string;
  modpackName: string;
  minecraftVersion: string;
  modLoader: ModLoader;
  modLoaderVersion: string;
  javaVersionRequired: number;
  installedProjectId?: number;
  installedFileId?: number;
  installedVersionLabel?: string;
  serverAddress?: string;
};

export type LauncherLogEntry = {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, unknown>;
};

export type LauncherSnapshot = {
  launcherVersion: string;
  config: LauncherConfig;
  settings: LauncherSettings;
  installState: InstallState;
  instance: InstanceMetadata;
  accounts: AccountSummary[];
  devOfflineAvailable: boolean;
};

export function parseLauncherConfig(input: unknown): LauncherConfig {
  const object = expectObject(input, "launcher.config.json");
  const branding = expectObject(object.branding, "branding");

  return {
    modpackName: expectString(object.modpackName, "modpackName"),
    curseforgeProjectId: expectNumber(object.curseforgeProjectId, "curseforgeProjectId"),
    preferredFileId: object.preferredFileId === undefined ? undefined : expectNumber(object.preferredFileId, "preferredFileId"),
    minecraftVersion: expectString(object.minecraftVersion, "minecraftVersion"),
    modLoader: expectEnum(object.modLoader, "modLoader", MOD_LOADERS),
    modLoaderVersion: expectString(object.modLoaderVersion, "modLoaderVersion"),
    minimumRamMb: expectNumber(object.minimumRamMb, "minimumRamMb"),
    recommendedRamMb: expectNumber(object.recommendedRamMb, "recommendedRamMb"),
    javaVersionRequired: expectNumber(object.javaVersionRequired, "javaVersionRequired"),
    serverAddress: expectOptionalString(object.serverAddress, "serverAddress"),
    branding: {
      applicationName: expectString(branding.applicationName, "branding.applicationName"),
      productName: expectString(branding.productName, "branding.productName"),
      shortName: expectString(branding.shortName, "branding.shortName"),
      tagline: expectString(branding.tagline, "branding.tagline"),
      accent: expectString(branding.accent, "branding.accent"),
      background: expectString(branding.background, "branding.background")
    }
  };
}

export function createDefaultSettings(config: LauncherConfig, instanceDirectory: string): LauncherSettings {
  const defaultMaximumRamMb = Math.max(
    config.minimumRamMb,
    Math.min(config.recommendedRamMb, 4096)
  );

  return {
    minimumRamMb: config.minimumRamMb,
    maximumRamMb: defaultMaximumRamMb,
    resolutionWidth: 1600,
    resolutionHeight: 900,
    fullscreen: false,
    minimizeOnGameLaunch: true,
    javaPath: "",
    instanceDirectory,
    autoUpdateLauncher: true,
    autoUpdateModpack: true,
    updateChannel: "stable",
    telemetryEnabled: false
  };
}

export function parseLauncherSettings(input: unknown, fallback: LauncherSettings): LauncherSettings {
  const object = expectObject(input, "settings.json");
  return {
    minimumRamMb: object.minimumRamMb === undefined ? fallback.minimumRamMb : expectNumber(object.minimumRamMb, "minimumRamMb"),
    maximumRamMb: object.maximumRamMb === undefined ? fallback.maximumRamMb : expectNumber(object.maximumRamMb, "maximumRamMb"),
    resolutionWidth: object.resolutionWidth === undefined ? fallback.resolutionWidth : expectNumber(object.resolutionWidth, "resolutionWidth"),
    resolutionHeight:
      object.resolutionHeight === undefined ? fallback.resolutionHeight : expectNumber(object.resolutionHeight, "resolutionHeight"),
    fullscreen: object.fullscreen === undefined ? fallback.fullscreen : expectBoolean(object.fullscreen, "fullscreen"),
    minimizeOnGameLaunch:
      object.minimizeOnGameLaunch === undefined
        ? fallback.minimizeOnGameLaunch
        : expectBoolean(object.minimizeOnGameLaunch, "minimizeOnGameLaunch"),
    javaPath: typeof object.javaPath === "string" ? object.javaPath : fallback.javaPath,
    instanceDirectory:
      typeof object.instanceDirectory === "string" && object.instanceDirectory.length > 0
        ? object.instanceDirectory
        : fallback.instanceDirectory,
    autoUpdateLauncher:
      object.autoUpdateLauncher === undefined ? fallback.autoUpdateLauncher : expectBoolean(object.autoUpdateLauncher, "autoUpdateLauncher"),
    autoUpdateModpack:
      object.autoUpdateModpack === undefined ? fallback.autoUpdateModpack : expectBoolean(object.autoUpdateModpack, "autoUpdateModpack"),
    updateChannel:
      object.updateChannel === undefined ? fallback.updateChannel : expectEnum(object.updateChannel, "updateChannel", UPDATE_CHANNELS),
    telemetryEnabled:
      object.telemetryEnabled === undefined ? fallback.telemetryEnabled : expectBoolean(object.telemetryEnabled, "telemetryEnabled")
  };
}

export function createDefaultAccountsStore(): AccountsStore {
  return { accounts: [] };
}

export function parseAccountsStore(input: unknown): AccountsStore {
  const object = expectObject(input, "accounts");
  const accounts = expectArray(object.accounts, "accounts.accounts").map(parseStoredAccount);
  const selectedAccountId = expectOptionalString(object.selectedAccountId, "selectedAccountId");
  return {
    selectedAccountId,
    accounts
  };
}

export function parseStoredAccount(input: unknown): StoredAccount {
  const object = expectObject(input, "account");
  const type = expectEnum(object.type, "account.type", ["microsoft", "offline"] as const);
  const base = {
    id: expectString(object.id, "account.id"),
    username: expectString(object.username, "account.username"),
    uuid: expectString(object.uuid, "account.uuid"),
    avatarUrl: expectOptionalString(object.avatarUrl, "account.avatarUrl"),
    createdAt: expectString(object.createdAt, "account.createdAt")
  };

  if (type === "offline") {
    return {
      ...base,
      type
    };
  }

  return {
    ...base,
    type,
    accessToken: expectString(object.accessToken, "account.accessToken"),
    clientToken: expectOptionalString(object.clientToken, "account.clientToken"),
    accessTokenExpiresAt: expectOptionalString(object.accessTokenExpiresAt, "account.accessTokenExpiresAt"),
    refreshTokenKey: expectString(object.refreshTokenKey, "account.refreshTokenKey"),
    xuid: expectOptionalString(object.xuid, "account.xuid"),
    isDemo: object.isDemo === undefined ? undefined : expectBoolean(object.isDemo, "account.isDemo"),
    lastValidatedAt: expectOptionalString(object.lastValidatedAt, "account.lastValidatedAt")
  };
}

export function toAccountSummary(account: StoredAccount, hasRefreshToken: boolean): AccountSummary {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    uuid: account.uuid,
    avatarUrl: account.avatarUrl,
    lastValidatedAt: account.type === "microsoft" ? account.lastValidatedAt : undefined,
    hasRefreshToken
  };
}

export function createDefaultInstallState(): InstallState {
  return {
    state: "idle",
    message: "Aguardando verificacao inicial",
    progress: 0,
    totalPlayedMs: 0
  };
}

export function parseInstallState(input: unknown): InstallState {
  const object = expectObject(input, "install-state.json");
  return {
    state: expectEnum(object.state, "installState.state", ["idle", "syncing", "ready", "launching", "error"] as const),
    message: expectString(object.message, "installState.message"),
    progress: expectNumber(object.progress, "installState.progress"),
    totalPlayedMs: object.totalPlayedMs === undefined ? 0 : expectNumber(object.totalPlayedMs, "installState.totalPlayedMs"),
    currentStep: expectOptionalString(object.currentStep, "installState.currentStep"),
    installedFileId: object.installedFileId === undefined ? undefined : expectNumber(object.installedFileId, "installState.installedFileId"),
    launcherUpdatedAt: expectOptionalString(object.launcherUpdatedAt, "installState.launcherUpdatedAt"),
    lastSyncedAt: expectOptionalString(object.lastSyncedAt, "installState.lastSyncedAt"),
    lastPlayedAt: expectOptionalString(object.lastPlayedAt, "installState.lastPlayedAt"),
    errorMessage: expectOptionalString(object.errorMessage, "installState.errorMessage")
  };
}

export function createDefaultInstanceMetadata(config: LauncherConfig): InstanceMetadata {
  return {
    instanceName: "noir-smp",
    modpackName: config.modpackName,
    minecraftVersion: config.minecraftVersion,
    modLoader: config.modLoader,
    modLoaderVersion: config.modLoaderVersion,
    javaVersionRequired: config.javaVersionRequired,
    serverAddress: config.serverAddress
  };
}

export function parseInstanceMetadata(input: unknown, fallback: InstanceMetadata): InstanceMetadata {
  const object = expectObject(input, "instance.json");
  return {
    instanceName: object.instanceName === undefined ? fallback.instanceName : expectString(object.instanceName, "instanceName"),
    modpackName: object.modpackName === undefined ? fallback.modpackName : expectString(object.modpackName, "modpackName"),
    minecraftVersion:
      object.minecraftVersion === undefined ? fallback.minecraftVersion : expectString(object.minecraftVersion, "minecraftVersion"),
    modLoader: object.modLoader === undefined ? fallback.modLoader : expectEnum(object.modLoader, "modLoader", MOD_LOADERS),
    modLoaderVersion:
      object.modLoaderVersion === undefined ? fallback.modLoaderVersion : expectString(object.modLoaderVersion, "modLoaderVersion"),
    javaVersionRequired:
      object.javaVersionRequired === undefined ? fallback.javaVersionRequired : expectNumber(object.javaVersionRequired, "javaVersionRequired"),
    installedProjectId:
      object.installedProjectId === undefined ? fallback.installedProjectId : expectNumber(object.installedProjectId, "installedProjectId"),
    installedFileId: object.installedFileId === undefined ? fallback.installedFileId : expectNumber(object.installedFileId, "installedFileId"),
    installedVersionLabel:
      object.installedVersionLabel === undefined ? fallback.installedVersionLabel : expectString(object.installedVersionLabel, "installedVersionLabel"),
    serverAddress: object.serverAddress === undefined ? fallback.serverAddress : expectOptionalString(object.serverAddress, "serverAddress")
  };
}

export function parseModpackLock(input: unknown): ModpackLock {
  const object = expectObject(input, "modpack-lock.json");
  const files = expectArray(object.files, "modpackLock.files").map((entry) => {
    const file = expectObject(entry, "modpackLock.file");
    return {
      projectId: expectNumber(file.projectId, "modpackLock.file.projectId"),
      fileId: expectNumber(file.fileId, "modpackLock.file.fileId"),
      required: expectBoolean(file.required, "modpackLock.file.required"),
      fileName: expectOptionalString(file.fileName, "modpackLock.file.fileName"),
      sha1: expectOptionalString(file.sha1, "modpackLock.file.sha1")
    };
  });

  return {
    projectId: expectNumber(object.projectId, "modpackLock.projectId"),
    fileId: expectNumber(object.fileId, "modpackLock.fileId"),
    fileName: expectString(object.fileName, "modpackLock.fileName"),
    versionLabel: expectString(object.versionLabel, "modpackLock.versionLabel"),
    minecraftVersion: expectString(object.minecraftVersion, "modpackLock.minecraftVersion"),
    modLoader: expectEnum(object.modLoader, "modpackLock.modLoader", MOD_LOADERS),
    modLoaderVersion: expectString(object.modLoaderVersion, "modpackLock.modLoaderVersion"),
    generatedAt: expectString(object.generatedAt, "modpackLock.generatedAt"),
    files
  };
}

export function serializeLogEntry(entry: LauncherLogEntry): string {
  return JSON.stringify(entry);
}

export function parseLogEntry(line: string): LauncherLogEntry {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  return {
    timestamp: expectString(parsed.timestamp, "log.timestamp"),
    level: expectEnum(parsed.level, "log.level", LOG_LEVELS),
    category: expectEnum(parsed.category, "log.category", LOG_CATEGORIES),
    message: expectString(parsed.message, "log.message"),
    context: typeof parsed.context === "object" && parsed.context !== null ? (parsed.context as Record<string, unknown>) : undefined
  };
}
