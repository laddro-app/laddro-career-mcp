import { createHash } from "node:crypto";

// Access tokens career-api has refused (invalid, expired or revoked).
//
// ⚠️ A refused token must come back to the client as HTTP 401, not as a tool
// error. A tool error is a 200: the MCP client reads it as "the tool failed"
// and keeps presenting the same dead token, so the user is stuck until they
// start a new chat. A 401 with WWW-Authenticate is the only signal that makes
// an OAuth client refresh. The first call that discovers the token is dead can
// only return a tool error (the response is already a JSON-RPC result); every
// request after it is turned away at the HTTP layer by server.ts.
//
// Only hashes are kept, and the set is bounded: it is a hint, not a store.
const MAX_ENTRIES = 5000;
const rejected = new Set<string>();

const TOKEN_ERROR_CODES = new Set(["invalid_token", "token_expired", "token_revoked"]);

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenErrorCode(code: string | undefined) {
  return code !== undefined && TOKEN_ERROR_CODES.has(code);
}

export function markTokenRejected(token: string) {
  const key = hash(token);
  if (rejected.has(key)) return;
  if (rejected.size >= MAX_ENTRIES) {
    // Sets iterate in insertion order: drop the oldest.
    const oldest = rejected.values().next().value;
    if (oldest !== undefined) rejected.delete(oldest);
  }
  rejected.add(key);
}

export function isTokenRejected(token: string) {
  return rejected.has(hash(token));
}
