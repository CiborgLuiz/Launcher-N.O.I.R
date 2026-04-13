import { autoUpdater } from 'electron-updater';
import { log } from '../../launcher-core/src/logger';

export function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', () => {
    log({ ts: new Date().toISOString(), level: 'INFO', message: 'Update disponivel.' });
  });
  autoUpdater.on('update-downloaded', () => {
    log({ ts: new Date().toISOString(), level: 'INFO', message: 'Update baixado.' });
    autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => {
    log({ ts: new Date().toISOString(), level: 'ERROR', message: `Updater erro: ${err}` });
  });
}

export async function checkForUpdates() {
  await autoUpdater.checkForUpdates();
}
