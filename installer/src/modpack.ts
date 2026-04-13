import AdmZip from 'adm-zip';
import fs from 'fs-extra';
import path from 'node:path';
import { downloadWithCache, getDownloadUrl, getFileInfo, listModFiles } from '../../curseforge-integration/src/curseforge';
import { ensureInstanceDirs, readInstanceConfig, writeInstanceConfig, noirInstanceRoot } from '../../instance-manager/src/instances';
import { parseModloader } from './modloader';

export const NOIR_MODPACK_PROJECT_ID = 1483856;

export type Manifest = {
  minecraft: {
    version: string;
    modLoaders: { id: string; primary: boolean }[];
  };
  files: { projectID: number; fileID: number; required: boolean }[];
  overrides: string;
};

function extractOverrides(zip: AdmZip, instanceRoot: string, overridesDir: string, preserveConfig: boolean) {
  const overridesEntries = zip.getEntries().filter((e: AdmZip.IZipEntry) =>
    e.entryName.startsWith(`${overridesDir}/`)
  );
  for (const entry of overridesEntries) {
    if (entry.isDirectory) continue;
    const relative = entry.entryName.replace(`${overridesDir}/`, '');
    if (preserveConfig && relative.startsWith('config/')) continue;
    const target = path.join(instanceRoot, relative);
    fs.ensureDirSync(path.dirname(target));
    fs.writeFileSync(target, entry.getData());
  }
}

async function downloadMods(manifest: Manifest, modsDir: string, onProgress?: (msg: string) => void) {
  await fs.ensureDir(modsDir);
  const queue = [...manifest.files];
  const seen = new Set<string>();
  const concurrency = 4;

  const worker = async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      const key = `${file.projectID}:${file.fileID}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const info = await getFileInfo(file.projectID, file.fileID);
      onProgress?.(`Baixando mod: ${info.fileName}`);
      const url = await getDownloadUrl(file.projectID, file.fileID);
      const sha1 = info.hashes?.find((h: any) => h.algo === 1)?.value;
      const cached = await downloadWithCache(url, path.basename(url), sha1);
      const target = path.join(modsDir, info.fileName);
      await fs.copyFile(cached, target);

      const deps = info.dependencies || [];
      for (const dep of deps) {
        if (dep.relationType === 3) {
          queue.push({ projectID: dep.modId, fileID: dep.fileId, required: true });
        }
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

export async function installModpackFromZip(zipPath: string, projectId: number, fileId: number, onProgress?: (msg: string) => void) {
  const zip = new AdmZip(zipPath);
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('manifest.json nao encontrado');
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as Manifest;

  const instanceRoot = await ensureInstanceDirs();
  const overridesDir = manifest.overrides || 'overrides';
  extractOverrides(zip, instanceRoot, overridesDir, false);

  const loader = parseModloader(manifest.minecraft.modLoaders);
  const config = await readInstanceConfig();
  config.minecraftVersion = manifest.minecraft.version;
  config.modloader = loader.type;
  config.modloaderVersion = loader.version;
  config.curseforgeProjectId = projectId;
  config.curseforgeFileId = fileId;
  config.modpackVersion = `${projectId}:${fileId}`;
  await writeInstanceConfig(config);

  await fs.writeJson(path.join(instanceRoot, 'manifest.json'), manifest, { spaces: 2 });

  onProgress?.('Baixando mods...');
  await downloadMods(manifest, path.join(instanceRoot, 'mods'), onProgress);
}

export async function syncNoirModpack(onProgress?: (msg: string) => void) {
  onProgress?.('Verificando modpack...');
  const files = await listModFiles(NOIR_MODPACK_PROJECT_ID);
  if (!files.length) throw new Error('Nenhuma versao encontrada para o modpack');
  const latest = files.sort((a: any, b: any) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime())[0];

  await ensureInstanceDirs();
  const config = await readInstanceConfig();
  if (config.curseforgeFileId === latest.id) {
    onProgress?.('Modpack atualizado.');
    return {
      projectId: NOIR_MODPACK_PROJECT_ID,
      fileId: latest.id,
      version: `${NOIR_MODPACK_PROJECT_ID}:${latest.id}`,
      fileName: latest.fileName || latest.displayName || ''
    };
  }

  onProgress?.(`Baixando modpack: ${latest.fileName || latest.displayName || ''}`);
  const url = await getDownloadUrl(NOIR_MODPACK_PROJECT_ID, latest.id);
  const zipPath = await downloadWithCache(url, `modpack-${NOIR_MODPACK_PROJECT_ID}-${latest.id}.zip`);

  const zip = new AdmZip(zipPath);
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('manifest.json nao encontrado');
  const newManifest = JSON.parse(manifestEntry.getData().toString('utf8')) as Manifest;

  const instanceRoot = noirInstanceRoot;
  extractOverrides(zip, instanceRoot, newManifest.overrides || 'overrides', true);

  const manifestPath = path.join(instanceRoot, 'manifest.json');
  if (await fs.pathExists(manifestPath)) {
    const oldManifest = (await fs.readJson(manifestPath)) as Manifest;
    const newFiles = new Set(newManifest.files.map((f) => `${f.projectID}:${f.fileID}`));

    for (const file of oldManifest.files) {
      const key = `${file.projectID}:${file.fileID}`;
      if (!newFiles.has(key)) {
        const info = await getFileInfo(file.projectID, file.fileID);
        const target = path.join(instanceRoot, 'mods', info.fileName);
        if (await fs.pathExists(target)) await fs.remove(target);
      }
    }
  }

  await installModpackFromZip(zipPath, NOIR_MODPACK_PROJECT_ID, latest.id, onProgress);
  await fs.writeJson(manifestPath, newManifest, { spaces: 2 });

  onProgress?.('Modpack atualizado.');
  return {
    projectId: NOIR_MODPACK_PROJECT_ID,
    fileId: latest.id,
    version: `${NOIR_MODPACK_PROJECT_ID}:${latest.id}`,
    fileName: latest.fileName || latest.displayName || ''
  };
}
