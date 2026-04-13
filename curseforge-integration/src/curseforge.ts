import axios from 'axios';
import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { cacheRoot, ensureBaseDirs } from '../../config-system/src/paths';

const API = 'https://api.curseforge.com';
const API_KEY = '$2a$10$RGB1MCnqyZ/uhvqslnz.k./8wEBGyDVgpym0pel.0mQ3xT/ZBGJsy';

const client = axios.create({
  baseURL: API,
  headers: { 'x-api-key': API_KEY }
});

export async function getModpack(modId: number) {
  const res = await client.get(`/v1/mods/${modId}`);
  return res.data.data;
}

export async function listModFiles(modId: number) {
  const res = await client.get(`/v1/mods/${modId}/files`);
  return res.data.data;
}

export async function findModpackBySlug(slug: string) {
  const res = await client.get('/v1/mods/search', {
    params: {
      gameId: 432,
      classId: 4471,
      searchFilter: slug,
      pageSize: 50
    }
  });
  const matches = res.data.data || [];
  return matches.find((m: any) => m.slug === slug) || null;
}

export async function getFileInfo(modId: number, fileId: number) {
  const res = await client.get(`/v1/mods/${modId}/files/${fileId}`);
  return res.data.data;
}

export async function getDownloadUrl(modId: number, fileId: number) {
  const res = await client.get(`/v1/mods/${modId}/files/${fileId}/download-url`);
  return res.data.data as string;
}

function sha1File(filePath: string) {
  const hash = crypto.createHash('sha1');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

export async function downloadWithCache(url: string, filename: string, expectedSha1?: string) {
  await ensureBaseDirs();
  const cached = path.join(cacheRoot, filename);
  if (await fs.pathExists(cached)) {
    if (!expectedSha1 || sha1File(cached).toLowerCase() === expectedSha1.toLowerCase()) {
      return cached;
    }
  }
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.writeFile(cached, res.data);
  if (expectedSha1) {
    const current = sha1File(cached);
    if (current.toLowerCase() !== expectedSha1.toLowerCase()) {
      throw new Error('SHA1 invalido no download');
    }
  }
  return cached;
}
