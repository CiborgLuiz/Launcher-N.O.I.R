import fs from "fs-extra";
import path from "node:path";
import { getLauncherPaths, LauncherPaths } from "../../instance-manager/src";

type SecretStoreShape = Record<string, string>;

async function loadKeytar() {
  try {
    // keytar may be unavailable on some Linux environments without the native backend.
    // Dynamic loading keeps the rest of the launcher functional.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const keytar = require("keytar") as typeof import("keytar");
    return keytar;
  } catch {
    return null;
  }
}

async function readFallbackSecrets(filePath: string): Promise<SecretStoreShape> {
  if (!(await fs.pathExists(filePath))) {
    return {};
  }
  return (await fs.readJson(filePath)) as SecretStoreShape;
}

async function writeFallbackSecrets(filePath: string, secrets: SecretStoreShape): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, secrets, { spaces: 2 });
}

export class SecretVault {
  private readonly serviceName = "noir-launcher";
  private readonly fallbackPath: string;
  private readonly paths: LauncherPaths;

  constructor(paths = getLauncherPaths()) {
    this.paths = paths;
    this.fallbackPath = path.join(paths.accountsDir, "secrets.json");
  }

  async set(key: string, value: string): Promise<void> {
    const keytar = await loadKeytar();
    if (keytar) {
      await keytar.setPassword(this.serviceName, key, value);
      return;
    }

    const secrets = await readFallbackSecrets(this.fallbackPath);
    secrets[key] = value;
    await writeFallbackSecrets(this.fallbackPath, secrets);
  }

  async get(key: string): Promise<string | null> {
    const keytar = await loadKeytar();
    if (keytar) {
      return keytar.getPassword(this.serviceName, key);
    }

    const secrets = await readFallbackSecrets(this.fallbackPath);
    return secrets[key] || null;
  }

  async delete(key: string): Promise<void> {
    const keytar = await loadKeytar();
    if (keytar) {
      await keytar.deletePassword(this.serviceName, key);
      return;
    }

    const secrets = await readFallbackSecrets(this.fallbackPath);
    delete secrets[key];
    await writeFallbackSecrets(this.fallbackPath, secrets);
  }
}
