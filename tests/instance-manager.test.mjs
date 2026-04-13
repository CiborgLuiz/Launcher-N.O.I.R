import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

test("loadInstallState recovers from truncated json", async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "noir-home-"));
  const previousHome = process.env.HOME;
  process.env.HOME = tempHome;

  const require = createRequire(import.meta.url);
  const instanceManager = require("../dist/packages/instance-manager/src/index.js");
  const shared = require("../dist/packages/shared/src/index.js");

  const paths = instanceManager.getLauncherPaths();
  await fs.ensureDir(path.dirname(paths.installStatePath));
  await fs.writeFile(paths.installStatePath, '{"state":"syncing"', "utf8");

  const state = await instanceManager.loadInstallState(paths);
  assert.equal(state.state, shared.createDefaultInstallState().state);

  const recovered = await fs.readJson(paths.installStatePath);
  assert.equal(recovered.state, shared.createDefaultInstallState().state);

  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }
});
