import assert from "node:assert/strict";
import test from "node:test";

import { createHandlers } from "../dist/handlers.js";

const binaryFixture = new Uint8Array([37, 80, 68, 70]).buffer;
const binaryResponseFixture = {
  data: binaryFixture,
  metadata: {
    resumeId: "resume-1",
    coverLetterId: "cover-1",
    filename: "tailored.zip",
    mimeType: "application/zip",
  },
};

const handlerCases = [
  {
    name: "laddro.templates.list",
    args: {},
    client: { templates: { list: async () => ({ ok: "templates.list" }) } },
    expectedJson: { ok: "templates.list" },
  },
  {
    name: "laddro.templates.get",
    args: { templateId: "GRAPHITE" },
    client: { templates: { get: async (templateId) => ({ templateId }) } },
    expectedJson: { templateId: "GRAPHITE" },
  },
  {
    name: "laddro.fonts.list",
    args: {},
    client: { templates: { fonts: async () => ({ ok: "fonts.list" }) } },
    expectedJson: { ok: "fonts.list" },
  },
  {
    name: "laddro.languages.list",
    args: {},
    client: { templates: { languages: async () => ({ ok: "languages.list" }) } },
    expectedJson: { ok: "languages.list" },
  },
  {
    name: "laddro.models.list",
    args: {},
    client: { templates: { models: async () => ({ ok: "models.list" }) } },
    expectedJson: { ok: "models.list" },
  },
  {
    name: "laddro.resumes.list",
    args: { limit: 10, offset: 5 },
    client: { resumes: { list: async (args) => args } },
    expectedJson: { limit: 10, offset: 5 },
  },
  {
    name: "laddro.resumes.get",
    args: { resumeId: "resume-1" },
    client: { resumes: { get: async (resumeId) => ({ resumeId }) } },
    expectedJson: { resumeId: "resume-1" },
  },
  {
    name: "laddro.resumes.render",
    args: { resumeId: "resume-1", templateId: "GRAPHITE", locale: "en", colorId: "blue", font: "Inter", spacing: 1.1, margin: 12, fontSize: 10, pageNumbering: "simple" },
    client: { resumes: { render: async () => binaryFixture } },
    expectedMimeType: "application/pdf",
  },
  {
    name: "laddro.resumes.tailor",
    args: { resumeId: "resume-1", positionName: "Senior Developer", jobDescription: "Build systems", jobUrl: "https://example.com/job", mode: "standard", language: "en", includeCoverLetter: false, templateId: "GRAPHITE", colorId: "blue", font: "Inter" },
    client: { tailor: { runDetailed: async () => binaryResponseFixture } },
    expectedMimeType: "application/pdf",
    expectedMetadata: { status: "tailored", resumeId: "resume-1", coverLetterId: "cover-1" },
  },
  {
    name: "laddro.resumes.tailor",
    args: { positionName: "Senior Developer", includeCoverLetter: true },
    client: { tailor: { runDetailed: async () => binaryResponseFixture } },
    expectedMimeType: "application/zip",
    expectedMetadata: { status: "tailored", resumeId: "resume-1", coverLetterId: "cover-1" },
  },
  {
    name: "laddro.resumes.export",
    args: { resumeId: "resume-1", templateId: "GRAPHITE", locale: "en", colorId: "blue", font: "Inter", spacing: 1.1, margin: 12, fontSize: 10, pageNumbering: "simple" },
    client: { export: { pdf: async () => binaryFixture } },
    expectedMimeType: "application/pdf",
  },
  {
    name: "laddro.coverLetters.list",
    args: { limit: 10, offset: 5 },
    client: { coverLetters: { list: async (args) => args } },
    expectedJson: { limit: 10, offset: 5 },
  },
  {
    name: "laddro.coverLetters.get",
    args: { coverLetterId: "cover-1" },
    client: { coverLetters: { get: async (coverLetterId) => ({ coverLetterId }) } },
    expectedJson: { coverLetterId: "cover-1" },
  },
  {
    name: "laddro.coverLetters.create",
    args: { title: "Cover", fullName: "Ada Lovelace", jobTitle: "Engineer", address: "Berlin", email: "ada@example.com", phone: "+49", companyName: "Laddro", hiringManager: "Team", letterContent: "<p>Hello</p>" },
    client: { coverLetters: { create: async (args) => args } },
    expectedJson: { title: "Cover", fullName: "Ada Lovelace", jobTitle: "Engineer", address: "Berlin", email: "ada@example.com", phone: "+49", companyName: "Laddro", hiringManager: "Team", letterContent: "<p>Hello</p>" },
  },
  {
    name: "laddro.coverLetters.generate",
    args: { resumeId: "resume-1", positionName: "Senior Developer", jobDescription: "Build systems", jobUrl: "https://example.com/job", language: "en", templateId: "GRAPHITE", colorId: "blue", font: "Inter" },
    client: { coverLetters: { generateDetailed: async () => binaryResponseFixture } },
    expectedMimeType: "application/pdf",
    expectedMetadata: { status: "generated", resumeId: "resume-1", coverLetterId: "cover-1" },
  },
  {
    name: "laddro.coverLetters.render",
    args: { coverLetterId: "cover-1", templateId: "GRAPHITE", locale: "en", colorId: "blue", font: "Inter", spacing: 1.1, margin: 12, fontSize: 10, pageNumbering: "simple" },
    client: { coverLetters: { render: async () => binaryFixture } },
    expectedMimeType: "application/pdf",
  },
  {
    name: "laddro.settings.get",
    args: {},
    client: { settings: { get: async () => ({ provider: "openai" }) } },
    expectedJson: { provider: "openai" },
  },
  {
    name: "laddro.settings.updateModel",
    args: { provider: "openai", model: "gpt-4.1-mini", apiKey: "sk-test" },
    client: { settings: { updateModel: async (args) => args } },
    expectedJson: { provider: "openai", model: "gpt-4.1-mini", apiKey: "sk-test" },
  },
  {
    name: "laddro.settings.deleteModel",
    args: {},
    client: { settings: { deleteModel: async () => ({ message: "removed" }) } },
    expectedJson: { message: "removed" },
  },
];

