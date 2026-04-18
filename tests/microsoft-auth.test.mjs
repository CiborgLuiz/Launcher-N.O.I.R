import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const redirectUri = "http://127.0.0.1:53682/callback";

function loadMicrosoftModule() {
  const require = createRequire(import.meta.url);
  return require("../dist/packages/auth/src/microsoft.js");
}

test("buildMicrosoftAuthUrl falls back to MSMC default app when MICROSOFT_CLIENT_ID is missing", async () => {
  const previousClientId = process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_ID;

  const microsoft = loadMicrosoftModule();
  const authUrl = microsoft.buildMicrosoftAuthUrl(redirectUri);

  assert.match(authUrl, /client_id=00000000402b5328/);
  assert.match(authUrl, new RegExp(`redirect_uri=${encodeURIComponent(redirectUri)}`));

  if (previousClientId === undefined) {
    delete process.env.MICROSOFT_CLIENT_ID;
  } else {
    process.env.MICROSOFT_CLIENT_ID = previousClientId;
  }
});

test("buildMicrosoftAuthUrl uses custom MICROSOFT_CLIENT_ID when provided", async () => {
  const previousClientId = process.env.MICROSOFT_CLIENT_ID;
  process.env.MICROSOFT_CLIENT_ID = "test-client-id";

  const microsoft = loadMicrosoftModule();
  const authUrl = microsoft.buildMicrosoftAuthUrl(redirectUri);

  assert.match(authUrl, /client_id=test-client-id/);
  assert.match(authUrl, new RegExp(`redirect_uri=${encodeURIComponent(redirectUri)}`));

  if (previousClientId === undefined) {
    delete process.env.MICROSOFT_CLIENT_ID;
  } else {
    process.env.MICROSOFT_CLIENT_ID = previousClientId;
  }
});
