import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const templateSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    atsScore: { type: "number" },
    layout: { type: "string" },
  },
};

const resumeSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const coverLetterSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const pdfResultSchema = {
  type: "object" as const,
  properties: {
    content: { type: "string", description: "Base64-encoded PDF data" },
    mimeType: { type: "string" },
  },
};



// Tool annotation hints. All four are set EXPLICITLY on every tool (never
// omitted, so a client never reads one as null), and each value describes what
// the tool actually does. See ANNOTATIONS.md for the per-tool rationale.
//
// openWorldHint is false throughout: every tool talks only to the caller's own
// Laddro account via api.laddro.com. Nothing here searches the web or reaches a
// third party.

// Reads: return data, change nothing; repeating one changes nothing.
const READ_HINTS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Additive writes: each call stores a NEW document, so calling twice produces
// two documents. Nothing existing is overwritten.
const CREATE_HINTS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

// Producing a downloadable PDF. NOT read-only: career-api's feature gate bills a
// download (first per document type free, then 1 credit) and writes a
// feature_usage ledger row, so a render has a side effect on the user's balance.
// Not idempotent for the same reason. It destroys nothing.
const RENDER_HINTS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

// Metered AI actions (tailor, cover-letter generation): each call deducts 1
// credit and produces a new artifact, so neither read-only nor idempotent.
const AI_HINTS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export const tools: Tool[] = [
  {
    name: "laddro.templates.list",
    description: "List all available resume templates with ATS scores and layout types",
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { templates: { type: "array", items: templateSchema } } },
    annotations: { title: "List Templates", ...READ_HINTS },
  },
  {
    name: "laddro.templates.get",
    description: "Get full details for a template including color schemes, fonts, and preview images",
    inputSchema: {
      type: "object",
      required: ["templateId"],
      properties: {
        templateId: { type: "string", description: "Template identifier (e.g. GRAPHITE, ONYX, MARBLE)" },
      },
    },
    outputSchema: templateSchema,
    annotations: { title: "Get Template Details", ...READ_HINTS },
  },
  {
    name: "laddro.fonts.list",
    description: "List all available font families for resume and cover letter rendering",
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { fonts: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } } } },
    annotations: { title: "List Fonts", ...READ_HINTS },
  },
  {
    name: "laddro.languages.list",
    description: "List all 14 supported languages and locales for resume content",
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { languages: { type: "array", items: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } } } } } },
    annotations: { title: "List Languages", ...READ_HINTS },
  },
  {
    name: "laddro.resumes.list",
    description: "List the authenticated user's resumes with pagination support",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of results to return (default 20)" },
        offset: { type: "number", description: "Number of results to skip for pagination" },
      },
    },
    outputSchema: { type: "object", properties: { resumes: { type: "array", items: resumeSchema }, total: { type: "number" } } },
    annotations: { title: "List Resumes", ...READ_HINTS },
  },
  {
    name: "laddro.resumes.get",
    description: "Get metadata and content for a specific resume by its ID",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID identifier" },
      },
    },
    outputSchema: resumeSchema,
    annotations: { title: "Get Resume", ...READ_HINTS },
  },
  {
    name: "laddro.resumes.render",
    description: "Render a resume as PDF with specific template and styling settings. Costs 1 API credit.",
    inputSchema: {
      type: "object",
      required: ["resumeId", "templateId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to render" },
        templateId: { type: "string", description: "Template identifier (e.g. GRAPHITE)" },
        locale: { type: "string", description: "Language/locale code (e.g. en, de, fr)" },
        colorId: { type: "string", description: "Color scheme identifier for the template" },
        font: { type: "string", description: "Font family name (e.g. Inter, Roboto)" },
        spacing: { type: "number", description: "Line spacing multiplier (e.g. 1.0, 1.15, 1.5)" },
        margin: { type: "number", description: "Page margin in millimeters" },
        fontSize: { type: "number", description: "Base font size in points" },
        pageNumbering: { type: "string", enum: ["none", "simple", "fraction", "page"], description: "Page numbering style" },
      },
    },
    outputSchema: pdfResultSchema,
    annotations: { title: "Render Resume PDF", ...RENDER_HINTS },
  },
  {
    name: "laddro.resumes.tailor",
    description: "AI-tailor a resume for a specific job posting. Rewrites content to match the job description and returns a PDF. Provide either jobDescription or jobUrl.",
    inputSchema: {
      type: "object",
      required: ["positionName"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to tailor (uses user's default resume if omitted)" },
        positionName: { type: "string", description: "Job title or position name being applied for" },
        jobDescription: { type: "string", description: "Full job description text to tailor against" },
        jobUrl: { type: "string", description: "URL to the job posting (alternative to jobDescription)" },
        mode: { type: "string", enum: ["standard", "new"], description: "Tailoring mode: standard modifies existing, new creates from scratch" },
        language: { type: "string", description: "Output language code (e.g. en, de, fr)" },
        includeCoverLetter: { type: "boolean", description: "Also generate a matching cover letter (returns ZIP with both PDFs)" },
        templateId: { type: "string", description: "Template identifier for PDF output" },
        colorId: { type: "string", description: "Color scheme identifier" },
        font: { type: "string", description: "Font family name" },
      },
    },
    outputSchema: pdfResultSchema,
    annotations: { title: "Tailor Resume for Job", ...AI_HINTS },
  },
  {
    name: "laddro.resumes.export",
    description: "Export a resume as a downloadable PDF file with optional template and styling settings. Costs 1 API credit.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to export" },
        templateId: { type: "string", description: "Template identifier (e.g. GRAPHITE)" },
        locale: { type: "string", description: "Language/locale code (e.g. en, de, fr)" },
        colorId: { type: "string", description: "Color scheme identifier" },
        font: { type: "string", description: "Font family name" },
        spacing: { type: "number", description: "Line spacing multiplier" },
        margin: { type: "number", description: "Page margin in millimeters" },
        fontSize: { type: "number", description: "Base font size in points" },
        pageNumbering: { type: "string", enum: ["none", "simple", "fraction", "page"], description: "Page numbering style" },
      },
    },
    outputSchema: pdfResultSchema,
    annotations: { title: "Export Resume PDF", ...RENDER_HINTS },
  },
  {
    name: "laddro.coverLetters.list",
    description: "List the authenticated user's cover letters with pagination support",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of results to return (default 20)" },
        offset: { type: "number", description: "Number of results to skip for pagination" },
      },
    },
    outputSchema: { type: "object", properties: { coverLetters: { type: "array", items: coverLetterSchema }, total: { type: "number" } } },
    annotations: { title: "List Cover Letters", ...READ_HINTS },
  },
  {
    name: "laddro.coverLetters.get",
    description: "Get metadata and content for a specific cover letter by its ID",
    inputSchema: {
      type: "object",
      required: ["coverLetterId"],
      properties: {
        coverLetterId: { type: "string", description: "Cover letter UUID identifier" },
      },
    },
    outputSchema: coverLetterSchema,
    annotations: { title: "Get Cover Letter", ...READ_HINTS },
  },
  {
    name: "laddro.coverLetters.create",
    description: "Create a new cover letter manually with provided contact details and letter content",
    inputSchema: {
      type: "object",
      required: ["fullName", "letterContent"],
      properties: {
        title: { type: "string", description: "Internal title for this cover letter" },
        fullName: { type: "string", description: "Applicant's full name" },
        jobTitle: { type: "string", description: "Applicant's current or target job title" },
        address: { type: "string", description: "Applicant's address" },
        email: { type: "string", description: "Applicant's email address" },
        phone: { type: "string", description: "Applicant's phone number" },
        companyName: { type: "string", description: "Name of the company being applied to" },
        hiringManager: { type: "string", description: "Name of the hiring manager" },
        letterContent: { type: "string", description: "Cover letter body content as HTML" },
      },
    },
    outputSchema: coverLetterSchema,
    annotations: { title: "Create Cover Letter", ...CREATE_HINTS },
  },
  {
    name: "laddro.coverLetters.generate",
    description: "AI-generate a personalized cover letter based on a resume and job description. Returns a PDF.",
    inputSchema: {
      type: "object",
      required: ["positionName"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID to base the cover letter on (uses default if omitted)" },
        positionName: { type: "string", description: "Job title or position name being applied for" },
        jobDescription: { type: "string", description: "Full job description text" },
        jobUrl: { type: "string", description: "URL to the job posting (alternative to jobDescription)" },
        language: { type: "string", description: "Output language code (e.g. en, de, fr)" },
        templateId: { type: "string", description: "Template identifier for PDF output" },
        colorId: { type: "string", description: "Color scheme identifier" },
        font: { type: "string", description: "Font family name" },
      },
    },
    outputSchema: pdfResultSchema,
    annotations: { title: "Generate Cover Letter", ...AI_HINTS },
  },
  {
    name: "laddro.coverLetters.render",
    description: "Render a saved cover letter as PDF with template and styling settings. Costs 1 API credit.",
    inputSchema: {
      type: "object",
      required: ["coverLetterId", "templateId"],
      properties: {
        coverLetterId: { type: "string", description: "Cover letter UUID to render" },
        templateId: { type: "string", description: "Template identifier (e.g. GRAPHITE)" },
        locale: { type: "string", description: "Language/locale code" },
        colorId: { type: "string", description: "Color scheme identifier" },
        font: { type: "string", description: "Font family name" },
        spacing: { type: "number", description: "Line spacing multiplier" },
        margin: { type: "number", description: "Page margin in millimeters" },
        fontSize: { type: "number", description: "Base font size in points" },
        pageNumbering: { type: "string", enum: ["none", "simple", "fraction", "page"], description: "Page numbering style" },
      },
    },
    outputSchema: pdfResultSchema,
    annotations: { title: "Render Cover Letter PDF", ...RENDER_HINTS },
  },
];
