import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

test("buildMicrosoftAuthUrl rejects missing client id", async () => {
  const previousClientId = process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_ID;

  const require = createRequire(import.meta.url);
  const microsoft = require("../dist/packages/auth/src/microsoft.js");

  assert.throws(
    () => microsoft.buildMicrosoftAuthUrl("http://127.0.0.1:53682/callback", "challenge"),
    /MICROSOFT_CLIENT_ID nao configurado/
  );

  if (previousClientId === undefined) {
    delete process.env.MICROSOFT_CLIENT_ID;
  } else {
    process.env.MICROSOFT_CLIENT_ID = previousClientId;
  }
});
