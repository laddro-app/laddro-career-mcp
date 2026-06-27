import { coverLetterSchema } from "./generated/coverLetterSchema.js";
import { resumeSchema } from "./generated/resumeSchema.js";

// Resolves the resume / cover-letter JSON Schemas for the connector schema tools.
//
// These are the REAL schemas career-api validates against, bundled from
// @laddro-app/schemas via scripts/gen-schemas.mjs into ./generated/*. The schema
// tools simply return them so a connector client can build conforming content.

export function resolveResumeSchema(): unknown {
  return resumeSchema;
}

export function resolveCoverLetterSchema(): unknown {
  return coverLetterSchema;
}
