import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    name: "list_templates",
    description: "List all available resume templates with ATS scores and layout types",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_template",
    description: "Get full details for a template including color schemes and fonts",
    inputSchema: {
      type: "object",
      required: ["templateId"],
      properties: {
        templateId: { type: "string", description: "Template ID (e.g. GRAPHITE)" },
      },
    },
  },
  {
    name: "list_fonts",
    description: "List all available font families for resume rendering",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_languages",
    description: "List all 14 supported languages/locales",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_models",
    description: "List all supported AI providers and models for BYOK",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_resumes",
    description: "List the user's resumes",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_resume",
    description: "Get metadata for a specific resume",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string", description: "Resume UUID" },
      },
    },
  },
  {
    name: "render_resume",
    description: "Render a resume with specific template settings and get a PDF. Costs 1 credit.",
    inputSchema: {
      type: "object",
      required: ["resumeId", "templateId"],
      properties: {
        resumeId: { type: "string" },
        templateId: { type: "string" },
        locale: { type: "string" },
        colorId: { type: "string" },
        font: { type: "string" },
        spacing: { type: "number" },
        margin: { type: "number" },
        fontSize: { type: "number" },
        pageNumbering: { type: "string", enum: ["none", "simple", "fraction", "page"] },
      },
    },
  },
  {
    name: "tailor_resume",
    description: "Tailor a resume for a specific job posting. Returns a PDF. Provide either jobDescription or jobUrl.",
    inputSchema: {
      type: "object",
      required: ["positionName"],
      properties: {
        resumeId: { type: "string", description: "Resume to tailor (uses default if omitted)" },
        positionName: { type: "string", description: "Job title applying for" },
        jobDescription: { type: "string", description: "Full job description text" },
        jobUrl: { type: "string", description: "URL to job posting" },
        mode: { type: "string", enum: ["standard", "new"] },
        language: { type: "string", description: "Output language code" },
        includeCoverLetter: { type: "boolean", description: "Also generate cover letter (returns ZIP)" },
        templateId: { type: "string" },
        colorId: { type: "string" },
        font: { type: "string" },
      },
    },
  },
  {
    name: "export_resume",
    description: "Export a resume as PDF with optional template settings. Costs 1 credit.",
    inputSchema: {
      type: "object",
      required: ["resumeId"],
      properties: {
        resumeId: { type: "string" },
        templateId: { type: "string" },
        locale: { type: "string" },
        colorId: { type: "string" },
        font: { type: "string" },
        spacing: { type: "number" },
        margin: { type: "number" },
        fontSize: { type: "number" },
        pageNumbering: { type: "string", enum: ["none", "simple", "fraction", "page"] },
      },
    },
  },
  {
    name: "list_cover_letters",
    description: "List the user's cover letters",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_cover_letter",
    description: "Get metadata for a specific cover letter",
    inputSchema: {
      type: "object",
      required: ["coverLetterId"],
      properties: {
        coverLetterId: { type: "string" },
      },
    },
  },
  {
    name: "create_cover_letter",
    description: "Create a cover letter manually with provided content",
    inputSchema: {
      type: "object",
      required: ["fullName", "letterContent"],
      properties: {
        title: { type: "string" },
        fullName: { type: "string" },
        jobTitle: { type: "string" },
        address: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        companyName: { type: "string" },
        hiringManager: { type: "string" },
        letterContent: { type: "string", description: "Cover letter body as HTML" },
      },
    },
  },
  {
    name: "generate_cover_letter",
    description: "AI-generate a cover letter based on resume and job description. Returns PDF.",
    inputSchema: {
      type: "object",
      required: ["positionName"],
      properties: {
        resumeId: { type: "string" },
        positionName: { type: "string" },
        jobDescription: { type: "string" },
        jobUrl: { type: "string" },
        language: { type: "string" },
        templateId: { type: "string" },
        colorId: { type: "string" },
        font: { type: "string" },
      },
    },
  },
  {
    name: "render_cover_letter",
    description: "Render a saved cover letter with template settings. Costs 1 credit.",
    inputSchema: {
      type: "object",
      required: ["coverLetterId", "templateId"],
      properties: {
        coverLetterId: { type: "string" },
        templateId: { type: "string" },
        locale: { type: "string" },
        colorId: { type: "string" },
        font: { type: "string" },
        spacing: { type: "number" },
        margin: { type: "number" },
        fontSize: { type: "number" },
        pageNumbering: { type: "string", enum: ["none", "simple", "fraction", "page"] },
      },
    },
  },
  {
    name: "get_settings",
    description: "Get current AI provider settings",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_ai_model",
    description: "Set AI provider and model for BYOK. Saves encrypted API key.",
    inputSchema: {
      type: "object",
      required: ["provider", "apiKey"],
      properties: {
        provider: { type: "string", description: "Provider name (e.g. Anthropic, OpenAI, DeepSeek)" },
        model: { type: "string", description: "Model ID (uses recommended if omitted)" },
        apiKey: { type: "string", description: "Your API key for the provider" },
      },
    },
  },
  {
    name: "delete_ai_model",
    description: "Remove saved AI provider config, reverting to Laddro defaults",
    inputSchema: { type: "object", properties: {} },
  },
];
