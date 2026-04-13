import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("noir", {
  getSnapshot: () => ipcRenderer.invoke("launcher:get-snapshot"),
  getLogs: () => ipcRenderer.invoke("launcher:get-logs"),
  saveSettings: (settings: unknown) => ipcRenderer.invoke("settings:save", settings),
  syncModpack: () => ipcRenderer.invoke("modpack:sync"),
  play: (accountId: string) => ipcRenderer.invoke("minecraft:play", accountId),
  startMicrosoftLogin: () => ipcRenderer.invoke("auth:microsoft:start"),
  loginOffline: (username: string) => ipcRenderer.invoke("accounts:offline", username),
  removeAccount: (accountId: string) => ipcRenderer.invoke("accounts:remove", accountId),
  selectAccount: (accountId: string) => ipcRenderer.invoke("accounts:select", accountId),
  openInstanceFolder: () => ipcRenderer.invoke("system:open-instance-folder"),
  openLogsFolder: () => ipcRenderer.invoke("system:open-logs-folder"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  onSnapshot: (listener: (snapshot: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on("launcher:snapshot", handler);
    return () => ipcRenderer.removeListener("launcher:snapshot", handler);
  },
  onMinecraftStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on("minecraft:status", handler);
    return () => ipcRenderer.removeListener("minecraft:status", handler);
  },
  onUpdaterStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  }
});
