import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "app-builder-lib",
  "out",
  "node-module-collector",
  "nodeModulesCollector.js"
);

const original = await fs.readFile(targetPath, "utf8");
const from = "                shell: true, // `true`` is now required: https://github.com/electron-userland/electron-builder/issues/9488";
const to = "                shell: process.platform === \"win32\", // keep shell only on Windows where electron-builder needs the cmd shim";

if (!original.includes(from) && original.includes(to)) {
  process.exit(0);
}

if (!original.includes(from)) {
  throw new Error(`Trecho esperado nao encontrado em ${targetPath}`);
}

await fs.writeFile(targetPath, original.replace(from, to), "utf8");

