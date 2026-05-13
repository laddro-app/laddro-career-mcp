import assert from "node:assert/strict";
import test from "node:test";

import { createHandlers } from "../dist/handlers.js";

test("handler dispatches published dotted tool names", async () => {
  const handler = createHandlers({
    templates: {
      list: async () => ({ templates: [{ id: "GRAPHITE", name: "Graphite" }] }),
    },
  });

  const result = await handler("laddro.templates.list", {});

  assert.equal(result.isError, undefined);
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), {
    templates: [{ id: "GRAPHITE", name: "Graphite" }],
  });
});

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
