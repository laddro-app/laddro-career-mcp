import type { IncomingHttpHeaders } from "node:http";

// The Laddro OAuth 2.1 authorization server lives in laddro-backend.
// MCP connector OAuth tools forward the Bearer token to this issuer.
export const AUTHORIZATION_SERVER = "https://service.laddro.com";

// Backend base URL for OAuth (the Authorization Server: discovery + token).
// Overridable for local/staging via env.
export function getBackendBaseUrl() {
  return process.env.LADDRO_BACKEND_URL || AUTHORIZATION_SERVER;
}

// Resource base URL the connector tools call for the actual resume/cover-letter
// operations. career-api (api.laddro.com) is Laddro's single external API: it
// accepts the user's `Bearer lad_at_*` OAuth token (validated against the shared
// oauth_tokens table) exactly as it accepts a developer x-api-key. The backend
// only issues the token; it never sees the resource call. Overridable via env
// (e.g. http://localhost:8082 locally).
export function getResourceBaseUrl() {
  return process.env.LADDRO_CAREER_API_URL || "https://api.laddro.com";
}

// Opaque OAuth access tokens minted by the backend AS are prefixed `lad_at_`.
// Career-API developer keys use a different prefix, so this is how we route a
// request to the backend (OAuth session) vs career-api (API-key session).
const OAUTH_ACCESS_TOKEN_PREFIX = "lad_at_";

export const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

// Scopes the connector understands (v1 set; `profile:read` dropped per spec §5).
export const SCOPES = {
  resumesRead: "resumes:read",
  resumesWrite: "resumes:write",
  coverLettersRead: "coverletters:read",
  coverLettersWrite: "coverletters:write",
  documentsRender: "documents:render",
} as const;

export function isConnectorEnabled() {
  return process.env.MCP_CONNECTOR_ENABLED === "true";
}

// Extracts a raw `Authorization: Bearer <token>` value (no x-api-key fallback).
export function getBearerToken(headers: IncomingHttpHeaders) {
  const authorization = getHeaderValue(headers.authorization);
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

// True when the request is an OAuth-session call (Bearer lad_at_*), as opposed
// to an x-api-key / career-api developer-key call.
export function isOAuthBearer(headers: IncomingHttpHeaders) {
  const token = getBearerToken(headers);
  return Boolean(token && token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX));
}

// RFC 9728 protected-resource metadata. `resource` is this MCP server's own URL.
export function buildProtectedResourceMetadata(resourceUrl: string) {
  return {
    resource: resourceUrl,
    authorization_servers: [AUTHORIZATION_SERVER],
  };
}

// RFC 9728 §5.1 — points the client at our metadata document so it can discover
// the authorization server and start the OAuth flow.
export function buildWwwAuthenticate(resourceUrl: string) {
  const metadataUrl = `${resourceUrl}${PROTECTED_RESOURCE_PATH}`;
  return `Bearer resource_metadata="${metadataUrl}"`;
}

// Resolve this server's externally-visible base URL (scheme + host, no path),
// preferring an explicit env override, then forwarded headers, then Host.
export function resolveServerBaseUrl(headers: IncomingHttpHeaders, fallbackPort: number) {
  const override = process.env.MCP_PUBLIC_URL;
  if (override) {
    return override.replace(/\/+$/, "");
  }

  const forwardedProto = getHeaderValue(headers["x-forwarded-proto"]);
  const forwardedHost = getHeaderValue(headers["x-forwarded-host"]);
  const host = forwardedHost || getHeaderValue(headers.host) || `localhost:${fallbackPort}`;
  // Cloud Run / proxies terminate TLS; default to https unless clearly local.
  const proto = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
