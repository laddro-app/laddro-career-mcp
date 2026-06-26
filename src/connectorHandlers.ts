import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { CareerApiClient, CareerApiError } from "./careerApiClient.js";
import { resolveCoverLetterSchema, resolveResumeSchema } from "./schemas.js";

const CONNECTOR_TOOL_NAMES = new Set([
  "laddro.resume.schema",
  "laddro.resume.create",
  "laddro.resume.update",
  "laddro.coverLetter.schema",
]);

export function isConnectorTool(name: string) {
  return CONNECTOR_TOOL_NAMES.has(name);
}

// Handlers for the OAuth connector tools. They call laddro-backend with the
// forwarded Bearer token. The backend authenticates, checks scopes, and applies
// feature-gate entitlements; we surface its errors (incl. insufficient_scope and
// 403 upgrade-required) as MCP tool errors.
export function createConnectorHandlers(bearerToken: string) {
  const backend = new CareerApiClient(bearerToken);

  return async (name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      switch (name) {
        case "laddro.resume.schema": {
          const schema = await resolveResumeSchema(backend);
          return json(schema);
        }
        case "laddro.coverLetter.schema": {
          const schema = await resolveCoverLetterSchema(backend);
          return json(schema);
        }
        case "laddro.resume.create": {
          const result = await backend.createResume(buildResumeBody(args));
          return json(result);
        }
        case "laddro.resume.update": {
          const resumeId = args.resumeId as string;
          const result = await backend.updateResume(resumeId, buildResumeBody(args));
          return json(result);
        }
        default:
          return { content: [{ type: "text", text: `Unknown connector tool: ${name}` }], isError: true };
      }
    } catch (error: unknown) {
      return toToolError(error);
    }
  };
}

function buildResumeBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { content: args.content };
  if (args.title !== undefined) {
    body.title = args.title;
  }
  return body;
}

function toToolError(error: unknown): CallToolResult {
  if (error instanceof CareerApiError) {
    // Map insufficient_scope / forbidden / unauthorized to a readable MCP error.
    const code = errorCode(error);
    const text = code ? `${code}: ${error.message}` : error.message;
    return { content: [{ type: "text", text }], isError: true };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: message }], isError: true };
}

function errorCode(error: CareerApiError): string | undefined {
  if (error.body && typeof error.body === "object") {
    const body = error.body as Record<string, unknown>;
    if (typeof body.error === "string") {
      return body.error;
    }
    if (typeof body.code === "string") {
      return body.code;
    }
  }
  if (error.status === 403) {
    return "forbidden";
  }
  if (error.status === 401) {
    return "unauthorized";
  }
  return undefined;
}

function json(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: toStructured(data),
  };
}

function toStructured(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { value: data };
}
