const fetch = (...args: Parameters<typeof import("node-fetch")["default"]>) =>
  import("node-fetch").then((module) => module.default(...args));
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import fs from "fs-extra";
import AdmZip from "adm-zip";
import tar from "tar";
import { LauncherPaths } from "../../instance-manager/src";

const execFileAsync = promisify(execFile);

export function getRequiredJavaVersion(minecraftVersion: string, configuredVersion?: number): number {
  if (configuredVersion) {
    return configuredVersion;
  }
  const [, minor] = minecraftVersion.split(".");
  return Number(minor) >= 20 ? 21 : 17;
}

async function readJavaMajorVersion(javaPath: string): Promise<number | null> {
  try {
    const { stderr } = await execFileAsync(javaPath, ["-version"]);
    const output = `${stderr}`;
    const match = output.match(/version "(\d+)(?:\.(\d+))?/);
    if (!match) {
      return null;
    }
    return Number(match[1]);
  } catch {
    return null;
  }
}

async function findSystemJava(): Promise<string | null> {
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const candidate = path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
  }

  const commands = process.platform === "win32" ? ["where"] : ["which"];
  try {
    const { stdout } = await execFileAsync(commands[0], ["java"]);
    const candidate = stdout.split(/\r?\n/).find(Boolean)?.trim();
    return candidate || null;
  } catch {
    return null;
  }
}

async function ensureDownloadedJava(version: number, paths: LauncherPaths): Promise<string> {
  const runtimeDir = path.join(paths.runtimeDir, `temurin-${version}`);
  const binaryName = process.platform === "win32" ? "java.exe" : "java";
  const directJava = path.join(runtimeDir, "bin", binaryName);
  if (await fs.pathExists(directJava)) {
    return directJava;
  }

  const arch = os.arch() === "x64" ? "x64" : os.arch();
  const osName = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";
  const extension = osName === "windows" ? "zip" : "tar.gz";
  const archivePath = path.join(paths.runtimeDir, `temurin-${version}-${osName}-${arch}.${extension}`);
  const url = `https://api.adoptium.net/v3/binary/latest/${version}/ga/${osName}/${arch}/jdk/hotspot/normal/eclipse`;

  if (!(await fs.pathExists(archivePath))) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar Java ${version}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(archivePath, Buffer.from(arrayBuffer));
  }

  await fs.ensureDir(runtimeDir);
  if (archivePath.endsWith(".zip")) {
    new AdmZip(archivePath).extractAllTo(runtimeDir, true);
  } else {
    await tar.x({ file: archivePath, cwd: runtimeDir });
  }

  const candidates = await fs.readdir(runtimeDir);
  for (const candidate of candidates) {
    const resolved = path.join(runtimeDir, candidate, "bin", binaryName);
    if (await fs.pathExists(resolved)) {
      return resolved;
    }
  }

  if (await fs.pathExists(directJava)) {
    return directJava;
  }
  throw new Error("Java baixado, mas o executavel nao foi encontrado");
}

export async function ensureJavaRuntime(requiredVersion: number, paths: LauncherPaths, preferredPath?: string): Promise<string> {
  const candidates = [preferredPath, await findSystemJava()].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (!(await fs.pathExists(candidate))) {
      continue;
    }
    const version = await readJavaMajorVersion(candidate);
    if (version && version >= requiredVersion) {
      return candidate;
    }
  }

  return ensureDownloadedJava(requiredVersion, paths);
}
