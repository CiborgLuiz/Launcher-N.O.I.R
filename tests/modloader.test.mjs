import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseModLoader } = require("../dist/packages/launcher-runtime/src/modloader.js");

test("parseModLoader resolves forge id", () => {
  const parsed = parseModLoader([{ id: "forge-47.2.0", primary: true }]);
  assert.deepEqual(parsed, { type: "forge", version: "47.2.0" });
});

test("parseModLoader normalizes NeoForge", () => {
  const parsed = parseModLoader([{ id: "neoForge-21.0.11-beta", primary: true }]);
  assert.deepEqual(parsed, { type: "neoforge", version: "21.0.11-beta" });
});
