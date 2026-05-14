import assert from "node:assert/strict";
import test from "node:test";

import { createHandlers } from "../dist/handlers.js";

const binaryFixture = new Uint8Array([37, 80, 68, 70]).buffer;

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
    client: { tailor: { run: async () => binaryFixture } },
    expectedMimeType: "application/pdf",
  },
  {
    name: "laddro.resumes.tailor",
    args: { positionName: "Senior Developer", includeCoverLetter: true },
    client: { tailor: { run: async () => binaryFixture } },
    expectedMimeType: "application/zip",
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
    client: { coverLetters: { generate: async () => binaryFixture } },
    expectedMimeType: "application/pdf",
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

    assert.equal(result.content[0].type, "resource");
    assert.equal(result.content[0].resource.mimeType, testCase.expectedMimeType);
    assert.ok(result.content[0].resource.blob.length > 0);
  });
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

test("handler returns MCP errors for unknown tools", async () => {
  const handler = createHandlers({});
  const result = await handler("laddro.unknown.tool", {});

  assert.equal(result.isError, true);
  assert.equal(result.content[0].type, "text");
  assert.equal(result.content[0].text, "Unknown tool: laddro.unknown.tool");
});
