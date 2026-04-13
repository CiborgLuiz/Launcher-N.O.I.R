import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

export const noirRoot = path.join(os.homedir(), '.noirlauncher');
export const accountsPath = path.join(noirRoot, 'accounts.json');
export const settingsPath = path.join(noirRoot, 'settings.json');
export const cacheRoot = path.join(noirRoot, 'cache');
export const logsRoot = path.join(noirRoot, 'logs');

export async function ensureBaseDirs() {
  await fs.ensureDir(noirRoot);
  await fs.ensureDir(cacheRoot);
  await fs.ensureDir(logsRoot);
}
