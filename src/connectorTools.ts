import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { resumeSchema } from "./generated/resumeSchema.js";
import { SCOPES } from "./oauth.js";

// MCP inputSchema must be a concrete top-level object schema. The bundled
// resumeSchema is a $ref to #/$defs/Resume, so expose the Resume fields at the
// top level and carry the component $defs alongside for $ref resolution.
const resumeDef = resumeSchema.$defs.Resume as unknown as {
  properties?: Record<string, unknown>;
  required?: readonly string[];
};
const resumeInputSchema = {
  type: "object",
  properties: resumeDef.properties,
  required: resumeDef.required,
  $defs: resumeSchema.$defs,
} as unknown as Tool["inputSchema"];

// Connector tools are advertised ONLY in OAuth-bearer sessions (Bearer lad_at_*)
// and ONLY when MCP_CONNECTOR_ENABLED=true. They forward to laddro-backend, which
// stores the content and renders the PDF. Each tool carries the scope it needs so
// the tool list can be filtered against the token's granted scopes.
//
// Shared mantra across descriptions: "You write the content. Laddro stores it and
// renders the PDF."

const WRITE_HINTS = { readOnlyHint: false, openWorldHint: false } as const;
const READ_HINTS = { readOnlyHint: true, openWorldHint: false } as const;
const DESTRUCTIVE_HINTS = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

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

// Permissive result envelope for tools whose response shape varies (lists,
// renders, exports). career-api returns JSON; we don't over-constrain it.
const permissiveResultSchema = {
  type: "object" as const,
  description: "career-api JSON response (shape varies by endpoint)",
  additionalProperties: true,
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
    name: "laddro.resume.list",
    description:
      "List the user's resumes (id, title, template, default flag). Use this to discover resumeIds for the get/update/delete/render tools.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Resumes", ...READ_HINTS },
    requiredScope: SCOPES.resumesRead,
  },
  {
    name: "laddro.resume.get",
    description: "Get a single resume by id, including its structured content.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to fetch" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Get Resume", ...READ_HINTS },
    requiredScope: SCOPES.resumesRead,
  },
  {
    name: "laddro.resume.create",
    description:
      "Create a resume. Provide the full resume object conforming to laddro.resume.schema (title, locale, personal, summary, optional sections, etc.). You write the content; Laddro stores it and renders the PDF.",
    inputSchema: resumeInputSchema,
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
      "Update a resume: include the resume's `id` plus the full updated object.",
    inputSchema: resumeInputSchema,
    outputSchema: permissiveResultSchema,
    annotations: { title: "Update Resume", ...WRITE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.delete",
    description: "Permanently delete a resume by id. This cannot be undone.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to delete" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Delete Resume", ...DESTRUCTIVE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.setDefault",
    description: "Mark a resume as the user's default resume.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to set as default" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Set Default Resume", ...WRITE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.changeTemplate",
    description:
      "Change the template of a resume. Use laddro.templates.list to discover valid templateIds.",
    inputSchema: {
      type: "object",
      required: ["resumeId", "templateId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to update" },
        templateId: { type: "string", description: "Template id from laddro.templates.list" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Change Resume Template", ...WRITE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.tailor",
    description:
      "Tailor a resume to a specific job. Provide a positionName plus either a jobDescription or a jobUrl; optionally target an existing resumeId. Laddro stores the tailored resume and can render the PDF.",
    inputSchema: {
      type: "object",
      required: ["positionName"],
      properties: {
        resumeId: {
          type: "string",
          description: "Optional resume UUID to tailor; defaults to the user's resume.",
        },
        positionName: { type: "string", description: "The role/position being applied for" },
        jobDescription: { type: "string", description: "The job description text" },
        jobUrl: { type: "string", description: "URL of the job posting (alternative to jobDescription)" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Tailor Resume", ...WRITE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.exportPdf",
    description:
      "Export a resume to PDF. Provide the resumeId; optionally override template, locale, font, or colorId. Returns the rendered artifact info.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to export" },
        templateId: { type: "string", description: "Optional template id override" },
        locale: { type: "string", description: "Optional locale override" },
        font: { type: "string", description: "Optional font override" },
        colorId: { type: "string", description: "Optional color scheme id override" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Export Resume PDF", ...WRITE_HINTS },
    requiredScope: SCOPES.documentsRender,
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
  {
    name: "laddro.coverLetter.list",
    description: "List the user's cover letters (id, title). Use this to discover coverLetterIds.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Cover Letters", ...READ_HINTS },
    requiredScope: SCOPES.coverLettersRead,
  },
  {
    name: "laddro.coverLetter.get",
    description: "Get a single cover letter by id, including its content.",
    inputSchema: {
      type: "object",
      required: ["coverLetterId"],
      properties: {
        coverLetterId: { type: "string", description: "Cover letter UUID to fetch" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Get Cover Letter", ...READ_HINTS },
    requiredScope: SCOPES.coverLettersRead,
  },
  {
    name: "laddro.coverLetter.create",
    description:
      "Create a cover letter. Provide the applicant's full name and the letter body; Laddro stores it and renders the PDF.",
    inputSchema: {
      type: "object",
      required: ["fullName", "letterContent"],
      properties: {
        fullName: { type: "string", description: "Applicant's full name" },
        letterContent: { type: "string", description: "The cover letter body content" },
        title: { type: "string", description: "Internal title for the cover letter" },
        jobTitle: { type: "string", description: "The role/position being applied for" },
        address: { type: "string", description: "Applicant's address" },
        email: { type: "string", description: "Applicant's email address" },
        phone: { type: "string", description: "Applicant's phone number" },
        companyName: { type: "string", description: "The company being applied to" },
        hiringManager: { type: "string", description: "Name of the hiring manager" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Create Cover Letter", ...WRITE_HINTS },
    requiredScope: SCOPES.coverLettersWrite,
  },
  {
    name: "laddro.coverLetter.generate",
    description:
      "AI-generate a cover letter from the user's resume and a job. Provide a positionName plus either a jobDescription or a jobUrl; optionally target an existing resumeId. Laddro stores the generated cover letter.",
    inputSchema: {
      type: "object",
      required: ["positionName"],
      properties: {
        resumeId: {
          type: "string",
          description: "Optional resume UUID to base the letter on; defaults to the user's resume.",
        },
        positionName: { type: "string", description: "The role/position being applied for" },
        jobDescription: { type: "string", description: "The job description text" },
        jobUrl: { type: "string", description: "URL of the job posting (alternative to jobDescription)" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Generate Cover Letter", ...WRITE_HINTS },
    requiredScope: SCOPES.coverLettersWrite,
  },
  {
    name: "laddro.coverLetter.renderPdf",
    description: "Render a cover letter to PDF by id. Returns the rendered artifact info.",
    inputSchema: {
      type: "object",
      required: ["coverLetterId"],
      properties: {
        coverLetterId: { type: "string", description: "Cover letter UUID to render" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Render Cover Letter PDF", ...WRITE_HINTS },
    requiredScope: SCOPES.documentsRender,
  },
  {
    name: "laddro.templates.list",
    description: "List the available resume/cover-letter templates and their color schemes.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Templates", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.fonts.list",
    description: "List the available document fonts.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Fonts", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.languages.list",
    description: "List the supported document languages/locales.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Languages", ...READ_HINTS },
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
