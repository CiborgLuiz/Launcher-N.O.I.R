import AdmZip from "adm-zip";

export type CurseForgeManifest = {
  minecraft: {
    version: string;
    modLoaders: Array<{ id: string; primary: boolean }>;
  };
  manifestVersion: number;
  name: string;
  version: string;
  author: string;
  files: Array<{ projectID: number; fileID: number; required: boolean }>;
  overrides: string;
};

export function readManifestFromZip(zipPath: string): { zip: AdmZip; manifest: CurseForgeManifest } {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry("manifest.json");
  if (!entry) {
    throw new Error("manifest.json nao encontrado no arquivo do modpack");
  }
  return {
    zip,
    manifest: JSON.parse(entry.getData().toString("utf8")) as CurseForgeManifest
  };
}
