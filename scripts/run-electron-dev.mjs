import { spawn } from "node:child_process";

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["electron", "."],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL || "http://localhost:5173"
    }
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
