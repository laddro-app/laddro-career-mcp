import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { SCOPES } from "./oauth.js";

// Connector tools are advertised ONLY in OAuth-bearer sessions (Bearer lad_at_*)
// and ONLY when MCP_CONNECTOR_ENABLED=true. They forward to laddro-backend, which
// stores the content and renders the PDF. Each tool carries the scope it needs so
// the tool list can be filtered against the token's granted scopes.
//
// Shared mantra across descriptions: "You write the content. Laddro stores it and
// renders the PDF."

const WRITE_HINTS = { readOnlyHint: false, openWorldHint: false } as const;
const READ_HINTS = { readOnlyHint: true, openWorldHint: false } as const;

// The scope a tool requires, or null when it needs no specific scope.
export type ConnectorTool = Tool & { requiredScope: string | null };

const jsonSchemaResultSchema = {
  type: "object" as const,
  description: "A JSON Schema document",
  properties: {
    $id: { type: "string" },
    title: { type: "string" },
    type: { type: "string" },
    properties: { type: "object" },
  },
};

const resumeContentInputSchema = {
  type: "object" as const,
  required: ["content"],
  properties: {
    title: { type: "string", description: "Internal title for the resume" },
    content: {
      type: "object",
      description:
        "Resume content matching laddro.resume.schema. You write the structured content; Laddro stores it.",
    },
  },
};

export const connectorTools: ConnectorTool[] = [
  {
    name: "laddro.resume.schema",
    description:
      "Get the JSON Schema for Laddro resume content. Call this first, then build content that conforms to it. You write the content. Laddro stores it and renders the PDF.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: jsonSchemaResultSchema,
    annotations: { title: "Get Resume Schema", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.resume.create",
    description:
      "Create a new resume from structured content conforming to laddro.resume.schema. Returns the new resumeId. You write the content. Laddro stores it and renders the PDF.",
    inputSchema: resumeContentInputSchema,
    outputSchema: {
      type: "object",
      properties: { resumeId: { type: "string" } },
    },
    annotations: { title: "Create Resume", ...WRITE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.update",
    description:
      "Update an existing resume by full-replacing its content with structured content conforming to laddro.resume.schema. Returns { resumeId, updatedAt }. You write the content. Laddro stores it and renders the PDF.",
    inputSchema: {
      type: "object",
      required: ["resumeId", "content"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to update" },
        title: { type: "string", description: "Internal title for the resume" },
        content: {
          type: "object",
          description: "Resume content matching laddro.resume.schema",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: { resumeId: { type: "string" }, updatedAt: { type: "string" } },
    },
    annotations: { title: "Update Resume", ...WRITE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.coverLetter.schema",
    description:
      "Get the JSON Schema for Laddro cover-letter content. Call this first, then build content that conforms to it. You write the content. Laddro stores it and renders the PDF.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: jsonSchemaResultSchema,
    annotations: { title: "Get Cover Letter Schema", ...READ_HINTS },
    requiredScope: null,
  },
];

// Filter connector tools by the scopes granted on the token. Tools with a null
// requiredScope (the schema tools) are always advertised. See server.ts for how
// scopes are sourced.
export function filterConnectorToolsByScopes(grantedScopes: string[] | null): Tool[] {
  return connectorTools
    .filter((tool) => {
      if (tool.requiredScope === null) {
        return true;
      }
      // When scopes are unknown (null), advertise the full set and let the
      // backend reject with insufficient_scope (surfaced as an MCP error).
      if (grantedScopes === null) {
        return true;
      }
      return grantedScopes.includes(tool.requiredScope);
    })
    .map(({ requiredScope: _requiredScope, ...tool }) => tool);
}
