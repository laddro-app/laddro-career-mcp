import { getResourceBaseUrl } from "./oauth.js";

// HTTP client for career-api (api.laddro.com) — Laddro's single external API.
// Used by the OAuth connector tools: it forwards the user's `Bearer lad_at_*`
// access token untouched. career-api authenticates the token (against the shared
// oauth_tokens table), resolves scopes, and applies the unified feature-gate
// entitlements — the same path a developer x-api-key takes. The backend issues
// the token but never sees this resource call.
//
// career-api endpoints (api.laddro.com):
//   GET    /v1/resumes                    -> list resumes
//   GET    /v1/resumes/{id}               -> get one resume
//   POST   /v1/resumes                    -> create (no id) OR update (id in body; upserts on id)
//   DELETE /v1/resumes/{id}               -> delete resume
//   PATCH  /v1/resumes/{id}/default       -> set as default
//   PATCH  /v1/resumes/{id}/template      -> change template ({ templateId })
//   POST   /v1/tailor                     -> tailor resume to a job
//   POST   /v1/export                     -> export resume PDF
//   GET    /v1/cover-letters              -> list cover letters
//   GET    /v1/cover-letters/{id}         -> get one cover letter
//   POST   /v1/cover-letters              -> create cover letter
//   POST   /v1/cover-letters/generate     -> AI-generate cover letter
//   PUT    /v1/cover-letters/{id}/render  -> render cover letter PDF
//   GET    /v1/templates,/v1/fonts,/v1/languages -> public reference lists
//   GET    /v1/resumes/schema             -> JSON Schema for resume content (schema fallback)
//   GET    /v1/cover-letters/schema       -> JSON Schema for cover-letter content (schema fallback)
export class CareerApiClient {
  private readonly baseUrl: string;
  private readonly bearerToken: string;

  constructor(bearerToken: string, baseUrl = getResourceBaseUrl()) {
    this.bearerToken = bearerToken;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async getResumeSchema(): Promise<unknown> {
    return this.request("GET", "/v1/resumes/schema");
  }

  async getCoverLetterSchema(): Promise<unknown> {
    return this.request("GET", "/v1/cover-letters/schema");
  }

  // ─── Resumes ────────────────────────────────────────────────────────────

  async listResumes(): Promise<unknown> {
    return this.request("GET", "/v1/resumes");
  }

  async getResume(resumeId: string): Promise<unknown> {
    return this.request("GET", `/v1/resumes/${encodeURIComponent(resumeId)}`);
  }

  // Create (or upsert when no id) a resume. Backend tags it with
  // `created_via_client_id` so a later connector update can full-replace it.
  async createResume(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/resumes", body);
  }

  // Update an existing resume. career-api has no PUT /v1/resumes/:id — the
  // POST /v1/resumes endpoint upserts on the `id` carried in the body.
  async updateResume(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/resumes", body);
  }

  async deleteResume(resumeId: string): Promise<unknown> {
    return this.request("DELETE", `/v1/resumes/${encodeURIComponent(resumeId)}`);
  }

  async setDefaultResume(resumeId: string): Promise<unknown> {
    return this.request("PATCH", `/v1/resumes/${encodeURIComponent(resumeId)}/default`, {
      id: resumeId,
    });
  }

  async changeResumeTemplate(resumeId: string, templateId: string): Promise<unknown> {
    return this.request("PATCH", `/v1/resumes/${encodeURIComponent(resumeId)}/template`, {
      templateId,
    });
  }

  async tailorResume(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/tailor", body);
  }

  async exportResumePdf(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/export", body);
  }

  // ─── Cover letters ──────────────────────────────────────────────────────

  async listCoverLetters(): Promise<unknown> {
    return this.request("GET", "/v1/cover-letters");
  }

  async getCoverLetter(coverLetterId: string): Promise<unknown> {
    return this.request("GET", `/v1/cover-letters/${encodeURIComponent(coverLetterId)}`);
  }

  async createCoverLetter(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/cover-letters", body);
  }

  async generateCoverLetter(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/cover-letters/generate", body);
  }

  async renderCoverLetterPdf(coverLetterId: string): Promise<unknown> {
    return this.request("PUT", `/v1/cover-letters/${encodeURIComponent(coverLetterId)}/render`);
  }

  // ─── Reference lists (public, no scope) ─────────────────────────────────

  async listTemplates(): Promise<unknown> {
    return this.request("GET", "/v1/templates");
  }

  async listFonts(): Promise<unknown> {
    return this.request("GET", "/v1/fonts");
  }

  async listLanguages(): Promise<unknown> {
    return this.request("GET", "/v1/languages");
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    const payload = parseJson(text);

    if (!response.ok) {
      // Surface career-api's machine-readable error (e.g. insufficient_scope,
      // 403 upgrade-required) so the handler can map it to an MCP error.
      throw new CareerApiError(response.status, payload, text);
    }

    return payload;
  }
}

export class CareerApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, raw: string) {
    const detail =
      (isRecord(body) && (body.message || body.error || body.error_description)) || raw || "career-api request failed";
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.name = "CareerApiError";
    this.status = status;
    this.body = body;
  }
}

function parseJson(text: string): unknown {
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
