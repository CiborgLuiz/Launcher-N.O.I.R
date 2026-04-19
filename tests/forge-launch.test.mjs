import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildForgeInstallerUrls, resolveForgeArtifactVersion } = require("../dist/packages/launcher-runtime/src/forge.js");

test("resolveForgeArtifactVersion prefixes minecraft version when needed", () => {
  assert.equal(resolveForgeArtifactVersion("1.20.1", "47.4.10"), "1.20.1-47.4.10");
});

test("resolveForgeArtifactVersion preserves fully qualified forge versions", () => {
  assert.equal(resolveForgeArtifactVersion("1.20.1", "1.20.1-47.4.10"), "1.20.1-47.4.10");
});

test("buildForgeInstallerUrls generates the official installer path", () => {
  const urls = buildForgeInstallerUrls("1.20.1", "47.4.10");
  assert.deepEqual(urls, [
    "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar",
    "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar",
    "https://files.minecraftforge.net/maven/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-installer.jar"
  ]);
});
