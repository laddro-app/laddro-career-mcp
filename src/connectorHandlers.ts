import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { CareerApiClient, CareerApiError } from "./careerApiClient.js";
import { isTokenErrorCode, markTokenRejected } from "./rejectedTokens.js";
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
  "laddro.resume.exportPdf",
  "laddro.coverLetter.schema",
  "laddro.coverLetter.list",
  "laddro.coverLetter.get",
  "laddro.coverLetter.create",
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
//
// ⚠️ The token is read PER CALL. An MCP session outlives the 15-minute access
// token, and the client sends the refreshed one on the same session id; a
// client built once at session start kept calling career-api with the token
// the session opened with, so every tool call after minute 15 failed with
// token_expired for the rest of the chat.
export function createConnectorHandlers(bearerToken: string | (() => string)) {
  const currentToken = typeof bearerToken === "function" ? bearerToken : () => bearerToken;

  return async (name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
    const token = currentToken();
    const backend = new CareerApiClient(token);
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
          // Update in place: the resume UUID goes in the URL path
          // (PUT /v1/resumes/{resumeId}), the full resume object is the body.
          // resume_id + trio uuids preserved. Accept `resumeId` (preferred; the
          // UUID that list/get expose) with `id` as the legacy alias — the API
          // resolves by resume_id, so the internal numeric id never matches.
          const resumeId = firstNonEmptyString(args.resumeId, args.id);
          if (!resumeId) {
            return { content: [{ type: "text", text: "resumeId (the UUID from list/get) is required to update a resume" }], isError: true };
          }
          // confirmEditDefault is a routing flag, not resume content — the
          // API takes it as a query param and would otherwise reject it.
          const { confirmEditDefault, ...resumeBody } = args;
          const result = await backend.updateResume(resumeId, resumeBody, confirmEditDefault === true);
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
      if (error instanceof CareerApiError && error.status === 401 && isTokenErrorCode(errorCode(error))) {
        // The next request carrying this token gets an HTTP 401 from server.ts,
        // which is what makes the client refresh it. See rejectedTokens.ts.
        markTokenRejected(token);
        return {
          content: [{ type: "text", text: "The Laddro sign-in for this chat has expired and is being renewed. Retry the same tool call once." }],
          isError: true,
        };
      }
      return toToolError(error);
    }
  };
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
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
    const code = errorCode(error);
    // The default resume is protected server-side: a refusal is a policy
    // outcome with a defined recovery (save a new resume), not a malfunction.
    // Returning it as a normal result keeps the model from telling the user
    // Laddro broke, and points it at the right tool.
    if (code === "default_resume_protected") {
      return json({
        status: "default_resume_protected",
        message: error.message,
        instructions:
          "The user's default resume was NOT modified. If this was a tailoring request, write the tailored version and save it with laddro.resume.create as a new resume named after the target role or company. Only retry with confirmEditDefault: true when the user explicitly asked to change their main resume itself.",
      });
    }
    // Entitlement walls are data, not failures, so they come back as a normal
    // structured result rather than an error the model reports as a breakage.
    // ⚠️OpenAI app policy (app-submission-guidelines, "Commerce"): a plugin may
    // explain that a feature is not included in the user's entitlement, but it
    // must NOT display plans, promote an upgrade, mention prices or credits, or
    // link to anything that starts a purchase. Selling digital goods or
    // services through an app - including indirectly via a freemium upsell - is
    // disallowed and got v1.0.0 rejected on 2026-10-12. So career-api's own
    // message and its upgradeUrl are deliberately DROPPED here instead of
    // relayed: that copy is written as an upsell for other surfaces.
    if (code === "requires_upgrade" || code === "insufficient_credits") {
      return json({
        status: "download_not_available",
        message: "This download is not included in the user's current Laddro account.",
        instructions:
          "Tell the user plainly that this download is not available on their Laddro account, and that they can manage it in their Laddro account. Do NOT mention plans, prices, subscriptions, credits or purchases, do not offer to sell anything, and do not provide any link.",
      });
    }
    // Map insufficient_scope / forbidden / unauthorized to a readable MCP error.
    const text = code ? `${code}: ${error.message}` : error.message;
    return { content: [{ type: "text", text }], isError: true };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: message }], isError: true };
}

function errorCode(error: CareerApiError): string | undefined {
  if (error.body && typeof error.body === "object") {
    const body = error.body as Record<string, unknown>;
    // career-api puts the machine code in `code` and the human message in
    // `error`; prefer `code` so the message is never doubled up as its own
    // prefix. OAuth-style bodies ({error, error_description}) still resolve
    // via the `error` fallback.
    if (typeof body.code === "string") {
      return body.code;
    }
    if (typeof body.error === "string") {
      return body.error;
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
  // career-api replies to some successful calls (DELETE, PATCH) with an empty
  // body. JSON.stringify(undefined) is undefined - invalid MCP content that
  // surfaced as a connector error even though the operation succeeded.
  const normalized = data === undefined || data === null ? { ok: true } : data;
  return {
    content: [{ type: "text", text: JSON.stringify(normalized, null, 2) }],
    structuredContent: toStructured(normalized),
  };
}

function toStructured(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { value: data };
}
