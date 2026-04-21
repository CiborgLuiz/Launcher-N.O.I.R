import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildForgeInstallerUrls,
  getForgeVersionCachePath,
  invalidateStaleForgeVersionCache,
  resolveForgeArtifactVersion,
  resolveForgeJvmArgs
} = require("../dist/packages/launcher-runtime/src/forge.js");

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

test("resolveForgeJvmArgs expands Forge placeholders for the current launcher paths", () => {
  const args = resolveForgeJvmArgs(
    {
      id: "1.20.1-forge-47.4.20",
      arguments: {
        jvm: [
          "-DlibraryDirectory=${library_directory}",
          "-p",
          "${library_directory}/cpw/mods/bootstraplauncher/1.1.2/bootstraplauncher-1.1.2.jar${classpath_separator}${library_directory}/org/ow2/asm/asm/9.8/asm-9.8.jar",
          "--add-opens",
          "java.base/java.lang.invoke=cpw.mods.securejarhandler",
          "-DignoreList=forge-,${version_name}.jar"
        ]
      }
    },
    "/tmp/noir-libraries"
  );

  assert.deepEqual(args, [
    "-DlibraryDirectory=/tmp/noir-libraries",
    "-p",
    `/tmp/noir-libraries/cpw/mods/bootstraplauncher/1.1.2/bootstraplauncher-1.1.2.jar${path.delimiter}/tmp/noir-libraries/org/ow2/asm/asm/9.8/asm-9.8.jar`,
    "--add-opens",
    "java.base/java.lang.invoke=cpw.mods.securejarhandler",
    "-DignoreList=forge-,1.20.1-forge-47.4.20.jar"
  ]);
});

test("invalidateStaleForgeVersionCache removes cached Forge json from a different mod loader version", async () => {
  const tempGameRoot = await fs.mkdtemp(path.join(os.tmpdir(), "noir-forge-cache-"));
  const paths = { gameDir: tempGameRoot };
  const logger = { log: async () => undefined };
  const cachePath = getForgeVersionCachePath(paths, "1.20.1");

  await fs.ensureDir(path.dirname(cachePath));
  await fs.writeJson(cachePath, { id: "1.20.1-forge-47.4.10" }, { spaces: 2 });

  await invalidateStaleForgeVersionCache("1.20.1", "1.20.1-forge-47.4.20", paths, logger);

  assert.equal(await fs.pathExists(cachePath), false);
});
