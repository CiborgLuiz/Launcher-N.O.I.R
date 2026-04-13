import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('noir', {
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  loginOffline: (username: string) => ipcRenderer.invoke('accounts:offline', username),
  removeAccount: (uuid: string) => ipcRenderer.invoke('accounts:remove', uuid),
  startMicrosoftLogin: () => ipcRenderer.invoke('accounts:microsoft:start'),
  completeMicrosoftLogin: () => ipcRenderer.invoke('accounts:microsoft:complete'),
  openLoginWindow: () => ipcRenderer.invoke('login:open'),
  closeLoginWindow: () => ipcRenderer.invoke('login:close'),
  play: (accountUuid: string) => ipcRenderer.invoke('minecraft:play', accountUuid),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  getLogs: () => ipcRenderer.invoke('logs:get'),
  syncModpack: () => ipcRenderer.invoke('modpack:sync'),
  getModpackStatus: () => ipcRenderer.invoke('modpack:status'),
  onModpackProgress: (callback: (status: any) => void) =>
    ipcRenderer.on('modpack:progress', (_event, data) => callback(data)),
  onMinecraftStatus: (callback: (status: any) => void) =>
    ipcRenderer.on('minecraft:status', (_event, data) => callback(data)),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  getAppVersion: () => ipcRenderer.invoke('app:version')
});
