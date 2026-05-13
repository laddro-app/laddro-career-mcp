import assert from "node:assert/strict";
import test from "node:test";

import { getLaddroApiKey, normalizePath } from "../dist/http.js";

test("getLaddroApiKey prefers x-api-key", () => {
  assert.equal(
    getLaddroApiKey({
      "x-api-key": "laddro_live_header",
      authorization: "Bearer laddro_live_bearer",
    }, "laddro_live_env"),
    "laddro_live_header",
  );
});

test("getLaddroApiKey accepts bearer authorization", () => {
  assert.equal(
    getLaddroApiKey({ authorization: "Bearer laddro_live_bearer   " }),
    "laddro_live_bearer",
  );
});

test("getLaddroApiKey falls back to env key", () => {
  assert.equal(getLaddroApiKey({}, "laddro_live_env"), "laddro_live_env");
});

test("normalizePath keeps root and trims trailing slashes", () => {
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/mcp/"), "/mcp");
  assert.equal(normalizePath("/mcp///"), "/mcp");
});
