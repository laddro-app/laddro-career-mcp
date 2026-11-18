import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { Laddro } from "@laddro/career-sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { createConnectorHandlers, isConnectorTool } from "./connectorHandlers.js";
import { filterConnectorToolsByScopes } from "./connectorTools.js";
import { createHandlers } from "./handlers.js";
import { getLaddroApiKey, normalizePath } from "./http.js";
import {
  buildProtectedResourceMetadata,
  buildWwwAuthenticate,
  getBearerToken,
  isConnectorEnabled,
  isOAuthBearer,
  PROTECTED_RESOURCE_PATH,
  resolveServerBaseUrl,
} from "./oauth.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { isTokenRejected } from "./rejectedTokens.js";
import { logMcp, tokenRef } from "./requestLog.js";
import { tools } from "./tools.js";
import { version } from "./version.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const baseUrl = process.env.LADDRO_BASE_URL;

// Issued by the OpenAI app submission portal for mcp.laddro.com (app
// asdk_app_6aa33a86bdfc8191aa20021d5f1ccdae).
const OPENAI_APPS_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";
const OPENAI_APPS_CHALLENGE_TOKEN = "2AHHCzqxbtqteukqI10BU_TSEGXX7q7ZJY4UVLZOESo";

// ⚠️ STATELESS on purpose (2026-11-17). Sessions used to live in an in-memory
// Map on a scale-to-zero Cloud Run service with up to 3 instances and no
// affinity, so a session vanished whenever an instance stopped or a request
// landed elsewhere, and the SDK answered the next call with 400 (the spec's
// "session gone, re-initialize" signal is 404). 11-14..17: 361 of 1,519 Claude
// requests hit that, 146 were never retried. Nothing here needs a session: the
// tools are stateless and the bearer is read per request. So every POST gets
// its own server + transport and there is nothing to lose.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = normalizePath(url.pathname);

  // Security headers on every response (ChatGPT Apps SDK submission requires a
  // CSP). This is a JSON/tools-only API that serves no HTML, scripts, or
  // iframes, so the strictest policy is correct: deny everything + no framing.
  setSecurityHeaders(res);

  // Health check for Cloud Run
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // ChatGPT Apps domain verification. OpenAI fetches this URL during app
  // submission and expects the exact token as a plain-text body. The token is
  // public by design (it only proves domain ownership to OpenAI).
  if (req.method === "GET" && pathname === OPENAI_APPS_CHALLENGE_PATH) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(OPENAI_APPS_CHALLENGE_TOKEN);
    return;
  }

  // OAuth 2.0 Protected Resource Metadata (RFC 9728). Only served when the
  // connector is enabled; otherwise the server behaves exactly as before.
  if (req.method === "GET" && pathname === PROTECTED_RESOURCE_PATH) {
    if (!isConnectorEnabled()) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    const resourceUrl = resolveServerBaseUrl(req.headers, PORT);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buildProtectedResourceMetadata(resourceUrl)));
    return;
  }

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      name: "laddro-career",
      version,
      transport: "streamable-http",
      endpoint: "/mcp",
    }));
    return;
  }

  // MCP endpoint
  if (pathname === "/mcp") {
    const ua = req.headers["user-agent"];

    // Stateless: there is no server-to-client stream to open and no session
    // to delete. 405 is what the spec prescribes for a GET we do not offer.
    if (req.method === "GET" || req.method === "DELETE") {
      res.writeHead(405, { "Content-Type": "application/json", Allow: "POST" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    if (req.method === "POST") {
      const started = Date.now();
      const presented = getBearerToken(req.headers);
      const tok = tokenRef(presented);

      // A token career-api already refused gets a 401 here, so the client
      // refreshes it instead of retrying the dead one. See rejectedTokens.ts.
      if (isOAuthBearer(req.headers) && presented && isTokenRejected(presented)) {
        const resourceUrl = resolveServerBaseUrl(req.headers, PORT);
        res.writeHead(401, {
          "Content-Type": "application/json",
          "WWW-Authenticate": `${buildWwwAuthenticate(resourceUrl)}, error="invalid_token"`,
        });
        res.end(JSON.stringify({ error: "invalid_token", error_description: "Access token is expired or invalid" }));
        logMcp("mcp_request", { status: 401, reason: "rejected_token", tok, ua });
        return;
      }

      const connectorEnabled = isConnectorEnabled();
      const oauthSession = connectorEnabled && isOAuthBearer(req.headers);

      // Connector mode: a request with no usable credential at all gets a 401
      // with WWW-Authenticate so OAuth clients can discover the AS and connect.
      // (x-api-key / non-OAuth bearer requests keep the legacy career-api path.)
      if (connectorEnabled && !oauthSession) {
        const apiKey = getLaddroApiKey(req.headers, process.env.LADDRO_API_KEY || "");
        if (!apiKey) {
          const resourceUrl = resolveServerBaseUrl(req.headers, PORT);
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate": buildWwwAuthenticate(resourceUrl),
          });
          res.end(JSON.stringify({ error: "unauthorized", error_description: "OAuth or API key required" }));
          logMcp("mcp_request", { status: 401, reason: "no_credential", ua });
          return;
        }
      }

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (error: unknown) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
        logMcp("mcp_request", { status: 400, reason: error instanceof Error ? error.message : "parse_error", tok, ua });
        return;
      }

      const messages = Array.isArray(body) ? body : [body];
      const methods = messages.map((m) => (m as { method?: string })?.method ?? "response");
      const toolNames = messages
        .filter((m) => (m as { method?: string })?.method === "tools/call")
        .map((m) => (m as { params?: { name?: string } }).params?.name);

      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = new Server(
        { name: "laddro-career", version },
        {
          capabilities: { tools: {}, resources: {}, prompts: {} },
          // Names the connector tools, so only connector sessions get it; the
          // API-key session exposes a different tool set (tools.ts).
          ...(oauthSession ? { instructions: SERVER_INSTRUCTIONS } : {}),
        },
      );

      if (oauthSession) {
        wireOAuthSession(server, () => presented ?? "", tok);
      } else {
        wireApiKeySession(server, req.headers);
      }

      res.on("close", () => {
        logMcp("mcp_request", {
          status: res.statusCode,
          methods,
          ...(toolNames.length ? { tools: toolNames } : {}),
          clientName: clientNameOf(messages),
          auth: oauthSession ? "oauth" : "api_key",
          tok,
          ua,
          ms: Date.now() - started,
        });
        void transport.close();
        void server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
});

// Restrictive security headers for a JSON/tools-only MCP API. Set before any
// branch so they apply to health, discovery, MCP, and error responses alike.
// (Node merges these with per-response writeHead headers; no key collides.)
function setSecurityHeaders(res: ServerResponse) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
}

// Legacy/API-key session: x-api-key or non-OAuth bearer → career-api via SDK.
// Behaves exactly as before the connector existed.
function wireApiKeySession(server: Server, headers: import("node:http").IncomingHttpHeaders) {
  const apiKey = getLaddroApiKey(headers, process.env.LADDRO_API_KEY || "");
  const handler = apiKey ? createHandlers(createClient(apiKey)) : createMissingKeyHandler();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const started = Date.now();
    try {
      const result = await handler(name, args as Record<string, unknown>);
      logMcp("mcp_tool", { tool: name, auth: "api_key", isError: Boolean(result.isError), ms: Date.now() - started });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logMcp("mcp_tool", { tool: name, auth: "api_key", isError: true, error: message.slice(0, 200), ms: Date.now() - started });
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });
}

