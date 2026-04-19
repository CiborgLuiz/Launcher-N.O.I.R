import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const toolsDir = path.join(__dirname, "tooling");

const electronBuilderBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

const env = {
  ...process.env,
  PATH: `${toolsDir}${path.delimiter}${process.env.PATH || ""}`,
  REAL_NPM_NODE: process.execPath,
  REAL_NPM_CLI: process.env.npm_execpath || "",
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-deprecation"].filter(Boolean).join(" ")
};

const child = spawn(electronBuilderBin, process.argv.slice(2), {
  cwd: projectRoot,
  stdio: "inherit",
  env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
