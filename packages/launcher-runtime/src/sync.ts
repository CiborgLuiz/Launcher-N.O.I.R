import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "fs-extra";
import path from "node:path";
import { CurseForgeClient, CurseForgeFile, readManifestFromZip } from "../../curseforge/src";
import {
  ensureLauncherLayout,
  LauncherPaths,
  loadInstanceMetadata,
  loadModpackLock,
  saveInstanceMetadata,
  saveModpackLock
} from "../../instance-manager/src";
import { LauncherConfig, ModpackLock } from "../../shared/src";
import { FileLogger } from "../../core/src/logger";
import { buildModpackLock, planModpackUpdate } from "./planner";

type SyncOptions = {
  config: LauncherConfig;
  paths?: LauncherPaths;
  logger: FileLogger;
  onProgress?: (status: { message: string; progress: number; step: string }) => Promise<void> | void;
};

const USER_PRESERVED_PREFIXES = ["config/", "resourcepacks/", "shaderpacks/", "saves/"];

async function sha1File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}

async function emitProgress(
  options: SyncOptions,
  message: string,
  progress: number,
  step: string
): Promise<void> {
  await options.logger.log("install", "info", message, { progress, step });
  await options.onProgress?.({ message, progress, step });
}

function shouldPreserveOverride(relativePath: string, targetPath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!USER_PRESERVED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return fs.existsSync(targetPath);
}

async function extractOverrides(
  zip: import("adm-zip"),
  overridesDir: string,
  paths: LauncherPaths,
  logger: FileLogger
): Promise<void> {
  const entries = zip.getEntries().filter((entry) => entry.entryName.startsWith(`${overridesDir}/`) && !entry.isDirectory);
  for (const entry of entries) {
    const relativePath = entry.entryName.replace(`${overridesDir}/`, "");
    const targetPath = path.join(paths.instanceRoot, relativePath);
    if (shouldPreserveOverride(relativePath, targetPath)) {
      await logger.log("install", "info", `Override preservado: ${relativePath}`);
      continue;
    }
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, entry.getData());
  }
}

async function runConcurrent<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let pointer = 0;
  let firstError: unknown;
  const tasks = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (pointer < items.length) {
      if (firstError) {
        return;
      }
      const current = pointer;
      pointer += 1;
      try {
        await worker(items[current], current);
      } catch (error) {
        firstError = firstError || error;
        return;
      }
    }
  });
  await Promise.all(tasks);
  if (firstError) {
    throw firstError;
  }
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  await runConcurrent(items, concurrency, async (item, index) => {
    results[index] = await worker(item, index);
  });
  return results;
}

function getNetworkConcurrency(): number {
  return process.platform === "win32" ? 2 : 3;
}

async function enrichLockEntries(client: CurseForgeClient, lock: ModpackLock): Promise<ModpackLock> {
  const entries = await mapConcurrent(
    lock.files,
    getNetworkConcurrency(),
    async (entry) => {
      const info = await client.getFileInfo(entry.projectId, entry.fileId);
      return {
        ...entry,
        fileName: info.fileName,
        sha1: info.hashes?.find((hash) => hash.algo === 1)?.value
      };
    }
  );
  return {
    ...lock,
    files: entries
  };
}

async function removeObsoleteMods(removals: Array<{ fileName?: string }>, paths: LauncherPaths, logger: FileLogger): Promise<void> {
  for (const removal of removals) {
    if (!removal.fileName) {
      continue;
    }
    const target = path.join(paths.modsDir, removal.fileName);
    if (await fs.pathExists(target)) {
      await fs.remove(target);
      await logger.log("install", "info", `Mod removido: ${removal.fileName}`);
    }
  }
}

