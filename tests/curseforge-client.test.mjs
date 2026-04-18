import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCurseForgeCdnUrl, resolveCurseForgeDownloadUrls } = require("../dist/packages/curseforge/src/client.js");

test("buildCurseForgeCdnUrl maps file id into the expected CDN path", () => {
  const url = buildCurseForgeCdnUrl(7743512, "easy_npc_bundle-forge-1.20.1-6.9.0.jar");
  assert.equal(url, "https://edge.forgecdn.net/files/7743/512/easy_npc_bundle-forge-1.20.1-6.9.0.jar");
});

test("resolveCurseForgeDownloadUrls falls back to CDN hosts when downloadUrl is null", () => {
  const urls = resolveCurseForgeDownloadUrls({
    id: 7743512,
    fileName: "easy_npc_bundle-forge-1.20.1-6.9.0.jar",
    downloadUrl: null
  });

  assert.deepEqual(urls, [
    "https://edge.forgecdn.net/files/7743/512/easy_npc_bundle-forge-1.20.1-6.9.0.jar",
    "https://mediafilez.forgecdn.net/files/7743/512/easy_npc_bundle-forge-1.20.1-6.9.0.jar"
  ]);
});
