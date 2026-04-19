import fs from "fs-extra";
import path from "node:path";
import { FileLogger } from "../../core/src/logger";
import { LauncherPaths } from "../../instance-manager/src";

const FORGE_MAVEN_HOST = "https://maven.minecraftforge.net";
const LEGACY_FORGE_MAVEN_HOST = "https://files.minecraftforge.net/maven";

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
