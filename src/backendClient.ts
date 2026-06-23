import { getBackendBaseUrl } from "./oauth.js";

// Thin HTTP client for laddro-backend (service.laddro.com). Used only by the
// OAuth connector tools: it forwards the user's `Bearer lad_at_*` access token
// untouched — the backend authenticates the token, resolves scopes, and applies
// the feature-gate entitlements. This client never sees career-api.
//
// ASSUMED BACKEND ENDPOINTS (reconcile with the backend agent / spec §4):
//   GET  /v1/resumes/schema           -> JSON Schema for resume content
//   POST /v1/resumes                  -> create/upsert resume, returns { resumeId }
//   PUT  /v1/resumes/:id              -> upsert existing resume, returns { resumeId, updatedAt }
//   GET  /v1/cover-letters/schema     -> JSON Schema for cover-letter content
export class BackendClient {
  private readonly baseUrl: string;
  private readonly bearerToken: string;

  constructor(bearerToken: string, baseUrl = getBackendBaseUrl()) {
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
      // Surface the backend's machine-readable error (e.g. insufficient_scope,
      // 403 upgrade-required) so the handler can map it to an MCP error.
      throw new BackendError(response.status, payload, text);
    }

    return payload;
  }
}

export class BackendError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, raw: string) {
    const detail =
      (isRecord(body) && (body.message || body.error || body.error_description)) || raw || "Backend request failed";
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.name = "BackendError";
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
