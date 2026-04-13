try {
  // Optional: allow running without dotenv installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {}
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import http from 'node:http';
import path from 'node:path';
import { loadAccounts, findAccount, removeAccount } from '../../auth-system/src/accounts';
import { loginOffline } from '../../auth-system/src/offline';
import {
  startDeviceCodeFlow,
  completeDeviceCodeFlow,
  buildAuthUrl,
  createPkcePair,
  exchangeCodeForTokens,
  completeMicrosoftLoginWithTokens
} from '../../auth-system/src/microsoft';
import { loadSettings, saveSettings } from '../../config-system/src/settings';
import { readLogs, log } from './logger';
import { syncNoirModpack } from '../../installer/src/modpack';
import { launchMinecraft } from '../../minecraft-runner/src/runner';
import { setupAutoUpdater, checkForUpdates } from '../../updater/src/autoUpdater';
import { ensureBaseDirs } from '../../config-system/src/paths';

let mainWindow: BrowserWindow | null = null;
let loginWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;
let modpackStatus = { status: 'Inicializando', version: '', fileName: '', ready: false };
let syncInProgress = false;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: false,
    fullscreenable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0b0b12',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    const appPath = app.getAppPath();
    await mainWindow.loadFile(path.join(appPath, 'launcher-ui', 'dist', 'index.html'));
  }
}

async function openLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }
  loginWindow = new BrowserWindow({
    width: 520,
    height: 720,
    resizable: false,
    fullscreen: false,
    fullscreenable: false,
    maximizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c0b0a',
    parent: mainWindow ?? undefined,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await loginWindow.loadURL(`${devUrl}?login=1`);
  } else {
    const appPath = app.getAppPath();
    await loginWindow.loadFile(path.join(appPath, 'launcher-ui', 'dist', 'index.html'), {
      query: { login: '1' }
    });
  }

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

async function openAuthWindow(url: string) {
  if (authWindow) {
    authWindow.focus();
    return;
  }
  authWindow = new BrowserWindow({
    width: 520,
    height: 720,
    resizable: false,
    fullscreen: false,
    fullscreenable: false,
    maximizable: false,
    frame: true,
    backgroundColor: '#0c0b0a',
    parent: loginWindow ?? mainWindow ?? undefined,
    webPreferences: {
      contextIsolation: true
    }
  });
  await authWindow.loadURL(url);
  authWindow.on('closed', () => {
    authWindow = null;
  });
}

const REDIRECT_URI =
  process.env.MS_REDIRECT_URI ||
  `http://${process.env.MS_REDIRECT_HOST || '127.0.0.1'}:${process.env.MS_REDIRECT_PORT || 53682}/callback`;

async function runMicrosoftInteractiveLogin() {
  const { verifier, challenge } = createPkcePair();
  const redirect = new URL(REDIRECT_URI);
  const listenHost = redirect.hostname || '127.0.0.1';
  const listenPort = Number(redirect.port || 80);
  const callbackPath = redirect.pathname || '/callback';

  const server = http.createServer();

  const codePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout do login Microsoft')), 5 * 60 * 1000);
    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        if (url.pathname === callbackPath && url.searchParams.get('code')) {
          const code = url.searchParams.get('code') || '';
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h2>Login concluido. Pode fechar esta janela.</h2>');
          clearTimeout(timeout);
          resolve(code);
        } else {
          res.writeHead(404);
          res.end();
        }
      } catch (err) {
        res.writeHead(500);
        res.end();
      }
    });
  });

  await new Promise<void>((resolve, reject) =>
    server.listen(listenPort, listenHost, (err?: any) => (err ? reject(err) : resolve()))
  );
  const authUrl = buildAuthUrl(REDIRECT_URI, challenge);

  await openAuthWindow(authUrl);

  let code = '';
  try {
    code = await codePromise;
  } finally {
    server.close();
    authWindow?.close();
    authWindow = null;
  }

  const tokens = await exchangeCodeForTokens(code, verifier, REDIRECT_URI);
  return await completeMicrosoftLoginWithTokens(tokens.access_token, tokens.refresh_token);
}

async function runModpackSync() {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    modpackStatus = { ...modpackStatus, status: 'Verificando modpack...', ready: false };
    mainWindow?.webContents.send('modpack:progress', modpackStatus);
    const info = await syncNoirModpack((msg) => {
      const fileName =
        msg.startsWith('Baixando modpack:') ? msg.replace('Baixando modpack:', '').trim() : modpackStatus.fileName;
      modpackStatus = { ...modpackStatus, status: msg, fileName, ready: false };
      mainWindow?.webContents.send('modpack:progress', modpackStatus);
    });
    modpackStatus = {
      status: 'Pronto',
      version: info?.version || '',
      fileName: info?.fileName || '',
      ready: true
    };
    mainWindow?.webContents.send('modpack:progress', modpackStatus);
  } catch (err: any) {
    modpackStatus = {
      status: `Erro: ${err.message}`,
      version: modpackStatus.version,
      fileName: modpackStatus.fileName,
      ready: false
    };
    mainWindow?.webContents.send('modpack:progress', modpackStatus);
  } finally {
    syncInProgress = false;
  }
}

app.whenReady().then(async () => {
  await ensureBaseDirs();
  Menu.setApplicationMenu(null);
  setupAutoUpdater();
  await createWindow();
  const store = await loadAccounts();
  if (store.accounts.length === 0) {
    await openLoginWindow();
  }
  runModpackSync();
  if ((await loadSettings()).autoUpdate) {
    await checkForUpdates();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('accounts:get', async () => {
  const store = await loadAccounts();
  return store.accounts.map((a) => ({
    type: a.type,
    username: a.username,
    uuid: a.uuid,
    skin: a.type === 'microsoft' ? a.skin : ''
  }));
});

ipcMain.handle('accounts:offline', async (_event, username: string) => {
  await loginOffline(username);
  return true;
});

ipcMain.handle('accounts:remove', async (_event, uuid: string) => {
  await removeAccount(uuid);
  return true;
});

ipcMain.handle('accounts:microsoft:start', async () => {
  return await runMicrosoftInteractiveLogin();
});

ipcMain.handle('accounts:microsoft:complete', async () => {
  await completeDeviceCodeFlow();
  return true;
});

ipcMain.handle('login:open', async () => {
  await openLoginWindow();
  return true;
});

ipcMain.handle('login:close', async () => {
  loginWindow?.close();
  loginWindow = null;
  return true;
});

ipcMain.handle('settings:get', async () => {
  return await loadSettings();
});

ipcMain.handle('settings:save', async (_event, settings) => {
  await saveSettings(settings);
  return true;
});

ipcMain.handle('logs:get', async () => {
  return await readLogs();
});

ipcMain.handle('modpack:sync', async () => {
  await runModpackSync();
  return modpackStatus;
});

ipcMain.handle('modpack:status', async () => {
  return modpackStatus;
});

ipcMain.handle('minecraft:play', async (_event, accountUuid: string) => {
  try {
    const account = await findAccount(accountUuid);
    if (!account) throw new Error('Conta nao encontrada');
    const settings = await loadSettings();
    await launchMinecraft(account, settings);
    mainWindow?.webContents.send('minecraft:status', { state: 'started' });
    return true;
  } catch (err: any) {
    mainWindow?.webContents.send('minecraft:status', { state: 'error', message: err.message });
    throw err;
  }
});

ipcMain.handle('updates:check', async () => {
  await checkForUpdates();
  return true;
});

ipcMain.handle('app:version', async () => {
  return app.getVersion();
});
