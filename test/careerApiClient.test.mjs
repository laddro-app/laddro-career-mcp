import assert from "node:assert/strict";
import test from "node:test";

import { CareerApiClient } from "../dist/careerApiClient.js";

// Capture the outgoing request instead of hitting the network.
function withStubbedFetch(run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  return run(calls).finally(() => {
    globalThis.fetch = original;
  });
}

test("updateResume only opts into overwriting the default when told to", async () => {
  await withStubbedFetch(async (calls) => {
    const client = new CareerApiClient("lad_at_test", "https://api.example.com");

    await client.updateResume("r-1", { title: "T" });
    assert.equal(calls[0].url, "https://api.example.com/v1/resumes/r-1");

    await client.updateResume("r-1", { title: "T" }, true);
    assert.equal(calls[1].url, "https://api.example.com/v1/resumes/r-1?confirmEditDefault=true");

    // The flag is a routing concern and must never be sent as resume content.
    assert.equal(JSON.parse(calls[1].init.body).confirmEditDefault, undefined);
  });
});
