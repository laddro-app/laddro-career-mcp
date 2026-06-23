import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProtectedResourceMetadata,
  buildWwwAuthenticate,
  getBearerToken,
  isConnectorEnabled,
  isOAuthBearer,
  resolveServerBaseUrl,
} from "../dist/oauth.js";

test("isConnectorEnabled is false unless MCP_CONNECTOR_ENABLED=true", () => {
  const previous = process.env.MCP_CONNECTOR_ENABLED;
  delete process.env.MCP_CONNECTOR_ENABLED;
  assert.equal(isConnectorEnabled(), false);
  process.env.MCP_CONNECTOR_ENABLED = "false";
  assert.equal(isConnectorEnabled(), false);
  process.env.MCP_CONNECTOR_ENABLED = "true";
  assert.equal(isConnectorEnabled(), true);
  if (previous === undefined) {
    delete process.env.MCP_CONNECTOR_ENABLED;
  } else {
    process.env.MCP_CONNECTOR_ENABLED = previous;
  }
});

test("getBearerToken extracts a bearer token, ignores x-api-key", () => {
  assert.equal(getBearerToken({ authorization: "Bearer lad_at_abc " }), "lad_at_abc");
  assert.equal(getBearerToken({ "x-api-key": "laddro_live_key" }), undefined);
});

test("isOAuthBearer only matches lad_at_ prefixed bearer tokens", () => {
  assert.equal(isOAuthBearer({ authorization: "Bearer lad_at_abc" }), true);
  assert.equal(isOAuthBearer({ authorization: "Bearer laddro_live_key" }), false);
  assert.equal(isOAuthBearer({ "x-api-key": "lad_at_abc" }), false);
  assert.equal(isOAuthBearer({}), false);
});

test("buildProtectedResourceMetadata follows RFC 9728 shape", () => {
  const meta = buildProtectedResourceMetadata("https://mcp.laddro.com");
  assert.deepEqual(meta, {
    resource: "https://mcp.laddro.com",
    authorization_servers: ["https://service.laddro.com"],
  });
});

test("buildWwwAuthenticate points at the metadata document", () => {
  assert.equal(
    buildWwwAuthenticate("https://mcp.laddro.com"),
    'Bearer resource_metadata="https://mcp.laddro.com/.well-known/oauth-protected-resource"',
  );
});

test("resolveServerBaseUrl prefers override, then forwarded headers, then host", () => {
  const previous = process.env.MCP_PUBLIC_URL;
  process.env.MCP_PUBLIC_URL = "https://override.example/";
  assert.equal(resolveServerBaseUrl({}, 8080), "https://override.example");
  delete process.env.MCP_PUBLIC_URL;

  assert.equal(
    resolveServerBaseUrl({ "x-forwarded-proto": "https", "x-forwarded-host": "mcp.laddro.com" }, 8080),
    "https://mcp.laddro.com",
  );
  assert.equal(resolveServerBaseUrl({ host: "localhost:8080" }, 8080), "http://localhost:8080");
  assert.equal(resolveServerBaseUrl({ host: "mcp.laddro.com" }, 8080), "https://mcp.laddro.com");

  if (previous !== undefined) {
    process.env.MCP_PUBLIC_URL = previous;
  }
});
