import { getResourceBaseUrl } from "./oauth.js";

// HTTP client for career-api (api.laddro.com) — Laddro's single external API.
// Used by the OAuth connector tools: it forwards the user's `Bearer lad_at_*`
// access token untouched. career-api authenticates the token (against the shared
// oauth_tokens table), resolves scopes, and applies the unified feature-gate
// entitlements — the same path a developer x-api-key takes. The backend issues
// the token but never sees this resource call.
//
// career-api endpoints:
//   GET  /v1/resumes/schema           -> JSON Schema for resume content
//   POST /v1/resumes                  -> create/upsert resume, returns { resumeId }
//   PUT  /v1/resumes/:id              -> upsert existing resume, returns { resumeId, updatedAt }
//   GET  /v1/cover-letters/schema     -> JSON Schema for cover-letter content
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

  // Create (or upsert when no id) a resume. Backend tags it with
  // `created_via_client_id` so a later connector update can full-replace it.
  async createResume(body: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/v1/resumes", body);
  }

  // Upsert an existing resume. Per spec §4 the backend's full-replace guard only
  // allows replacing resumes tagged with this client; otherwise it copies.
  async updateResume(resumeId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request("PUT", `/v1/resumes/${encodeURIComponent(resumeId)}`, body);
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
