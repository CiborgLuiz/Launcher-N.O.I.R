import { CurseForgeFile } from "../../curseforge/src";
import { CurseForgeManifest } from "../../curseforge/src/manifest";
import { ModpackLock } from "../../shared/src";
import { parseModLoader } from "./modloader";

export type UpdatePlan = {
  additions: Array<{ projectId: number; fileId: number; required: boolean }>;
  removals: Array<{ projectId: number; fileId: number; fileName?: string }>;
  retained: Array<{ projectId: number; fileId: number; fileName?: string }>;
};

export function buildModpackLock(
  projectId: number,
  projectFile: CurseForgeFile,
  manifest: CurseForgeManifest
): ModpackLock {
  const loader = parseModLoader(manifest.minecraft.modLoaders);
  return {
    projectId,
    fileId: projectFile.id,
    fileName: projectFile.fileName || projectFile.displayName,
    versionLabel: manifest.version || projectFile.displayName,
    minecraftVersion: manifest.minecraft.version,
    modLoader: loader.type,
    modLoaderVersion: loader.version,
    generatedAt: new Date().toISOString(),
    files: manifest.files.map((entry) => ({
      projectId: entry.projectID,
      fileId: entry.fileID,
      required: entry.required
    }))
  };
}

export function planModpackUpdate(currentLock: ModpackLock | null, nextLock: ModpackLock): UpdatePlan {
  const currentEntries = new Map(
    (currentLock?.files || []).map((entry) => [`${entry.projectId}:${entry.fileId}`, entry] as const)
  );
  const nextEntries = new Map(nextLock.files.map((entry) => [`${entry.projectId}:${entry.fileId}`, entry] as const));

  const additions = nextLock.files
    .filter((entry) => !currentEntries.has(`${entry.projectId}:${entry.fileId}`))
    .map((entry) => ({ projectId: entry.projectId, fileId: entry.fileId, required: entry.required }));

  const removals = [...currentEntries.values()]
    .filter((entry) => !nextEntries.has(`${entry.projectId}:${entry.fileId}`))
    .map((entry) => ({ projectId: entry.projectId, fileId: entry.fileId, fileName: entry.fileName }));

  const retained = nextLock.files
    .filter((entry) => currentEntries.has(`${entry.projectId}:${entry.fileId}`))
    .map((entry) => ({ projectId: entry.projectId, fileId: entry.fileId, fileName: currentEntries.get(`${entry.projectId}:${entry.fileId}`)?.fileName }));

  return { additions, removals, retained };
}
