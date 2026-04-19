import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildAvatarUrl, buildAvatarCandidates } = require("../dist/packages/auth/src/accounts.js");

test("buildAvatarUrl prefers mc-heads when uuid is available", () => {
  const url = buildAvatarUrl("CiborgLuiz", undefined, "74b9f747969a4f3d98fe0a69cc2a27c5");
  assert.equal(url, "https://mc-heads.net/avatar/74b9f747969a4f3d98fe0a69cc2a27c5/128");
});

test("buildAvatarCandidates keeps crafatar only as fallback", () => {
  const urls = buildAvatarCandidates({
    username: "CiborgLuiz",
    uuid: "74b9f747969a4f3d98fe0a69cc2a27c5",
    explicitUrl: "https://crafatar.com/avatars/74b9f747969a4f3d98fe0a69cc2a27c5?size=128&overlay"
  });

  assert.equal(urls[0], "https://mc-heads.net/avatar/74b9f747969a4f3d98fe0a69cc2a27c5/128");
  assert.equal(urls.at(-1), "https://crafatar.com/avatars/74b9f747969a4f3d98fe0a69cc2a27c5?size=128&overlay");
});
