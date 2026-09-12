import assert from "node:assert/strict";
import test from "node:test";

import { createConnectorHandlers } from "../dist/connectorHandlers.js";

function withFetch(responder, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return responder(url, init);
  };
  return run(calls).finally(() => {
    globalThis.fetch = original;
  });
}

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("a protected-default refusal comes back as guidance, not an error", async () => {
  const body = {
    error: "This is the user's default resume and was not changed.",
    code: "default_resume_protected",
  };
  await withFetch(
    () => jsonResponse(body, 409),
    async () => {
      const handle = createConnectorHandlers("lad_at_test");
      const result = await handle("laddro.resume.update", {
        resumeId: "r-1",
        title: "T",
        locale: "en",
        personal: {},
        summary: {},
      });

      assert.notEqual(result.isError, true, "a policy refusal must not read as a failure");
      const payload = JSON.parse(result.content[0].text);
      assert.equal(payload.status, "default_resume_protected");
      assert.match(payload.instructions, /laddro\.resume\.create/);
      assert.match(payload.instructions, /NOT modified/);
    }
  );
});

test("confirmEditDefault travels as a query flag, never as resume content", async () => {
  await withFetch(
    () => jsonResponse({ status: "updated" }),
    async (calls) => {
      const handle = createConnectorHandlers("lad_at_test");
      await handle("laddro.resume.update", {
        resumeId: "r-1",
        confirmEditDefault: true,
        title: "T",
        locale: "en",
        personal: {},
        summary: {},
      });

      assert.match(calls[0].url, /\?confirmEditDefault=true$/);
      const sent = JSON.parse(calls[0].init.body);
      assert.equal(sent.confirmEditDefault, undefined);
      assert.equal(sent.title, "T");
    }
  );
});
