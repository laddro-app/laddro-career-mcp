import assert from "node:assert/strict";
import test from "node:test";

import { connectorTools, filterConnectorToolsByScopes } from "../dist/connectorTools.js";

const expectedNames = [
  "laddro.resume.schema",
  "laddro.resume.create",
  "laddro.resume.update",
  "laddro.coverLetter.schema",
];

test("connector advertises the expected tool set", () => {
  assert.deepEqual(connectorTools.map((tool) => tool.name), expectedNames);
});

test("every connector tool description carries the storage mantra", () => {
  for (const tool of connectorTools) {
    assert.ok(
      tool.description.includes("You write the content. Laddro stores it and renders the PDF."),
      `${tool.name} missing the storage mantra`,
    );
    assert.ok(tool.annotations?.title, `${tool.name} needs a title`);
    assert.equal(tool.inputSchema?.type, "object");
  }
});

test("schema tools require no scope; write tools require resumes:write", () => {
  const byName = Object.fromEntries(connectorTools.map((tool) => [tool.name, tool]));
  assert.equal(byName["laddro.resume.schema"].requiredScope, null);
  assert.equal(byName["laddro.coverLetter.schema"].requiredScope, null);
  assert.equal(byName["laddro.resume.create"].requiredScope, "resumes:write");
  assert.equal(byName["laddro.resume.update"].requiredScope, "resumes:write");
});

test("scope filter hides write tools when scope absent, keeps schema tools", () => {
  const filtered = filterConnectorToolsByScopes(["resumes:read"]);
  const names = filtered.map((tool) => tool.name);
  assert.ok(names.includes("laddro.resume.schema"));
  assert.ok(names.includes("laddro.coverLetter.schema"));
  assert.ok(!names.includes("laddro.resume.create"));
  assert.ok(!names.includes("laddro.resume.update"));
});

test("null scopes (no introspection) advertises the full set", () => {
  const filtered = filterConnectorToolsByScopes(null);
  assert.deepEqual(filtered.map((tool) => tool.name), expectedNames);
  // requiredScope is stripped from advertised tools.
  for (const tool of filtered) {
    assert.equal("requiredScope" in tool, false);
  }
});
