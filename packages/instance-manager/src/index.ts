import fs from "fs-extra";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  AccountsStore,
  createDefaultAccountsStore,
  createDefaultInstallState,
  createDefaultInstanceMetadata,
  createDefaultSettings,
  InstallState,
  InstanceMetadata,
  LauncherConfig,
  LauncherSettings,
  ModpackLock,
  parseAccountsStore,
  parseInstallState,
  parseInstanceMetadata,
  parseLauncherConfig,
  parseLauncherSettings,
  parseModpackLock
} from "../../shared/src";

export type LauncherPaths = {
  rootDir: string;
  cacheDir: string;
  accountsDir: string;
  accountsFilePath: string;
  settingsPath: string;
  launcherLogPath: string;
  authLogPath: string;
  installLogPath: string;
  instanceRoot: string;
  gameDir: string;
  modsDir: string;
  configDir: string;
  resourcepacksDir: string;
  shaderpacksDir: string;
  savesDir: string;
  logsDir: string;
  minecraftLogPath: string;
  librariesDir: string;
  assetsDir: string;
  runtimeDir: string;
  nativesDir: string;
  metadataDir: string;
  instanceMetadataPath: string;
  modpackLockPath: string;
  installStatePath: string;
};

async function writeJsonSafely(filePath: string, value: unknown): Promise<void> {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
  );
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(tempPath, value, { spaces: 2 });
  await fs.move(tempPath, filePath, { overwrite: true });
}

async function recoverCorruptedJson<T>(filePath: string, fallback: T): Promise<T> {
  const corruptedPath = `${filePath}.corrupted-${Date.now()}.json`;
  try {
    if (await fs.pathExists(filePath)) {
      await fs.move(filePath, corruptedPath, { overwrite: true });
    }
  } catch {
    // Ignore recovery rename failure and overwrite the file with the fallback.
  }
  await writeJsonSafely(filePath, fallback);
  return fallback;
}

export function getLauncherPaths(): LauncherPaths {
  const rootDir = path.join(os.homedir(), ".noirlauncher");
  const instanceRoot = path.join(rootDir, "noir-smp");
  const metadataDir = path.join(instanceRoot, "metadata");
  return {
    rootDir,
    cacheDir: path.join(rootDir, "cache"),
    accountsDir: path.join(rootDir, "accounts"),
    accountsFilePath: path.join(rootDir, "accounts", "accounts.json"),
    settingsPath: path.join(rootDir, "settings.json"),
    launcherLogPath: path.join(rootDir, "launcher.log"),
    authLogPath: path.join(rootDir, "auth.log"),
    installLogPath: path.join(rootDir, "install.log"),
    instanceRoot,
    gameDir: path.join(instanceRoot, "game"),
    modsDir: path.join(instanceRoot, "mods"),
    configDir: path.join(instanceRoot, "config"),
    resourcepacksDir: path.join(instanceRoot, "resourcepacks"),
    shaderpacksDir: path.join(instanceRoot, "shaderpacks"),
    savesDir: path.join(instanceRoot, "saves"),
    logsDir: path.join(instanceRoot, "logs"),
    minecraftLogPath: path.join(instanceRoot, "logs", "latest.log"),
    librariesDir: path.join(instanceRoot, "libraries"),
    assetsDir: path.join(instanceRoot, "assets"),
    runtimeDir: path.join(instanceRoot, "runtime"),
    nativesDir: path.join(instanceRoot, "natives"),
    metadataDir,
    instanceMetadataPath: path.join(metadataDir, "instance.json"),
    modpackLockPath: path.join(metadataDir, "modpack-lock.json"),
    installStatePath: path.join(metadataDir, "install-state.json")
  };
}

async function ensureDirectoryLink(linkPath: string, targetPath: string): Promise<void> {
  await fs.ensureDir(targetPath);
  if (await fs.pathExists(linkPath)) {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink()) {
      return;
    }
    if (stat.isDirectory()) {
      const files = await fs.readdir(linkPath);
      if (files.length > 0) {
        return;
      }
    }
    await fs.remove(linkPath);
  }

  await fs.symlink(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
}