for (const testCase of handlerCases) {
  test(`handler routes ${testCase.name}`, async () => {
    const handler = createHandlers(testCase.client);
    const result = await handler(testCase.name, testCase.args);

    assert.equal(result.isError, undefined);
    if (testCase.expectedJson) {
      assert.equal(result.content[0].type, "text");
      assert.deepEqual(JSON.parse(result.content[0].text), testCase.expectedJson);
      return;
    }

    const resourceIndex = testCase.expectedMetadata ? 1 : 0;
    if (testCase.expectedMetadata) {
      assert.equal(result.content[0].type, "text");
      assert.deepEqual(
        pick(JSON.parse(result.content[0].text), Object.keys(testCase.expectedMetadata)),
        testCase.expectedMetadata,
      );
    }

    assert.equal(result.content[resourceIndex].type, "resource");
    assert.equal(result.content[resourceIndex].resource.mimeType, testCase.expectedMimeType);
    assert.ok(result.content[resourceIndex].resource.blob.length > 0);
  });
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

test("handler keeps legacy underscore aliases working", async () => {
  const handler = createHandlers({
    templates: {
      languages: async () => ({ languages: [{ code: "en", name: "English" }] }),
    },
  });

  const result = await handler("laddro_list_languages", {});

  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    languages: [{ code: "en", name: "English" }],
  });
});

test("json handler sets structuredContent matching the output schema", async () => {
  const handler = createHandlers({
    templates: { list: async () => ({ templates: [{ id: "GRAPHITE", name: "Graphite" }] }) },
  });
  const result = await handler("laddro.templates.list", {});

  assert.equal(result.isError, undefined);
  assert.ok(result.structuredContent, "structuredContent must be present for tools with an outputSchema");
  assert.deepEqual(result.structuredContent, { templates: [{ id: "GRAPHITE", name: "Graphite" }] });
});

test("binary handler sets structuredContent with content + mimeType", async () => {
  const handler = createHandlers({
    resumes: { render: async () => binaryFixture },
  });
  const result = await handler("laddro.resumes.render", { resumeId: "resume-1", templateId: "GRAPHITE" });

  assert.equal(result.isError, undefined);
  assert.ok(result.structuredContent, "binary handler must populate structuredContent");
  assert.equal(result.structuredContent.mimeType, "application/pdf");
  assert.equal(typeof result.structuredContent.content, "string");
  assert.ok(result.structuredContent.content.length > 0, "base64 content must be non-empty");
});

test("binary handler with metadata merges metadata into structuredContent", async () => {
  const handler = createHandlers({
    tailor: { runDetailed: async () => binaryResponseFixture },
  });
  const result = await handler("laddro.resumes.tailor", { positionName: "X", includeCoverLetter: true });

  assert.equal(result.isError, undefined);
  assert.ok(result.structuredContent);
  assert.equal(result.structuredContent.resumeId, "resume-1");
  assert.equal(result.structuredContent.coverLetterId, "cover-1");
  assert.equal(result.structuredContent.mimeType, "application/zip");
});

test("handler returns MCP errors for unknown tools", async () => {
  const handler = createHandlers({});
  const result = await handler("laddro.unknown.tool", {});

  assert.equal(result.isError, true);
  assert.equal(result.content[0].type, "text");
  assert.equal(result.content[0].text, "Unknown tool: laddro.unknown.tool");
});
