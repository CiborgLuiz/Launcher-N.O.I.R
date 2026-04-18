import axios, { AxiosInstance } from "axios";
import crypto from "node:crypto";
import fs from "fs-extra";
import path from "node:path";
import { getLauncherPaths, LauncherPaths } from "../../instance-manager/src";

export type CurseForgeFile = {
  id: number;
  fileName: string;
  displayName: string;
  fileDate: string;
  downloadCount: number;
  releaseType: number;
  downloadUrl?: string | null;
  isAvailable?: boolean;
  hashes?: Array<{ value: string; algo: number }>;
  dependencies?: Array<{ modId: number; relationType: number; fileId: number }>;
};

export type CurseForgeProject = {
  id: number;
  name: string;
  summary: string;
  links?: {
    websiteUrl?: string;
  };
};

async function withRetry<T>(action: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (index === attempts - 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (index + 1)));
    }
  }
  throw lastError;
}

function sha1File(filePath: string): string {
  const hash = crypto.createHash("sha1");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function buildCurseForgeCdnUrl(fileId: number, fileName: string, host = "edge.forgecdn.net"): string {
  const id = String(fileId);
  const folder = id.slice(0, -3) || "0";
  const suffix = id.slice(-3);
  return `https://${host}/files/${folder}/${suffix}/${encodeURIComponent(fileName)}`;
}

export function resolveCurseForgeDownloadUrls(file: Pick<CurseForgeFile, "id" | "fileName" | "downloadUrl">): string[] {
  const candidates = [
    file.downloadUrl || undefined,
    buildCurseForgeCdnUrl(file.id, file.fileName, "edge.forgecdn.net"),
    buildCurseForgeCdnUrl(file.id, file.fileName, "mediafilez.forgecdn.net")
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export class CurseForgeClient {
  private readonly http: AxiosInstance;
  private readonly paths: LauncherPaths;

  constructor(apiKey = process.env.CURSEFORGE_API_KEY, paths = getLauncherPaths()) {
    if (!apiKey) {
      throw new Error("CURSEFORGE_API_KEY nao configurado");
    }
    this.paths = paths;
    this.http = axios.create({
      baseURL: "https://api.curseforge.com",
      headers: {
        "x-api-key": apiKey
      },
      timeout: 30_000
    });
  }

  async getProject(projectId: number): Promise<CurseForgeProject> {
    return withRetry(async () => {
      const response = await this.http.get(`/v1/mods/${projectId}`);
      return response.data.data as CurseForgeProject;
    });
  }

  async listProjectFiles(projectId: number): Promise<CurseForgeFile[]> {
    return withRetry(async () => {
      const response = await this.http.get(`/v1/mods/${projectId}/files`);
      return response.data.data as CurseForgeFile[];
    });
  }

  async getFileInfo(projectId: number, fileId: number): Promise<CurseForgeFile> {
    return withRetry(async () => {
      const response = await this.http.get(`/v1/mods/${projectId}/files/${fileId}`);
      return response.data.data as CurseForgeFile;
    });
  }

  async getDownloadUrls(projectId: number, fileId: number): Promise<string[]> {
    const info = await this.getFileInfo(projectId, fileId);
    return resolveCurseForgeDownloadUrls(info);
  }

  async resolveTargetFile(projectId: number, preferredFileId?: number): Promise<CurseForgeFile> {
    if (preferredFileId) {
      return this.getFileInfo(projectId, preferredFileId);
    }

    const files = await this.listProjectFiles(projectId);
    const sorted = [...files].sort((left, right) => new Date(right.fileDate).getTime() - new Date(left.fileDate).getTime());
    const preferredRelease = sorted.find((file) => file.releaseType === 1);
    const latest = preferredRelease || sorted[0];
    if (!latest) {
      throw new Error("Nenhum arquivo do modpack foi encontrado no CurseForge");
    }
    return latest;
  }

  async downloadToCache(url: string | string[], filename: string, expectedSha1?: string): Promise<string> {
    await fs.ensureDir(this.paths.cacheDir);
    const target = path.join(this.paths.cacheDir, filename);
    const candidates = Array.isArray(url) ? url : [url];

    if (await fs.pathExists(target)) {
      if (!expectedSha1 || sha1File(target).toLowerCase() === expectedSha1.toLowerCase()) {
        return target;
      }
    }

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const response = await withRetry(
          () =>
            axios.get(candidate, {
              responseType: "arraybuffer",
              timeout: 60_000,
              maxRedirects: 5,
              headers: {
                "User-Agent": "NOIR Launcher/0.2.0",
                Accept: "*/*"
              }
            }),
          3,
          800
        );
        await fs.writeFile(target, response.data);

        if (expectedSha1) {
          const fileHash = sha1File(target);
          if (fileHash.toLowerCase() !== expectedSha1.toLowerCase()) {
            throw new Error(`Hash invalido para ${filename}`);
          }
        }

        return target;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  async downloadProjectFile(projectId: number, fileId: number): Promise<{ info: CurseForgeFile; cachedPath: string }> {
    const info = await this.getFileInfo(projectId, fileId);
    const sha1 = info.hashes?.find((hash) => hash.algo === 1)?.value;
    const urls = resolveCurseForgeDownloadUrls(info);
    const cachedPath = await this.downloadToCache(urls, info.fileName || path.basename(urls[0]), sha1);
    return { info, cachedPath };
  }
}
