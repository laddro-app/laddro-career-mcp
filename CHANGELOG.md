# @laddro/career-mcp

## 0.6.0

### Minor Changes

- 8a6f01f: Remove the four tools that call endpoints the Career API deleted in June.

  `laddro.models.list`, `laddro.settings.get`, `laddro.settings.updateModel` and
  `laddro.settings.deleteModel` mapped to `GET /v1/models`, `GET /v1/settings` and
  `PUT`/`DELETE /v1/settings/model`. All four were removed from career-api in
  `622b228` on 2026-06-27 when BYOK was dropped and AI was routed through ai-core.
  Verified against production: every one returns 404 today, with and without a
  key, so any agent calling them got an error rather than an answer.

  This is a breaking change for anyone who wired those four tools, but they have
  not worked since June — there is nothing behind them to keep.

  The remaining 14 tools were each checked against production and all resolve:
  public endpoints return 200 and authenticated ones return 401, so none is a
  dead route.

### Patch Changes

- 7eede46: Set all four MCP annotation hints explicitly on every tool, and correct the ones that did not match behaviour.

  `idempotentHint` was never set, so every tool advertised it as null - the reason OpenAI app review rejected the ChatGPT app. It is now explicit on all tools, alongside `readOnlyHint`, `destructiveHint` and `openWorldHint`.

  Two behaviour mismatches fixed:

  - `laddro.resume.update` is now `destructiveHint: true`. It replaces a resume's entire content in place and the previous version is not recoverable.
  - `laddro.resumes.render`, `laddro.resumes.export` and `laddro.coverLetters.render` are no longer `readOnlyHint: true`. A download is a billed action: the first per document type is free, each one after costs a credit.

  `ANNOTATIONS.md` documents the justification for every value and the tests pin them.

## 0.5.1

### Patch Changes

- 041b231: Point the npm `homepage` at https://www.laddro.com/en/mcp instead of
  https://docs.laddro.com.

  Registry and package listings are the only channel that has ever earned this
  project external links: of the 61 backlinks laddro.com has, 59 came from MCP
  directory listings and just 2 point at `www`, the host that actually has to
  rank. `server.json`'s `websiteUrl` was already corrected and 0.5.0 is live in
  the official MCP registry pointing at www, but npm's own package page still
  linked to the docs subdomain, so that link kept feeding a host we do not need
  to rank.

  The target serves 200 and is a real 937-word page, not a redirect.

## 0.5.0

### Minor Changes

- b552239: Return artifact metadata before generated PDF and ZIP resources.

### Patch Changes

- b4f9ca8: Fix MCP error `-32600 "Tool has an output schema but did not return structured content"` on every tool call.

  The MCP spec requires tools that declare an `outputSchema` to populate `structuredContent` on the response. The `json` and `binary` helpers in `handlers.ts` were returning `content[]` blocks only, which made the SDK reject every response.

  - `json(data)` now sets `structuredContent` to the data (wrapping non-object values in `{ value }` so the field is always an object).
  - `binary(data, mimeType, metadata)` now sets `structuredContent` to `{ content: base64, mimeType, ...metadata }`, matching the declared `pdfResultSchema`.

  This unblocks every published tool — `templates.list`, `resumes.render`, `resumes.export`, `resumes.tailor`, `settings.get`, and all the others.

## 0.4.0

### Minor Changes

- 7f09fd8: Return artifact metadata before generated PDF and ZIP resources.

## 0.3.3

### Patch Changes

- 2aa55d4: Read runtime version from package metadata and sync registry metadata during release versioning.

## 0.3.2

### Patch Changes

- a8e78a3: Add automated Changesets release management, PR template, and stronger MCP contract tests.
