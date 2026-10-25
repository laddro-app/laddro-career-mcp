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

// Same policy as the description test in connectorTools.test.mjs: an
// entitlement wall may be explained, never monetised. career-api writes its
// requires_upgrade copy as an upsell for other surfaces, so the connector must
// drop both that message and its upgradeUrl.
test("an entitlement wall is relayed without any commerce content", async () => {
  const body = {
    error:
      "You've used your free resume download. Subscribe to a Laddro plan for unlimited downloads, or buy a credit pack (1 credit per download). Subscribe or get credits at https://www.laddro.com/en/plans",
    code: "requires_upgrade",
    upgradeUrl: "https://www.laddro.com/en/plans",
  };
  await withFetch(
    () => jsonResponse(body, 403),
    async () => {
      const handle = createConnectorHandlers("lad_at_test");
      const result = await handle("laddro.resume.exportPdf", { resumeId: "r-1" });

      assert.notEqual(result.isError, true, "an entitlement wall must not read as a failure");
      const payload = JSON.parse(result.content[0].text);
      assert.equal(payload.status, "download_not_available");
      assert.equal(payload.upgradeUrl, undefined, "the upgrade link must never reach the model");
      const serialised = JSON.stringify(payload);
      assert.doesNotMatch(serialised, /laddro\.com/, "no link may be relayed");
      assert.doesNotMatch(
        serialised.replace(/Do NOT[^"]*/g, ""),
        /\b(credits?|subscribe|subscription|upgrade|buy|price|plan)\b/i,
        "the relayed copy must not sell"
      );
    }
  );
});

test("each call uses the token the session holds NOW, not the one it opened with", async () => {
  await withFetch(
    () => jsonResponse({ resumes: [] }),
    async (calls) => {
      let token = "lad_at_first";
      const handle = createConnectorHandlers(() => token);
      await handle("laddro.resume.list", {});
      token = "lad_at_refreshed";
      await handle("laddro.resume.list", {});

      const sent = calls.map((c) => new Headers(c.init.headers).get("authorization"));
      assert.deepEqual(sent, ["Bearer lad_at_first", "Bearer lad_at_refreshed"]);
    }
  );
});

test("a token career-api refuses is marked, so the next request is turned away with a 401", async () => {
  const { isTokenRejected } = await import("../dist/rejectedTokens.js");
  await withFetch(
    () => jsonResponse({ error: "Access token has expired", code: "token_expired" }, 401),
    async () => {
      const handle = createConnectorHandlers("lad_at_expired");
      const result = await handle("laddro.resume.list", {});

      assert.equal(result.isError, true);
      assert.equal(isTokenRejected("lad_at_expired"), true);
      assert.equal(isTokenRejected("lad_at_someone_else"), false);
    }
  );
});

test("the cover-letter schema tool describes what create accepts, not the stored document", async () => {
  const handle = createConnectorHandlers("lad_at_test");
  const result = await handle("laddro.coverLetter.schema", {});
  const schema = JSON.parse(result.content[0].text);

  assert.ok(schema.properties.letterContent, "letterContent must be a top-level field");
  assert.ok(schema.properties.fullName, "fullName must be a top-level field");
  assert.equal(schema.properties.content, undefined, "the nested storage shape makes create 400");
});

test("the one-resume limit comes back as a way forward, not a dead-end error", async () => {
  await withFetch(
    () => jsonResponse({ error: "complete your current resume to at least 70% before creating a new one", code: "limit_exceeded" }, 409),
    async () => {
      const handle = createConnectorHandlers("lad_at_test");
      const result = await handle("laddro.resume.create", { title: "T", locale: "en", personal: {}, summary: {} });

      assert.notEqual(result.isError, true);
      const payload = JSON.parse(result.content[0].text);
      assert.equal(payload.status, "unfinished_resume_exists");
      assert.match(payload.instructions, /laddro\.resume\.update/);
      assert.match(payload.instructions, /Never overwrite it without asking/);
    }
  );
});
