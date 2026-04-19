import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import {
  createDefaultMicrosoftAuthManager,
  loginMicrosoftInElectronPopup
} from "../../../packages/auth/src";
import { NoirLauncherService } from "../../../packages/core/src";
import { LauncherSettings } from "../../../packages/shared/src";
import { checkForElectronUpdates, setupElectronUpdater } from "../../../packages/updater/src";

const APP_ID = "com.noir.launcher";
const DEV_PROJECT_ROOT = path.resolve(__dirname, "../../../..");

let mainWindow: BrowserWindow | null = null;

function getPackagedAppRoot(): string {
  return path.join(process.resourcesPath, "app.asar");
}

function getRuntimeAppRoot(): string {
  return app.isPackaged ? getPackagedAppRoot() : DEV_PROJECT_ROOT;
}

function resolveFirstExistingPath(candidates: string[]): string {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function resolveConfigPath(): string {
  return resolveFirstExistingPath([
    path.join(process.resourcesPath, "config", "launcher.config.json"),
    path.join(getRuntimeAppRoot(), "launcher.config.json"),
    path.join(DEV_PROJECT_ROOT, "launcher.config.json")
  ]);
}

function resolveUiEntryPath(): string {
  return path.join(getRuntimeAppRoot(), "dist", "apps", "desktop", "index.html");
}

function resolveWindowIconPath(): string | undefined {
  const iconFileName = process.platform === "linux" ? "logo.png" : "logo.ico";
  const candidates = [
    path.join(process.resourcesPath, "branding", iconFileName),
    path.join(DEV_PROJECT_ROOT, "resources", "branding", iconFileName)
  ];
  const iconPath = candidates.find((candidate) => fs.existsSync(candidate));
  return iconPath;
}

function configureRuntimeEnvironment(): void {
  const envCandidates = [
    path.join(os.homedir(), ".noirlauncher", ".env"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(process.resourcesPath, ".env"),
    path.join(DEV_PROJECT_ROOT, ".env"),
    path.resolve(process.cwd(), ".env")
  ];

  const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
  if (envPath) {
    dotenv.config({ path: envPath, override: false });
  }
}

configureRuntimeEnvironment();

if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

const service = new NoirLauncherService({
  appVersion: app.getVersion(),
  configPath: resolveConfigPath()
});

function emit(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

async function createMainWindow(): Promise<void> {
  const iconPath = resolveWindowIconPath();
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1240,
    minHeight: 780,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#070707",
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(resolveUiEntryPath());
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function emitSnapshot(): Promise<void> {
  emit("launcher:snapshot", await service.getSnapshot());
}

async function runMicrosoftLoginFlow(): Promise<void> {
  const authManager = createDefaultMicrosoftAuthManager();

  authManager.on("load", (_code, message) => {
    void service.logger.log("auth", "info", message);
  });

  await service.logger.log("auth", "info", "Abrindo janela de login Microsoft");
  const account = await loginMicrosoftInElectronPopup(
    service.vault,
    {
      parent: mainWindow || undefined,
      modal: Boolean(mainWindow),
      backgroundColor: "#090806",
      titleBarStyle: "default"
    },
    authManager
  );
  await service.selectAccount(account.id);
  await service.logger.log("auth", "info", `Conta Microsoft adicionada`, { username: account.username });
  await emitSnapshot();
}

function runBackgroundTask(task: Promise<unknown>, category: "launcher" | "auth" | "install", label: string): void {
  void task.catch(async (error) => {
    const message = error instanceof Error ? error.message : label;
    await service.logger.log(category, "error", `${label}: ${message}`);
    await emitSnapshot();
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("launcher:get-snapshot", () => service.getSnapshot());
  ipcMain.handle("launcher:get-logs", () => service.getLogs());

  ipcMain.handle("settings:save", async (_event, settings: LauncherSettings) => {
    await service.saveSettings(settings);
    const snapshot = await service.getSnapshot();
    emit("launcher:snapshot", snapshot);
    return snapshot;
  });

  ipcMain.handle("accounts:offline", async (_event, username: string) => {
    await service.createOfflineAccount(username);
    const snapshot = await service.getSnapshot();
    emit("launcher:snapshot", snapshot);
    return snapshot;
  });

  ipcMain.handle("accounts:remove", async (_event, accountId: string) => {
    await service.removeAccount(accountId);
    const snapshot = await service.getSnapshot();
    emit("launcher:snapshot", snapshot);
    return snapshot;
  });

  ipcMain.handle("accounts:select", async (_event, accountId: string) => {
    await service.selectAccount(accountId);
    const snapshot = await service.getSnapshot();
    emit("launcher:snapshot", snapshot);
    return snapshot;
  });

  ipcMain.handle("auth:microsoft:start", async () => {
    await runMicrosoftLoginFlow();
    return service.getSnapshot();
  });

  ipcMain.handle("modpack:sync", async () => {
    const snapshot = await service.syncModpack(async (payload) => {
      emit("launcher:snapshot", payload.snapshot);
    });
    emit("launcher:snapshot", snapshot);
    return snapshot;
  });

  ipcMain.handle("minecraft:play", async (_event, accountId: string) => {
    await service.play(accountId, async (payload) => {
      emit("minecraft:status", payload);
      await emitSnapshot();
    });
  });

  ipcMain.handle("system:open-instance-folder", () => shell.openPath(service.getPaths().instanceRoot));
  ipcMain.handle("system:open-logs-folder", () => shell.openPath(service.getPaths().logsDir));

  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await service.initialize();
  await createMainWindow();
  registerIpcHandlers();
  await emitSnapshot();
  runBackgroundTask(
    service.restoreSelectedSession().then(() => emitSnapshot()),
    "auth",
    "Falha ao restaurar sessao"
  );

  setupElectronUpdater(service.logger, (payload) => {
    emit("updater:status", payload);
  });

  const snapshot = await service.getSnapshot();
  if (snapshot.settings.autoUpdateModpack) {
    runBackgroundTask(
      service.syncModpack(async (payload) => emit("launcher:snapshot", payload.snapshot)),
      "install",
      "Falha na sincronizacao automatica do modpack"
    );
  }

  if (snapshot.settings.autoUpdateLauncher && app.isPackaged) {
    runBackgroundTask(checkForElectronUpdates(), "launcher", "Falha ao verificar updates do launcher");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
    await emitSnapshot();
  }
});
