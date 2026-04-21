import AdmZip from "adm-zip";
import fs from "fs-extra";
import path from "node:path";
import { FileLogger } from "../../core/src/logger";
import { LauncherPaths } from "../../instance-manager/src";

const FORGE_MAVEN_HOST = "https://maven.minecraftforge.net";
const LEGACY_FORGE_MAVEN_HOST = "https://files.minecraftforge.net/maven";

type ForgeArgumentEntry =
  | string
  | {
      value?: string | string[];
    };

type ForgeInstallerManifest = {
  id: string;
  arguments?: {
    jvm?: ForgeArgumentEntry[];
  };
};

export function resolveForgeArtifactVersion(minecraftVersion: string, forgeVersion: string): string {
  if (forgeVersion.startsWith(`${minecraftVersion}-`)) {
    return forgeVersion;
  }
  return `${minecraftVersion}-${forgeVersion}`;
}

export function buildForgeInstallerUrls(minecraftVersion: string, forgeVersion: string): string[] {
  const artifactVersion = resolveForgeArtifactVersion(minecraftVersion, forgeVersion);
  const fileName = `forge-${artifactVersion}-installer.jar`;
  const artifactPath = `net/minecraftforge/forge/${artifactVersion}/${fileName}`;

  return [
    `${FORGE_MAVEN_HOST}/releases/${artifactPath}`,
    `${FORGE_MAVEN_HOST}/${artifactPath}`,
    `${LEGACY_FORGE_MAVEN_HOST}/${artifactPath}`
  ];
}

export async function ensureForgeInstaller(
  minecraftVersion: string,
  forgeVersion: string,
  paths: LauncherPaths,
  logger: FileLogger
): Promise<string> {
  const artifactVersion = resolveForgeArtifactVersion(minecraftVersion, forgeVersion);
  const fileName = `forge-${artifactVersion}-installer.jar`;
  const targetDirectory = path.join(paths.cacheDir, "forge", artifactVersion);
  const targetPath = path.join(targetDirectory, fileName);

  if (await fs.pathExists(targetPath)) {
    const stat = await fs.stat(targetPath);
    if (stat.size > 0) {
      return targetPath;
    }
    await fs.remove(targetPath);
  }

  await fs.ensureDir(targetDirectory);

  let lastError: unknown;
  for (const url of buildForgeInstallerUrls(minecraftVersion, forgeVersion)) {
    try {
      await logger.log("launcher", "info", "Baixando Forge installer", {
        minecraftVersion,
        forgeVersion: artifactVersion,
        url
      });

      const response = await fetch(url, {
        headers: {
          Accept: "application/java-archive, application/octet-stream, */*",
          "User-Agent": "NOIR Launcher/0.2.0"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = Buffer.from(await response.arrayBuffer());
      if (!payload.byteLength) {
        throw new Error("Resposta vazia");
      }

      await fs.writeFile(targetPath, payload);
      await logger.log("launcher", "info", "Forge installer pronto", {
        forgeInstallerPath: targetPath,
        forgeVersion: artifactVersion
      });
      return targetPath;
    } catch (error) {
      lastError = error;
      await logger.log("launcher", "warn", "Falha ao baixar Forge installer", {
        minecraftVersion,
        forgeVersion: artifactVersion,
        url,
        detail: error instanceof Error ? error.message : `${error}`
      });
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "falha desconhecida";
  throw new Error(`Nao foi possivel baixar o installer do Forge ${artifactVersion}: ${detail}`);
}

export function parseForgeInstallerManifest(rawManifest: string): ForgeInstallerManifest {
  return JSON.parse(rawManifest) as ForgeInstallerManifest;
}

export function resolveForgeJvmArgs(manifest: ForgeInstallerManifest, libraryDirectory: string): string[] {
  const rawArgs = manifest.arguments?.jvm || [];
  const flattenedArgs = rawArgs.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (Array.isArray(entry.value)) {
      return entry.value;
    }
    return typeof entry.value === "string" ? [entry.value] : [];
  });

  const replacements: Record<string, string> = {
    "${library_directory}": path.resolve(libraryDirectory),
    "${classpath_separator}": path.delimiter,
    "${version_name}": manifest.id
  };

  return flattenedArgs.map((argument) => {
    let resolved = argument;
    for (const [token, replacement] of Object.entries(replacements)) {
      resolved = resolved.split(token).join(replacement);
    }
    return resolved;
  });
}

export async function readForgeInstallerManifest(installerPath: string): Promise<ForgeInstallerManifest | null> {
  try {
    const zip = new AdmZip(installerPath);
    const entry = zip.getEntry("version.json");
    if (!entry) {
      return null;
    }
    return parseForgeInstallerManifest(zip.readAsText(entry));
  } catch {
    return null;
  }
}

export function getForgeVersionCachePath(paths: LauncherPaths, minecraftVersion: string): string {
  return path.join(paths.gameDir, "forge", minecraftVersion, "version.json");
}

export async function invalidateStaleForgeVersionCache(
  minecraftVersion: string,
  expectedVersionId: string,
  paths: LauncherPaths,
  logger: FileLogger
): Promise<void> {
  const cachePath = getForgeVersionCachePath(paths, minecraftVersion);
  if (!(await fs.pathExists(cachePath))) {
    return;
  }

  try {
    const cachedManifest = (await fs.readJson(cachePath)) as Partial<ForgeInstallerManifest>;
    if (cachedManifest.id === expectedVersionId) {
      return;
    }
  } catch {
    // Treat invalid cache as stale and replace it on the next Forge generation.
  }

  await fs.remove(cachePath);
  await logger.log("launcher", "info", "Cache do Forge invalidado para regenerar version.json", {
    minecraftVersion,
    expectedVersionId,
    cachePath
  });
}
