import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import { tools } from "../dist/tools.js";
import { version } from "../dist/version.js";

const expectedTools = [
  "laddro.templates.list",
  "laddro.templates.get",
  "laddro.fonts.list",
  "laddro.languages.list",
  "laddro.resumes.list",
  "laddro.resumes.get",
  "laddro.resumes.render",
  "laddro.resumes.tailor",
  "laddro.resumes.export",
  "laddro.coverLetters.list",
  "laddro.coverLetters.get",
  "laddro.coverLetters.create",
  "laddro.coverLetters.generate",
  "laddro.coverLetters.render",
];

const expectedRequiredFields = {
  "laddro.templates.get": ["templateId"],
  "laddro.resumes.get": ["resumeId"],
  "laddro.resumes.render": ["resumeId", "templateId"],
  "laddro.resumes.tailor": ["positionName"],
  "laddro.resumes.export": ["resumeId"],
  "laddro.coverLetters.get": ["coverLetterId"],
  "laddro.coverLetters.create": ["fullName", "letterContent"],
  "laddro.coverLetters.generate": ["positionName"],
  "laddro.coverLetters.render": ["coverLetterId", "templateId"],
};

test("publishes the exact supported MCP tool catalog", () => {
  assert.deepEqual(tools.map((tool) => tool.name), expectedTools);
});

test("every published tool has production-grade metadata", () => {
  for (const tool of tools) {
    assert.match(tool.name, /^laddro\.[a-zA-Z]+\.[a-zA-Z]+$/);
    assert.equal(tool.name.includes("_"), false);
    assert.ok(tool.description.length >= 30, `${tool.name} needs a useful description`);
    assert.equal(tool.inputSchema?.type, "object", `${tool.name} needs an object input schema`);
    assert.ok(tool.inputSchema.properties, `${tool.name} needs input schema properties`);
    assert.equal(tool.outputSchema?.type, "object", `${tool.name} needs an object output schema`);
    assert.ok(tool.annotations?.title, `${tool.name} needs an annotation title`);
    assert.equal(typeof tool.annotations?.readOnlyHint, "boolean", `${tool.name} needs readOnlyHint`);
    assert.equal(typeof tool.annotations?.openWorldHint, "boolean", `${tool.name} needs openWorldHint`);

    const required = expectedRequiredFields[tool.name];
    if (required) {
      assert.deepEqual(tool.inputSchema.required, required, `${tool.name} required fields drifted`);
    }
  }
});


test("write tools are not accidentally marked read-only", () => {
  const writeToolNames = [
    "laddro.resumes.tailor",
    "laddro.coverLetters.create",
    "laddro.coverLetters.generate",
  ];

  for (const name of writeToolNames) {
    const tool = tools.find((candidate) => candidate.name === name);
    assert.equal(tool?.annotations?.readOnlyHint, false, `${name} must not be read-only`);
  }
});

test("runtime version matches package version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(version, packageJson.version);
});

test("registry metadata version matches package version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const serverJson = JSON.parse(await readFile(new URL("../server.json", import.meta.url), "utf8"));

  assert.equal(serverJson.version, packageJson.version);

  const packageEntry = serverJson.packages.find((candidate) => candidate.identifier === packageJson.name);
  assert.equal(packageEntry?.version, packageJson.version);
});

test("README documents every published tool", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  for (const name of expectedTools) {
    assert.ok(readme.includes(`\`${name}\``), `README is missing ${name}`);
  }
});

// Same requirement as the connector surface: all four hints explicit on every
// tool, and a billable download is never advertised as read-only.
test("every published tool sets all four annotation hints explicitly", () => {
  for (const tool of tools) {
    const { readOnlyHint, destructiveHint, idempotentHint, openWorldHint } = tool.annotations ?? {};
    for (const [hint, value] of Object.entries({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint })) {
      assert.equal(typeof value, "boolean", `${tool.name} must set ${hint} to true or false, got ${value}`);
    }
  }
});

test("rendering or exporting a PDF is a billable action, not a read", () => {
  for (const name of ["laddro.resumes.render", "laddro.resumes.export", "laddro.coverLetters.render"]) {
    const tool = tools.find((candidate) => candidate.name === name);
    assert.equal(tool?.annotations?.readOnlyHint, false, `${name} spends a download credit, so it is not read-only`);
    assert.equal(tool?.annotations?.idempotentHint, false, `${name} can spend another credit on a repeat call`);
  }
});
