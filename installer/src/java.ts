import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
const fetch = (...args: any[]) => import('node-fetch').then((m) => (m.default as any)(...args));
import AdmZip from 'adm-zip';
import tar from 'tar';
import { cacheRoot, ensureBaseDirs, noirRoot } from '../../config-system/src/paths';

export async function detectJava(javaPath: string): Promise<string | null> {
  if (javaPath && (await fs.pathExists(javaPath))) return javaPath;
  const env = process.env.JAVA_HOME;
  if (env) {
    const candidate = path.join(env, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
    if (await fs.pathExists(candidate)) return candidate;
  }
  return null;
}

export function javaVersionForMinecraft(mcVersion: string) {
  const parts = mcVersion.split('.');
  const minor = parseInt(parts[1] || '0', 10);
  return minor >= 20 ? 21 : 17;
}

export async function downloadTemurin(version: number) {
  await ensureBaseDirs();
  const platform = os.platform();
  const arch = os.arch() === 'x64' ? 'x64' : os.arch();
  const osName = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux';

  const url = `https://api.adoptium.net/v3/binary/latest/${version}/ga/${osName}/${arch}/jdk/hotspot/normal/eclipse`;
  const target = path.join(cacheRoot, `temurin-${version}-${osName}-${arch}`);
  const archive = `${target}.${osName === 'windows' ? 'zip' : 'tar.gz'}`;
  if (await fs.pathExists(archive)) return archive;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao baixar Java');
  const buffer = await res.arrayBuffer();
  await fs.writeFile(archive, Buffer.from(buffer));
  return archive;
}

export async function ensureJava(version: number) {
  await ensureBaseDirs();
  const runtimeDir = path.join(noirRoot, 'runtime', `temurin-${version}`);
  const javaBin = path.join(runtimeDir, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
  if (await fs.pathExists(javaBin)) return javaBin;

  const archive = await downloadTemurin(version);
  await fs.ensureDir(runtimeDir);
  if (archive.endsWith('.zip')) {
    const zip = new AdmZip(archive);
    zip.extractAllTo(runtimeDir, true);
  } else if (archive.endsWith('.tar.gz')) {
    await tar.x({ file: archive, cwd: runtimeDir });
  }

  // Some archives contain a top-level folder; resolve actual java path
  const entries = await fs.readdir(runtimeDir);
  if (entries.length === 1) {
    const inner = path.join(runtimeDir, entries[0]);
    const innerJava = path.join(inner, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
    if (await fs.pathExists(innerJava)) return innerJava;
  }
  return javaBin;
}