async function downloadManifestMods(
  client: CurseForgeClient,
  lock: ModpackLock,
  paths: LauncherPaths,
  logger: FileLogger,
  progressBase = 40,
  onProgress?: (message: string, progress: number) => Promise<void>
): Promise<void> {
  let completed = 0;
  const total = Math.max(lock.files.length, 1);

  const reportProgress = async (message: string): Promise<number> => {
    completed += 1;
    const progress = Math.min(90, progressBase + Math.round((completed / total) * 50));
    await onProgress?.(message, progress);
    return progress;
  };

  await runConcurrent(lock.files, getNetworkConcurrency(), async (entry, index) => {
    const targetName = entry.fileName || `${entry.projectId}-${entry.fileId}.jar`;
    const targetPath = path.join(paths.modsDir, targetName);
    if (await fs.pathExists(targetPath)) {
      if (!entry.sha1) {
        await logger.log("install", "info", `Mod preservado: ${path.basename(targetPath)}`);
        await reportProgress(`Verificando mod ${index + 1}/${lock.files.length}: ${path.basename(targetPath)}`);
        return;
      } else {
        const currentHash = await sha1File(targetPath);
        if (currentHash.toLowerCase() === entry.sha1.toLowerCase()) {
          await logger.log("install", "info", `Mod mantido em cache local: ${path.basename(targetPath)}`);
          await reportProgress(`Verificando mod ${index + 1}/${lock.files.length}: ${path.basename(targetPath)}`);
          return;
        }
      }
    }

    try {
      const { info, cachedPath } = await client.downloadProjectFile(entry.projectId, entry.fileId);
      await fs.copyFile(cachedPath, path.join(paths.modsDir, info.fileName));
      await logger.log("install", "info", `Mod sincronizado: ${info.fileName}`);
      const progress = await reportProgress(`Sincronizando mod ${index + 1}/${lock.files.length}: ${info.fileName}`);
      await logger.log("install", "info", "Progresso de download de mods", {
        completed,
        total: lock.files.length,
        progress
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no download";
      throw new Error(`Falha ao sincronizar mod ${targetName}: ${message}`);
    }
  });
}

export async function syncSingleModpack(options: SyncOptions): Promise<{
  project: { id: number; name: string; summary: string };
  file: CurseForgeFile;
  lock: ModpackLock;
}> {
  const paths = options.paths || (await ensureLauncherLayout());
  const client = new CurseForgeClient(process.env.CURSEFORGE_API_KEY, paths);

  await emitProgress(options, "Consultando projeto no CurseForge", 5, "project");
  const project = await client.getProject(options.config.curseforgeProjectId);
  const file = await client.resolveTargetFile(options.config.curseforgeProjectId, options.config.preferredFileId);
  const currentLock = await loadModpackLock(paths);

  if (currentLock?.fileId === file.id) {
    const instance = await loadInstanceMetadata(options.config, paths);
    instance.installedProjectId = project.id;
    instance.installedFileId = file.id;
    instance.installedVersionLabel = currentLock.versionLabel;
    await saveInstanceMetadata(instance, paths);
    await emitProgress(options, "Modpack ja esta atualizado", 100, "ready");
    return { project, file, lock: currentLock };
  }

  await emitProgress(options, `Baixando pacote ${file.displayName}`, 15, "download-modpack");
  const zipSha1 = file.hashes?.find((hash) => hash.algo === 1)?.value;
  const zipPath = await client.downloadToCache(
    await client.getDownloadUrls(options.config.curseforgeProjectId, file.id),
    `modpack-${project.id}-${file.id}.zip`,
    zipSha1
  );

  await emitProgress(options, "Interpretando manifest do modpack", 25, "manifest");
  const { zip, manifest } = readManifestFromZip(zipPath);
  let nextLock = buildModpackLock(project.id, file, manifest);
  nextLock = await enrichLockEntries(client, nextLock);

  await emitProgress(options, "Aplicando overrides do modpack", 35, "overrides");
  await extractOverrides(zip, manifest.overrides || "overrides", paths, options.logger);

  const plan = planModpackUpdate(currentLock, nextLock);
  await removeObsoleteMods(plan.removals, paths, options.logger);

  await emitProgress(options, "Sincronizando mods e dependencias", 40, "mods");
  await downloadManifestMods(client, nextLock, paths, options.logger, 40, async (message, progress) => {
    await emitProgress(options, message, progress, "mods");
  });

  const instance = await loadInstanceMetadata(options.config, paths);
  instance.minecraftVersion = nextLock.minecraftVersion;
  instance.modLoader = nextLock.modLoader;
  instance.modLoaderVersion = nextLock.modLoaderVersion;
  instance.installedProjectId = project.id;
  instance.installedFileId = file.id;
  instance.installedVersionLabel = nextLock.versionLabel;
  await saveInstanceMetadata(instance, paths);
  await saveModpackLock(nextLock, paths);
  await emitProgress(options, "Instancia pronta para jogar", 100, "ready");

  return {
    project,
    file,
    lock: nextLock
  };
}
