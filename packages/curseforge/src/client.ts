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

  async getDownloadUrl(projectId: number, fileId: number): Promise<string> {
    return withRetry(async () => {
      const response = await this.http.get(`/v1/mods/${projectId}/files/${fileId}/download-url`);
      return response.data.data as string;
    });
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

  async downloadToCache(url: string, filename: string, expectedSha1?: string): Promise<string> {
    await fs.ensureDir(this.paths.cacheDir);
    const target = path.join(this.paths.cacheDir, filename);

    if (await fs.pathExists(target)) {
      if (!expectedSha1 || sha1File(target).toLowerCase() === expectedSha1.toLowerCase()) {
        return target;
      }
    }

    const response = await withRetry(() => this.http.get(url, { responseType: "arraybuffer" }), 3, 800);
    await fs.writeFile(target, response.data);

    if (expectedSha1) {
      const fileHash = sha1File(target);
      if (fileHash.toLowerCase() !== expectedSha1.toLowerCase()) {
        throw new Error(`Hash invalido para ${filename}`);
      }
    }

    return target;
  }

  async downloadProjectFile(projectId: number, fileId: number): Promise<{ info: CurseForgeFile; cachedPath: string }> {
    const info = await this.getFileInfo(projectId, fileId);
    const url = await this.getDownloadUrl(projectId, fileId);
    const sha1 = info.hashes?.find((hash) => hash.algo === 1)?.value;
    const cachedPath = await this.downloadToCache(url, info.fileName || path.basename(url), sha1);
    return { info, cachedPath };
  }
}
