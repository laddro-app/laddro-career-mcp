import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";

import { Laddro } from "@laddro/career-sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { createHandlers } from "./handlers.js";
import { tools } from "./tools.js";

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

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      name: "laddro-career",
      version: "0.3.0",
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

      // New session — create transport + server
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = new Server(
        { name: "laddro-career", version: "0.3.0" },
        { capabilities: { tools: {}, resources: {}, prompts: {} } },
      );
      const apiKey = getLaddroApiKey(req);
      const handler = apiKey
        ? createHandlers(createClient(apiKey))
        : createMissingKeyHandler();

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

function getLaddroApiKey(req: IncomingMessage) {
  const headerKey = getHeaderValue(req.headers["x-api-key"]);
  if (headerKey) {
    return headerKey;
  }

  const authorization = getHeaderValue(req.headers.authorization);
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  return process.env.LADDRO_API_KEY || "";
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePath(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.replace(/\/+$/, "");
}
