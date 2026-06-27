import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { CareerApiClient, CareerApiError } from "./careerApiClient.js";
import { resolveCoverLetterSchema, resolveResumeSchema } from "./schemas.js";

const CONNECTOR_TOOL_NAMES = new Set([
  "laddro.resume.schema",
  "laddro.resume.list",
  "laddro.resume.get",
  "laddro.resume.create",
  "laddro.resume.update",
  "laddro.resume.delete",
  "laddro.resume.setDefault",
  "laddro.resume.changeTemplate",
  "laddro.resume.tailor",
  "laddro.resume.exportPdf",
  "laddro.coverLetter.schema",
  "laddro.coverLetter.list",
  "laddro.coverLetter.get",
  "laddro.coverLetter.create",
  "laddro.coverLetter.generate",
  "laddro.coverLetter.renderPdf",
  "laddro.templates.list",
  "laddro.fonts.list",
  "laddro.languages.list",
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
          return json(resolveResumeSchema());
        }
        case "laddro.coverLetter.schema": {
          return json(resolveCoverLetterSchema());
        }
        case "laddro.resume.list": {
          const result = await backend.listResumes();
          return json(result);
        }
        case "laddro.resume.get": {
          const result = await backend.getResume(args.resumeId as string);
          return json(result);
        }
        case "laddro.resume.create": {
          // args IS the full resume object (flat) conforming to the resume schema.
          const result = await backend.createResume(args);
          return json(result);
        }
        case "laddro.resume.update": {
          // Update in place: the id goes in the URL path (PUT /v1/resumes/{id}),
          // the full resume object is the body. resume_id + trio uuids preserved.
          if (typeof args.id !== "string" || args.id.length === 0) {
            return { content: [{ type: "text", text: "id is required to update a resume" }], isError: true };
          }
          const result = await backend.updateResume(args.id, args);
          return json(result);
        }
        case "laddro.resume.delete": {
          const result = await backend.deleteResume(args.resumeId as string);
          return json(result);
        }
        case "laddro.resume.setDefault": {
          const result = await backend.setDefaultResume(args.resumeId as string);
          return json(result);
        }
        case "laddro.resume.changeTemplate": {
          const result = await backend.changeResumeTemplate(
            args.resumeId as string,
            args.templateId as string,
          );
          return json(result);
        }
        case "laddro.resume.tailor": {
          const result = await backend.tailorResume(buildTailorBody(args));
          return json(result);
        }
        case "laddro.resume.exportPdf": {
          const result = await backend.exportResumePdf(buildExportBody(args));
          return json(result);
        }
        case "laddro.coverLetter.list": {
          const result = await backend.listCoverLetters();
          return json(result);
        }
        case "laddro.coverLetter.get": {
          const result = await backend.getCoverLetter(args.coverLetterId as string);
          return json(result);
        }
        case "laddro.coverLetter.create": {
          // args holds the flat cover-letter fields (fullName, letterContent, ...).
          const result = await backend.createCoverLetter(args);
          return json(result);
        }
        case "laddro.coverLetter.generate": {
          const result = await backend.generateCoverLetter(buildTailorBody(args));
          return json(result);
        }
        case "laddro.coverLetter.renderPdf": {
          const result = await backend.renderCoverLetterPdf(args.coverLetterId as string);
          return json(result);
        }
        case "laddro.templates.list": {
          const result = await backend.listTemplates();
          return json(result);
        }
        case "laddro.fonts.list": {
          const result = await backend.listFonts();
          return json(result);
        }
        case "laddro.languages.list": {
          const result = await backend.listLanguages();
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

// Shared by laddro.resume.tailor and laddro.coverLetter.generate — both hit a
// career-api endpoint that accepts { resumeId?, positionName, jobDescription?, jobUrl? }.
function buildTailorBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { positionName: args.positionName };
  if (args.resumeId !== undefined) {
    body.resumeId = args.resumeId;
  }
  if (args.jobDescription !== undefined) {
    body.jobDescription = args.jobDescription;
  }
  if (args.jobUrl !== undefined) {
    body.jobUrl = args.jobUrl;
  }
  return body;
}

function buildExportBody(args: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { resumeId: args.resumeId };
  for (const key of ["templateId", "locale", "font", "colorId"] as const) {
    if (args[key] !== undefined) {
      body[key] = args[key];
    }
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
