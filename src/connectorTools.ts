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

// Tool annotation hints. OpenAI's app review requires all four hints to be set
// EXPLICITLY (true/false, never omitted/null) on every tool, with the value
// justified by what the tool actually does. Every constant below names the
// behaviour class it describes; see ANNOTATIONS.md for the per-tool rationale.
//
// openWorldHint is false on every tool: each one talks only to the user's own
// Laddro account through api.laddro.com. None of them searches the web, reaches
// a third party, or touches anything outside that closed, bounded domain.

// Reads: fetch data, change nothing. Repeating a read changes nothing either.
const READ_HINTS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Additive writes: each call stores a NEW document. Calling twice produces two
// documents, so this is not idempotent. Nothing existing is overwritten.
const CREATE_HINTS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

// Full in-place replacement (PUT): the resume's previous content is overwritten
// and not recoverable, so this IS destructive. Same body twice leaves the same
// end state, so it is idempotent.
const REPLACE_HINTS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Permanent deletion: destructive, and repeating it leaves the same end state
// (the document is already gone).
const DESTRUCTIVE_HINTS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Setting a field to a caller-supplied value (default flag, template id). It
// overwrites a setting, never document content, so it is not destructive; the
// same call twice leaves the same value in place, so it is idempotent.
const SETTING_HINTS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Producing a downloadable PDF. Not read-only: career-api's feature gate treats
// a download as a metered action and writes a feature_usage ledger row. Not
// idempotent for the same reason - a second call can meter again and returns a
// new 24h download URL. It destroys nothing. ⚠️None of this is ever surfaced to
// the model or the user: see the commerce note in connectorHandlers.ts.
const RENDER_HINTS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

// The scope a tool requires, or null when it needs no specific scope.
export type ConnectorTool = Tool & { requiredScope: string | null };

