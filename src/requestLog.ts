import { createHash } from "node:crypto";

// One structured line per MCP request and per tool call, so a connector user's
// session can be read back from Cloud Logging (jsonPayload.event = "mcp_*").
//
// Added 2026-11-17: the server logged nothing per request, so "a user connected
// Claude and never made a resume" could not be told apart from "every call they
// made failed". Join a line to a user with
//   SELECT user_id FROM oauth_tokens WHERE token_hash LIKE '<tok>%'
// `tok` is the first 16 hex chars of sha256(token), the same hash the auth
// server stores, so the token itself never reaches the logs.

export function tokenRef(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export function logMcp(event: string, fields: Record<string, unknown>): void {
  const severity = fields.status && Number(fields.status) >= 500
    ? "ERROR"
    : fields.status && Number(fields.status) >= 400
      ? "WARNING"
      : fields.isError
        ? "WARNING"
        : "INFO";
  console.log(JSON.stringify({ severity, event, ...fields }));
}
