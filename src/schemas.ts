import type { CareerApiClient } from "./careerApiClient.js";

// Resolves the resume / cover-letter JSON Schemas for the connector schema tools.
//
// Source of truth is `@laddro-app/schemas/json/{resume,cover-letter}` (a sibling
// agent is adding that export). It is NOT installed in this worktree yet, so we:
//   1. try a dynamic import of the package (works once it ships),
//   2. fall back to the backend `GET /v1/{resumes,cover-letters}/schema`,
//   3. fall back to a minimal placeholder schema with a TODO marker.
//
// TODO(connector): once `@laddro-app/schemas` is a dependency, drop the dynamic
// import guard and import the JSON statically.

export async function resolveResumeSchema(backend: CareerApiClient): Promise<unknown> {
  const fromPackage = await tryImportSchema("@laddro-app/schemas/json/resume");
  if (fromPackage !== undefined) {
    return fromPackage;
  }
  const fromBackend = await tryBackend(() => backend.getResumeSchema());
  if (fromBackend !== undefined) {
    return fromBackend;
  }
  return placeholderResumeSchema;
}

export async function resolveCoverLetterSchema(backend: CareerApiClient): Promise<unknown> {
  const fromPackage = await tryImportSchema("@laddro-app/schemas/json/cover-letter");
  if (fromPackage !== undefined) {
    return fromPackage;
  }
  const fromBackend = await tryBackend(() => backend.getCoverLetterSchema());
  if (fromBackend !== undefined) {
    return fromBackend;
  }
  return placeholderCoverLetterSchema;
}

async function tryImportSchema(specifier: string): Promise<unknown> {
  try {
    // Indirection so TypeScript/bundler does not try to resolve the (absent)
    // module at build time.
    const mod = await import(/* @vite-ignore */ specifier);
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    return undefined;
  }
}

async function tryBackend(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

const placeholderResumeSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.laddro.com/resume.placeholder.json",
  title: "Resume (placeholder)",
  description:
    "TODO: replace with @laddro-app/schemas/json/resume once the export ships. Minimal placeholder only.",
  type: "object",
  properties: {
    title: { type: "string", description: "Internal title for the resume" },
    content: {
      type: "object",
      description: "Resume content (personal info, experience, education, skills, etc.)",
    },
  },
  required: ["content"],
};

const placeholderCoverLetterSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.laddro.com/cover-letter.placeholder.json",
  title: "Cover Letter (placeholder)",
  description:
    "TODO: replace with @laddro-app/schemas/json/cover-letter once the export ships. Minimal placeholder only.",
  type: "object",
  properties: {
    title: { type: "string", description: "Internal title for the cover letter" },
    fullName: { type: "string", description: "Applicant's full name" },
    letterContent: { type: "string", description: "Cover letter body content as HTML" },
  },
  required: ["fullName", "letterContent"],
};
