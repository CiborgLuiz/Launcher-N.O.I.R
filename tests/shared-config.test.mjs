import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createDefaultSettings,
  parseLauncherConfig,
  parseLauncherSettings
} = require("../dist/packages/shared/src/index.js");

test("parseLauncherConfig validates the launcher shape", () => {
  const config = parseLauncherConfig({
    modpackName: "NOIR SMP",
    curseforgeProjectId: 1483856,
    minecraftVersion: "1.20.1",
    modLoader: "forge",
    modLoaderVersion: "47.2.0",
    minimumRamMb: 4096,
    recommendedRamMb: 6144,
    javaVersionRequired: 17,
    branding: {
      applicationName: "NOIR Launcher",
      productName: "NOIR SMP",
      shortName: "NOIR",
      tagline: "Launcher dedicado",
      accent: "#3F00FF",
      background: "#0A0A0A"
    }
  });

  assert.equal(config.modLoader, "forge");
  assert.equal(config.branding.shortName, "NOIR");
});

test("parseLauncherSettings merges overrides with defaults", () => {
  const defaults = createDefaultSettings(
    {
      modpackName: "NOIR SMP",
      curseforgeProjectId: 1483856,
      minecraftVersion: "1.20.1",
      modLoader: "forge",
      modLoaderVersion: "47.2.0",
      minimumRamMb: 4096,
      recommendedRamMb: 6144,
      javaVersionRequired: 17,
      branding: {
        applicationName: "NOIR Launcher",
        productName: "NOIR SMP",
        shortName: "NOIR",
        tagline: "Launcher dedicado",
        accent: "#3F00FF",
        background: "#0A0A0A"
      }
    },
    "/tmp/.noirlauncher/noir-smp"
  );

  const parsed = parseLauncherSettings(
    {
      maximumRamMb: 8192,
      resolutionWidth: 1920,
      resolutionHeight: 1080,
      fullscreen: true,
      autoUpdateLauncher: false,
      autoUpdateModpack: true,
      updateChannel: "beta",
      telemetryEnabled: false,
      javaPath: "/usr/bin/java",
      instanceDirectory: "/tmp/.noirlauncher/noir-smp"
    },
    defaults
  );

  assert.equal(parsed.maximumRamMb, 8192);
  assert.equal(parsed.updateChannel, "beta");
  assert.equal(parsed.fullscreen, true);
});
