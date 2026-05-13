import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import { tools } from "../dist/tools.js";
import { version } from "../dist/version.js";

const toolNames = tools.map((tool) => tool.name);

test("publishes dotted MCP tool names only", () => {
  assert.equal(tools.length, 18);
  assert.ok(toolNames.includes("laddro.templates.list"));
  assert.ok(toolNames.includes("laddro.settings.updateModel"));
  assert.ok(toolNames.includes("laddro.settings.deleteModel"));
  assert.ok(!toolNames.includes("parse_resume"));

  for (const name of toolNames) {
    assert.match(name, /^laddro\.[a-zA-Z]+\.[a-zA-Z]+$/);
    assert.equal(name.includes("_"), false);
  }
});

test("runtime version matches package version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(version, packageJson.version);
});
