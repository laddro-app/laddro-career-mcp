import assert from "node:assert/strict";
import test from "node:test";

import { connectorTools, filterConnectorToolsByScopes } from "../dist/connectorTools.js";

const expectedNames = [
  "laddro.resume.schema",
  "laddro.resume.list",
  "laddro.resume.get",
  "laddro.resume.create",
  "laddro.resume.update",
  "laddro.resume.delete",
  "laddro.resume.setDefault",
  "laddro.resume.changeTemplate",
  "laddro.resume.exportPdf",
  "laddro.coverLetter.schema",
  "laddro.coverLetter.list",
  "laddro.coverLetter.get",
  "laddro.coverLetter.create",
  "laddro.coverLetter.renderPdf",
  "laddro.templates.list",
  "laddro.fonts.list",
  "laddro.languages.list",
];

test("connector advertises the expected tool set", () => {
  assert.deepEqual(connectorTools.map((tool) => tool.name), expectedNames);
});

test("every connector tool has a title, description, and object input schema", () => {
  for (const tool of connectorTools) {
    assert.ok(tool.description?.length > 0, `${tool.name} needs a description`);
    assert.ok(tool.annotations?.title, `${tool.name} needs a title`);
    assert.equal(tool.inputSchema?.type, "object", `${tool.name} input must be an object`);
  }
});

test("destructive tools are flagged destructiveHint; reads are read-only", () => {
  const byName = Object.fromEntries(connectorTools.map((tool) => [tool.name, tool]));
  assert.equal(byName["laddro.resume.delete"].annotations.destructiveHint, true);
  assert.equal(byName["laddro.resume.schema"].annotations.readOnlyHint, true);
  assert.equal(byName["laddro.resume.list"].annotations.readOnlyHint, true);
  assert.equal(byName["laddro.resume.create"].annotations.readOnlyHint, false);
});

test("scopes: schema/reference need none; reads need :read; writes need :write", () => {
  const byName = Object.fromEntries(connectorTools.map((tool) => [tool.name, tool]));
  assert.equal(byName["laddro.resume.schema"].requiredScope, null);
  assert.equal(byName["laddro.coverLetter.schema"].requiredScope, null);
  assert.equal(byName["laddro.templates.list"].requiredScope, null);
  assert.equal(byName["laddro.resume.list"].requiredScope, "resumes:read");
  assert.equal(byName["laddro.resume.get"].requiredScope, "resumes:read");
  assert.equal(byName["laddro.resume.create"].requiredScope, "resumes:write");
  assert.equal(byName["laddro.resume.update"].requiredScope, "resumes:write");
  assert.equal(byName["laddro.resume.delete"].requiredScope, "resumes:write");
  assert.equal(byName["laddro.resume.exportPdf"].requiredScope, "documents:render");
  assert.equal(byName["laddro.coverLetter.create"].requiredScope, "coverletters:write");
});

test("scope filter: resumes:read keeps reads + schema/reference, hides writes", () => {
  const names = filterConnectorToolsByScopes(["resumes:read"]).map((t) => t.name);
  assert.ok(names.includes("laddro.resume.schema"));
  assert.ok(names.includes("laddro.resume.list"));
  assert.ok(names.includes("laddro.resume.get"));
  assert.ok(names.includes("laddro.templates.list"));
  assert.ok(!names.includes("laddro.resume.create"));
  assert.ok(!names.includes("laddro.resume.update"));
  assert.ok(!names.includes("laddro.resume.delete"));
});

test("null scopes (no introspection) advertises the full set, requiredScope stripped", () => {
  const filtered = filterConnectorToolsByScopes(null);
  assert.deepEqual(filtered.map((tool) => tool.name), expectedNames);
  for (const tool of filtered) {
    assert.equal("requiredScope" in tool, false);
  }
});

test("update tool protects the default resume and steers tailoring to create", () => {
  const update = connectorTools.find((tool) => tool.name === "laddro.resume.update");
  const properties = update.inputSchema.properties ?? {};

  // The flag rides alongside the resume fields; the resume schema survives.
  assert.equal(properties.confirmEditDefault?.type, "boolean");
  for (const field of ["title", "locale", "personal", "summary", "sections"]) {
    assert.ok(field in properties, `update lost resume field: ${field}`);
  }
  assert.deepEqual(update.inputSchema.required, ["title", "locale", "personal", "summary"]);
  assert.ok("$defs" in update.inputSchema, "update lost the $defs needed to resolve section refs");

  // Contract: never tailor through update, and the default is guarded.
  assert.match(update.description, /NEVER use this for tailoring/);
  assert.match(update.description, /laddro\.resume\.create/);
  assert.match(update.description, /default resume is protected/);
  assert.match(properties.confirmEditDefault.description, /Never set it while tailoring/);

  // create carries the tailoring recipe instead.
  const create = connectorTools.find((tool) => tool.name === "laddro.resume.create");
  assert.match(create.description, /NEW resume/);
  assert.match(create.description, /never overwrite/i);
});

// OpenAI app review rejects a submission when any annotation hint is absent
// (read as null) or does not match the tool's real behaviour. This pins all four
// hints for all 17 tools so neither can regress silently.
const expectedHints = {
  // reads
  "laddro.resume.schema": [true, false, true, false],
  "laddro.resume.list": [true, false, true, false],
  "laddro.resume.get": [true, false, true, false],
  "laddro.coverLetter.schema": [true, false, true, false],
  "laddro.coverLetter.list": [true, false, true, false],
  "laddro.coverLetter.get": [true, false, true, false],
  "laddro.templates.list": [true, false, true, false],
  "laddro.fonts.list": [true, false, true, false],
  "laddro.languages.list": [true, false, true, false],
  // additive writes: a second call stores a second document
  "laddro.resume.create": [false, false, false, false],
  "laddro.coverLetter.create": [false, false, false, false],
  // full in-place replacement overwrites content that cannot be recovered
  "laddro.resume.update": [false, true, true, false],
  // permanent deletion
  "laddro.resume.delete": [false, true, true, false],
  // settings: overwrite a field, not document content
  "laddro.resume.setDefault": [false, false, true, false],
  "laddro.resume.changeTemplate": [false, false, true, false],
  // downloads are billed (1 credit after the first free one), so not read-only
  "laddro.resume.exportPdf": [false, false, false, false],
  "laddro.coverLetter.renderPdf": [false, false, false, false],
};

test("every connector tool sets all four annotation hints explicitly", () => {
  for (const tool of connectorTools) {
    const { readOnlyHint, destructiveHint, idempotentHint, openWorldHint } = tool.annotations ?? {};
    for (const [hint, value] of Object.entries({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint })) {
      assert.equal(typeof value, "boolean", `${tool.name} must set ${hint} to true or false, got ${value}`);
    }
  }
});

test("connector annotation hints match the documented behaviour of each tool", () => {
  assert.deepEqual(Object.keys(expectedHints).sort(), [...expectedNames].sort());
  for (const tool of connectorTools) {
    const a = tool.annotations;
    assert.deepEqual(
      [a.readOnlyHint, a.destructiveHint, a.idempotentHint, a.openWorldHint],
      expectedHints[tool.name],
      `${tool.name} hints drifted from its documented behaviour`,
    );
  }
});

test("a read-only tool is never also flagged destructive", () => {
  for (const tool of connectorTools) {
    if (tool.annotations.readOnlyHint) {
      assert.equal(tool.annotations.destructiveHint, false, `${tool.name} cannot be read-only and destructive`);
    }
  }
});