export async function ensureLauncherLayout(paths = getLauncherPaths()): Promise<LauncherPaths> {
  await fs.ensureDir(paths.rootDir);
  await fs.ensureDir(paths.cacheDir);
  await fs.ensureDir(paths.accountsDir);
  await fs.ensureDir(paths.instanceRoot);
  await fs.ensureDir(paths.gameDir);
  await fs.ensureDir(paths.modsDir);
  await fs.ensureDir(paths.configDir);
  await fs.ensureDir(paths.resourcepacksDir);
  await fs.ensureDir(paths.shaderpacksDir);
  await fs.ensureDir(paths.savesDir);
  await fs.ensureDir(paths.logsDir);
  await fs.ensureDir(paths.librariesDir);
  await fs.ensureDir(paths.assetsDir);
  await fs.ensureDir(paths.runtimeDir);
  await fs.ensureDir(paths.nativesDir);
  await fs.ensureDir(paths.metadataDir);

  await ensureDirectoryLink(path.join(paths.gameDir, "mods"), paths.modsDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "config"), paths.configDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "resourcepacks"), paths.resourcepacksDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "shaderpacks"), paths.shaderpacksDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "saves"), paths.savesDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "logs"), paths.logsDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "libraries"), paths.librariesDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "assets"), paths.assetsDir);
  await ensureDirectoryLink(path.join(paths.gameDir, "natives"), paths.nativesDir);

  return paths;
}

async function readJsonOrDefault<T>(filePath: string, fallback: T, parser: (value: unknown) => T): Promise<T> {
  if (!(await fs.pathExists(filePath))) {
    await writeJsonSafely(filePath, fallback);
    return fallback;
  }

  try {
    const raw = await fs.readJson(filePath);
    return parser(raw);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && /JSON|Unexpected end of JSON input|Unexpected token/.test(error.message))
    ) {
      return recoverCorruptedJson(filePath, fallback);
    }
    throw error;
  }
}

export async function loadLauncherConfigFile(configPath?: string): Promise<LauncherConfig> {
  const filePath = configPath || path.resolve(process.cwd(), "launcher.config.json");
  const raw = await fs.readJson(filePath);
  return parseLauncherConfig(raw);
}

export async function loadSettings(config: LauncherConfig, paths = getLauncherPaths()): Promise<LauncherSettings> {
  const fallback = createDefaultSettings(config, paths.instanceRoot);
  return readJsonOrDefault(paths.settingsPath, fallback, (raw) => parseLauncherSettings(raw, fallback));
}

export async function saveSettings(settings: LauncherSettings, paths = getLauncherPaths()): Promise<void> {
  await writeJsonSafely(paths.settingsPath, settings);
}

export async function loadAccountsStore(paths = getLauncherPaths()): Promise<AccountsStore> {
  const fallback = createDefaultAccountsStore();
  return readJsonOrDefault(paths.accountsFilePath, fallback, parseAccountsStore);
}

export async function saveAccountsStore(store: AccountsStore, paths = getLauncherPaths()): Promise<void> {
  await writeJsonSafely(paths.accountsFilePath, store);
}

export async function loadInstallState(paths = getLauncherPaths()): Promise<InstallState> {
  const fallback = createDefaultInstallState();
  return readJsonOrDefault(paths.installStatePath, fallback, parseInstallState);
}

export async function saveInstallState(state: InstallState, paths = getLauncherPaths()): Promise<void> {
  await writeJsonSafely(paths.installStatePath, state);
}

export async function loadInstanceMetadata(config: LauncherConfig, paths = getLauncherPaths()): Promise<InstanceMetadata> {
  const fallback = createDefaultInstanceMetadata(config);
  return readJsonOrDefault(paths.instanceMetadataPath, fallback, (raw) => parseInstanceMetadata(raw, fallback));
}

export async function saveInstanceMetadata(metadata: InstanceMetadata, paths = getLauncherPaths()): Promise<void> {
  await writeJsonSafely(paths.instanceMetadataPath, metadata);
}

export async function loadModpackLock(paths = getLauncherPaths()): Promise<ModpackLock | null> {
  if (!(await fs.pathExists(paths.modpackLockPath))) {
    return null;
  }
  try {
    const raw = await fs.readJson(paths.modpackLockPath);
    return parseModpackLock(raw);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && /JSON|Unexpected end of JSON input|Unexpected token/.test(error.message))
    ) {
      const corruptedPath = `${paths.modpackLockPath}.corrupted-${Date.now()}.json`;
      try {
        await fs.move(paths.modpackLockPath, corruptedPath, { overwrite: true });
      } catch {
        await fs.remove(paths.modpackLockPath);
      }
      return null;
    }
    throw error;
  }
}

export async function saveModpackLock(lock: ModpackLock, paths = getLauncherPaths()): Promise<void> {
  await writeJsonSafely(paths.modpackLockPath, lock);
}