// OAuth-bearer session (Bearer lad_at_*): connector tools forward to backend.
// We have no token introspection here (per spec the backend validates tokens
// in-process and has no /oauth/introspect). So we advertise the full connector
// tool set (scopes = null) and let the backend reject scope-violating calls with
// insufficient_scope, which we surface as an MCP tool error. We also keep the
// read-only career-api tools that work without an API key off the OAuth list —
// the OAuth session only exposes connector tools (backend-backed).
function wireOAuthSession(server: Server, bearerToken: () => string, tok?: string) {
  const grantedScopes: string[] | null = null; // no introspection; see comment above.
  const connectorToolList = filterConnectorToolsByScopes(grantedScopes);
  const connectorHandler = createConnectorHandlers(bearerToken);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: connectorToolList }));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    if (!isConnectorTool(name)) {
      logMcp("mcp_tool", { tool: name, isError: true, error: "not_a_connector_tool", tok });
      return {
        content: [{ type: "text", text: `Tool ${name} is not available in an OAuth connector session.` }],
        isError: true,
      };
    }
    const started = Date.now();
    const result = await connectorHandler(name, args as Record<string, unknown>);
    logMcp("mcp_tool", {
      tool: name,
      isError: Boolean(result.isError),
      ...(result.isError ? { error: firstText(result).slice(0, 200) } : {}),
      tok,
      ms: Date.now() - started,
    });
    return result;
  });
}

function createClient(apiKey: string) {
  return new Laddro({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

function createMissingKeyHandler() {
  return async () => ({
    content: [{
      type: "text" as const,
      text: "Missing Laddro API key. For HTTP MCP, send Authorization: Bearer <laddro key> or x-api-key on the initialize request. For stdio, set LADDRO_API_KEY.",
    }],
    isError: true,
  });
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

// The client's self-reported name on initialize (e.g. "claude-ai"), so a log
// line says which assistant connected, not only its HTTP user agent.
function clientNameOf(messages: unknown[]): string | undefined {
  for (const m of messages) {
    const params = (m as { method?: string; params?: { clientInfo?: { name?: string } } });
    if (params?.method === "initialize") return params.params?.clientInfo?.name;
  }
  return undefined;
}

function firstText(result: { content?: unknown }): string {
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content.find((c: { type?: string }) => c?.type === "text") as { text?: string } | undefined;
  return text?.text ?? "";
}