// The update tool takes the resume fields plus one routing flag. career-api
// refuses to overwrite the user's default resume without it, so a tailoring
// request cannot replace the user's main document even if the model reaches
// for the wrong tool.
//
// ⚠️ `resumeId` has to be IN the schema and required. It used to be named only
// in the description, so a client that sticks to the schema (OpenAI strict
// mode does) had no field to put it in and every update failed with
// "resumeId is required".
function withConfirmEditDefault(schema: Tool["inputSchema"]): Tool["inputSchema"] {
  const base = schema as unknown as { properties?: Record<string, unknown>; required?: string[] };
  return {
    ...(schema as object),
    required: ["resumeId", ...(base.required ?? [])],
    properties: {
      resumeId: {
        type: "string",
        description: "The resumeId (UUID) of the CV to replace, from laddro.resume.list or laddro.resume.get.",
      },
      ...(base.properties ?? {}),
      confirmEditDefault: {
        type: "boolean",
        description:
          "Set true ONLY when the user explicitly asked to change their main (default) resume itself. Never set it while tailoring to a job - save tailored versions as a new resume with laddro.resume.create.",
      },
    },
  } as unknown as Tool["inputSchema"];
}

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
      "Get the full JSON Schema of a Laddro CV (resume). Optional: laddro.resume.create already carries the same schema as its input, so call this only if you need the reference on its own.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: jsonSchemaResultSchema,
    annotations: { title: "Get Resume Schema", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.resume.list",
    description:
      "List the CVs (resumes) saved in the user's Laddro account: resumeId, title, whether it is the default, and dates. Start here whenever the user mentions their CV, so you know what already exists. Use the resumeId with the other resume tools.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Resumes", ...READ_HINTS },
    requiredScope: SCOPES.resumesRead,
  },
  {
    name: "laddro.resume.get",
    description: "Read one of the user's CVs in full (all sections and text). Use it before improving, tailoring or translating a CV, so you work from what the user actually has.",
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
      "Save a CV (resume) you have written into the user's Laddro account. Pass the whole CV: title, locale (the language it is written in), personal details, summary and sections (employment, education, skills, languages, ...). Dates are \"YYYY-MM\"; text fields accept simple HTML (<p>, <ul>, <li>, <strong>). Only use facts the user gave you. Returns the new CV's id: next call laddro.resume.exportPdf with it and give the user the download link. To TAILOR a CV to a job, read the original with laddro.resume.get, rewrite it for the job, and save it here as a NEW CV titled after the role or company - never overwrite the user's existing CV when tailoring.",
    inputSchema: resumeInputSchema,
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The new CV's resumeId; pass it to laddro.resume.exportPdf." },
      },
    },
    annotations: { title: "Create Resume", ...CREATE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.update",
    description:
      "Update a resume IN PLACE: pass `resumeId` (the UUID from list/get, NOT the internal numeric `id`) plus the full updated resume object. This REPLACES the resume's content - use it only when the user explicitly wants to change this exact resume. NEVER use this for tailoring: save the tailored version as a new resume with laddro.resume.create instead. The user's default resume is protected and this tool will refuse to overwrite it unless `confirmEditDefault` is true.",
    inputSchema: withConfirmEditDefault(resumeInputSchema),
    outputSchema: permissiveResultSchema,
    annotations: { title: "Update Resume", ...REPLACE_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.delete",
    description: "Permanently delete one of the user's CVs. Cannot be undone: only call it when the user clearly asked to delete that CV.",
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
    description: "Make one of the user's CVs their main (default) CV in Laddro.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to set as default" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Set Default Resume", ...SETTING_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.changeTemplate",
    description:
      "Change the design (template) of a saved CV without touching its text. Get valid template ids from laddro.templates.list.",
    inputSchema: {
      type: "object",
      required: ["resumeId", "templateId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to update" },
        templateId: { type: "string", description: "Template id from laddro.templates.list" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Change Resume Template", ...SETTING_HINTS },
    requiredScope: SCOPES.resumesWrite,
  },
  {
    name: "laddro.resume.exportPdf",
    description:
      "Turn a saved CV into a designed PDF. Pass the resumeId; template, font and colour are optional overrides for this PDF only. Returns a downloadUrl (valid for 24 hours): always give it to the user, it is what they asked for. Downloads are limited on some Laddro accounts; if the result has status download_not_available, relay its message as it is.",
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
    annotations: { title: "Export Resume PDF", ...RENDER_HINTS },
    requiredScope: SCOPES.documentsRender,
  },
  {
    name: "laddro.coverLetter.schema",
    description:
      "Get the fields laddro.coverLetter.create accepts. Optional: that tool's input schema is the same.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: jsonSchemaResultSchema,
    annotations: { title: "Get Cover Letter Schema", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.coverLetter.list",
    description: "List the cover letters saved in the user's Laddro account, with their ids and titles.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Cover Letters", ...READ_HINTS },
    requiredScope: SCOPES.coverLettersRead,
  },
  {
    name: "laddro.coverLetter.get",
    description: "Read one of the user's cover letters in full.",
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
      "Save a cover letter you have written into the user's Laddro account. Write it from the user's CV (laddro.resume.get) and the job they describe; fullName and letterContent are required, and letterContent accepts simple HTML (<p>, <ul>, <li>). Returns the new letter's id: next call laddro.coverLetter.renderPdf and give the user the download link.",
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
    annotations: { title: "Create Cover Letter", ...CREATE_HINTS },
    requiredScope: SCOPES.coverLettersWrite,
  },
  {
    name: "laddro.coverLetter.renderPdf",
    description:
      "Turn a saved cover letter into a designed PDF. Returns a downloadUrl (valid for 24 hours): always give it to the user. Downloads are limited on some Laddro accounts; if the result has status download_not_available, relay its message as it is.",
    inputSchema: {
      type: "object",
      required: ["coverLetterId"],
      properties: {
        coverLetterId: { type: "string", description: "Cover letter UUID to render" },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "Render Cover Letter PDF", ...RENDER_HINTS },
    requiredScope: SCOPES.documentsRender,
  },
  {
    name: "laddro.templates.list",
    description: "List Laddro's CV designs (templates): id, name, layout, what each is best for, and its ATS score. Pass templateId to get one design in detail, including its colour options (the colorId values laddro.resume.exportPdf accepts).",
    inputSchema: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "Optional. One template's id, to get its full details and colour options." },
      },
    },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Templates", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.fonts.list",
    description: "List the fonts a CV or cover letter can use.",
    inputSchema: { type: "object", properties: {} },
    outputSchema: permissiveResultSchema,
    annotations: { title: "List Fonts", ...READ_HINTS },
    requiredScope: null,
  },
  {
    name: "laddro.languages.list",
    description: "List the languages a Laddro CV can be written in (the valid locale values).",
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
