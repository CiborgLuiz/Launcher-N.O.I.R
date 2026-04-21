import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

test("NoirLauncherService recovers a stale launching state during initialize", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "noir-service-home-"));
  const tempConfigPath = path.join(tempHome, "launcher.config.json");
  const previousHome = process.env.HOME;

  process.env.HOME = tempHome;

  try {
    await fs.writeJson(
      tempConfigPath,
      {
        modpackName: "NOIR SMP",
        curseforgeProjectId: 1483856,
        minecraftVersion: "1.20.1",
        modLoader: "forge",
        modLoaderVersion: "47.4.10",
        minimumRamMb: 4096,
        recommendedRamMb: 6144,
        javaVersionRequired: 17,
        branding: {
          applicationName: "NOIR Launcher",
          productName: "NOIR SMP",
          shortName: "NOIR",
          tagline: "Launcher dedicado",
          accent: "#C7A24A",
          background: "#090806"
        }
      },
      { spaces: 2 }
    );

    const require = createRequire(import.meta.url);
    const { NoirLauncherService } = require("../dist/packages/core/src/noir-service.js");
    const { getLauncherPaths } = require("../dist/packages/instance-manager/src/index.js");

    const paths = getLauncherPaths();
    await fs.ensureDir(path.dirname(paths.installStatePath));
    await fs.writeJson(
      paths.installStatePath,
      {
        state: "launching",
        message: "Preparando inicializacao do Minecraft",
        progress: 100,
        totalPlayedMs: 0,
        currentStep: "launch",
        lastSyncedAt: "2026-04-21T22:15:46.734Z"
      },
      { spaces: 2 }
    );

    const service = new NoirLauncherService({
      appVersion: "0.2.0-test",
      configPath: tempConfigPath
    });

    const snapshot = await service.initialize();
    assert.equal(snapshot.installState.state, "ready");
    assert.equal(snapshot.installState.message, "Abertura anterior interrompida. Pronto para tentar novamente.");

    const persistedState = await fs.readJson(paths.installStatePath);
    assert.equal(persistedState.state, "ready");
    assert.equal(persistedState.currentStep, "ready");
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
  }
});
