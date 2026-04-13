import fs from 'fs-extra';
import { ensureBaseDirs, settingsPath } from './paths';

export type Settings = {
  ram: number;
  resolutionWidth: number;
  resolutionHeight: number;
  fullscreen: boolean;
  javaPath: string;
  autoUpdate: boolean;
};

const defaults: Settings = {
  ram: 4096,
  resolutionWidth: 1280,
  resolutionHeight: 720,
  fullscreen: false,
  javaPath: '',
  autoUpdate: true
};

export async function loadSettings(): Promise<Settings> {
  await ensureBaseDirs();
  if (!(await fs.pathExists(settingsPath))) {
    await fs.writeJson(settingsPath, defaults, { spaces: 2 });
    return defaults;
  }
  const data = await fs.readJson(settingsPath);
  return { ...defaults, ...data };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await ensureBaseDirs();
  await fs.writeJson(settingsPath, settings, { spaces: 2 });
}
