#!/usr/bin/env node

import { Laddro } from "@laddro/career-sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { createHandlers } from "./handlers.js";
import { tools } from "./tools.js";

const apiKey = process.env.LADDRO_API_KEY || "";
const baseUrl = process.env.LADDRO_BASE_URL;

const client = new Laddro({
  apiKey,
  ...(baseUrl ? { baseUrl } : {}),
});

const handler = createHandlers(client);

const server = new Server(
  { name: "laddro-career", version: "0.2.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

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

const transport = new StdioServerTransport();
await server.connect(transport);
