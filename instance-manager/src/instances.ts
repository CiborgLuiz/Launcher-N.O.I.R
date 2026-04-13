import fs from 'fs-extra';
import path from 'node:path';
import { ensureBaseDirs, noirRoot } from '../../config-system/src/paths';

export const NOIR_INSTANCE_NAME = 'noir-smp';
export const noirInstanceRoot = path.join(noirRoot, NOIR_INSTANCE_NAME);

export type InstanceConfig = {
  minecraftVersion: string;
  modloader: string;
  modloaderVersion: string;
  memory: number;
  javaPath: string;
  lastPlayed: string;
  curseforgeProjectId?: number;
  curseforgeFileId?: number;
  modpackVersion?: string;
};

export async function ensureInstanceDirs() {
  await ensureBaseDirs();
  await fs.ensureDir(path.join(noirInstanceRoot, 'mods'));
  await fs.ensureDir(path.join(noirInstanceRoot, 'config'));
  await fs.ensureDir(path.join(noirInstanceRoot, 'resourcepacks'));
  await fs.ensureDir(path.join(noirInstanceRoot, 'saves'));
  await fs.ensureDir(path.join(noirInstanceRoot, 'logs'));
  await fs.ensureDir(path.join(noirInstanceRoot, 'libraries'));
  await fs.ensureDir(path.join(noirInstanceRoot, 'runtime'));
  return noirInstanceRoot;
}

export async function readInstanceConfig(): Promise<InstanceConfig> {
  await ensureBaseDirs();
  const configPath = path.join(noirInstanceRoot, 'instance.json');
  if (!(await fs.pathExists(configPath))) {
    const defaults: InstanceConfig = {
      minecraftVersion: '1.20.1',
      modloader: 'forge',
      modloaderVersion: '47.2.0',
      memory: 4096,
      javaPath: '',
      lastPlayed: ''
    };
    await fs.ensureDir(noirInstanceRoot);
    await fs.writeJson(configPath, defaults, { spaces: 2 });
    return defaults;
  }
  return fs.readJson(configPath);
}

export async function writeInstanceConfig(config: InstanceConfig) {
  const configPath = path.join(noirInstanceRoot, 'instance.json');
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export async function updateLastPlayed() {
  const config = await readInstanceConfig();
  config.lastPlayed = new Date().toISOString();
  await writeInstanceConfig(config);
}
