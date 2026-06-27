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
  "laddro.resume.tailor",
  "laddro.resume.exportPdf",
  "laddro.coverLetter.schema",
  "laddro.coverLetter.list",
  "laddro.coverLetter.get",
  "laddro.coverLetter.create",
  "laddro.coverLetter.generate",
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
