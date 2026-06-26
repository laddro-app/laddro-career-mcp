import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

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
import { tools } from "./tools.js";
import { version } from "./version.js";

const PORT = parseInt(process.env.PORT || "8080", 10);
const baseUrl = process.env.LADDRO_BASE_URL;

const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = normalizePath(url.pathname);

  // Health check for Cloud Run
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
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
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "GET" || req.method === "DELETE") {
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No active session" }));
        return;
      }
      await transport.handleRequest(req, res);
      if (req.method === "DELETE") {
        transports.delete(sessionId!);
      }
      return;
    }

    if (req.method === "POST") {
      // Check if this is an existing session
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
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
          return;
        }
      }

      // New session — create transport + server
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = new Server(
        { name: "laddro-career", version },
        { capabilities: { tools: {}, resources: {}, prompts: {} } },
      );

      if (oauthSession) {
        wireOAuthSession(server, getBearerToken(req.headers)!);
      } else {
        wireApiKeySession(server, req.headers);
      }

      await server.connect(transport);

      // Store transport by session ID after initialization handles the request
      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      await transport.handleRequest(req, res);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
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
    try {
      return await handler(name, args as Record<string, unknown>);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
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
function wireOAuthSession(server: Server, bearerToken: string) {
  const grantedScopes: string[] | null = null; // no introspection; see comment above.
  const connectorToolList = filterConnectorToolsByScopes(grantedScopes);
  const connectorHandler = createConnectorHandlers(bearerToken);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: connectorToolList }));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    if (!isConnectorTool(name)) {
      return {
        content: [{ type: "text", text: `Tool ${name} is not available in an OAuth connector session.` }],
        isError: true,
      };
    }
    return connectorHandler(name, args as Record<string, unknown>);
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
