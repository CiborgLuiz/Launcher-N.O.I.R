import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { planModpackUpdate, buildModpackLock } = require("../dist/packages/launcher-runtime/src/planner.js");

test("planModpackUpdate classifies additions and removals", () => {
  const current = {
    projectId: 1,
    fileId: 10,
    fileName: "old.zip",
    versionLabel: "1.0.0",
    minecraftVersion: "1.20.1",
    modLoader: "forge",
    modLoaderVersion: "47.2.0",
    generatedAt: new Date().toISOString(),
    files: [
      { projectId: 100, fileId: 1, required: true, fileName: "a.jar" },
      { projectId: 200, fileId: 2, required: true, fileName: "b.jar" }
    ]
  };

  const next = {
    ...current,
    fileId: 11,
    files: [
      { projectId: 100, fileId: 1, required: true },
      { projectId: 300, fileId: 3, required: true }
    ]
  };

  const plan = planModpackUpdate(current, next);
  assert.equal(plan.additions.length, 1);
  assert.equal(plan.additions[0].projectId, 300);
  assert.equal(plan.removals.length, 1);
  assert.equal(plan.removals[0].fileName, "b.jar");
  assert.equal(plan.retained.length, 1);
});

test("buildModpackLock maps manifest files", () => {
  const lock = buildModpackLock(
    1483856,
    {
      id: 1000,
      fileName: "pack.zip",
      displayName: "Pack",
      fileDate: new Date().toISOString(),
      downloadCount: 1,
      releaseType: 1
    },
    {
      minecraft: {
        version: "1.20.1",
        modLoaders: [{ id: "forge-47.2.0", primary: true }]
      },
      manifestVersion: 1,
      name: "NOIR SMP",
      version: "1.0.0",
      author: "NOIR",
      overrides: "overrides",
      files: [{ projectID: 10, fileID: 20, required: true }]
    }
  );

  assert.equal(lock.projectId, 1483856);
  assert.equal(lock.files[0].projectId, 10);
  assert.equal(lock.modLoader, "forge");
});
