try {
  // Allow the packaged launcher to load local environment overrides when present.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
} catch {
  // no-op
}

import http from "node:http";
import path from "node:path";
import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import {
  buildMicrosoftAuthUrl,
  createPkcePair,
  getMicrosoftRedirectUri,
  loginMicrosoftFromAuthorizationCode
} from "../../../packages/auth/src";
import { NoirLauncherService } from "../../../packages/core/src";
import { LauncherSettings } from "../../../packages/shared/src";
import { checkForElectronUpdates, setupElectronUpdater } from "../../../packages/updater/src";

let mainWindow: BrowserWindow | null = null;

const service = new NoirLauncherService({
  appVersion: app.getVersion(),
  configPath: path.resolve(process.cwd(), "launcher.config.json")
});

function emit(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1240,
    minHeight: 780,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#070707",
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
    await mainWindow.loadFile(path.resolve(process.cwd(), "dist/apps/desktop/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function emitSnapshot(): Promise<void> {
  emit("launcher:snapshot", await service.getSnapshot());
}

async function runMicrosoftLoginFlow(): Promise<void> {
  const redirectUri = getMicrosoftRedirectUri();
  const redirect = new URL(redirectUri);
  const listenHost = redirect.hostname || "127.0.0.1";
  const listenPort = Number(redirect.port || 80);
  const callbackPath = redirect.pathname || "/callback";
  const { verifier, challenge } = createPkcePair();
  const authUrl = buildMicrosoftAuthUrl(redirectUri, challenge);

  const codePromise = new Promise<string>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
        if (requestUrl.pathname === callbackPath && requestUrl.searchParams.get("code")) {
          const code = requestUrl.searchParams.get("code") || "";
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          response.end("<h1>Login concluido.</h1><p>Voce pode fechar esta janela.</p>");
          resolve(code);
          server.close();
          return;
        }
        response.writeHead(404);
        response.end("Nao encontrado");
      } catch (error) {
        response.writeHead(500);
        response.end("Erro no callback");
        reject(error);
      }
    });

    server.listen(listenPort, listenHost);
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timeout no login Microsoft"));
    }, 5 * 60_000);

    server.on("close", () => clearTimeout(timeout));
  });

  await service.logger.log("auth", "info", "Abrindo login Microsoft no navegador padrao");
  await shell.openExternal(authUrl);

  try {
    const code = await codePromise;
    const account = await loginMicrosoftFromAuthorizationCode(code, verifier, redirectUri, service.vault);
    await service.selectAccount(account.id);
    await service.logger.log("auth", "info", `Conta Microsoft adicionada`, { username: account.username });
    await emitSnapshot();
  } finally {
    // Browser externo; nada para fechar localmente.
  }
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
  void service.restoreSelectedSession().then(() => emitSnapshot());

  setupElectronUpdater(service.logger, (payload) => {
    emit("updater:status", payload);
  });

  const snapshot = await service.getSnapshot();
  if (snapshot.settings.autoUpdateModpack) {
    void service.syncModpack(async (payload) => emit("launcher:snapshot", payload.snapshot));
  }

  if (snapshot.settings.autoUpdateLauncher && app.isPackaged) {
    void checkForElectronUpdates();
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
