# Tool annotation hints

Every tool this server advertises sets all four MCP annotation hints
explicitly - `readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`. None is omitted, so no client can read one as `null`.

This file records why each value is what it is, based on what the tool actually
does. It is the source for the justification we give OpenAI app review, and the
tests in `test/connectorTools.test.mjs` and `test/tools.test.mjs` pin every
value here so it cannot drift from the code.

## How the values are decided

- **`readOnlyHint: true`** only when the call changes nothing at all: no stored
  document, no setting, no balance. A call that spends a download credit is not
  a read, even though it returns a document.
- **`destructiveHint: true`** only when data that existed before the call is
  gone or overwritten afterwards and cannot be recovered through this API.
- **`idempotentHint: true`** when repeating the call with the same arguments
  leaves the same end state. It is `false` wherever a repeat creates an extra
  document or spends another credit.
- **`openWorldHint: false`** on every tool. Each one talks only to the caller's
  own Laddro account through `api.laddro.com`. No tool searches the web, calls a
  third party, or reaches anything outside that closed, bounded domain.

## Connector tools (ChatGPT app / OAuth session)

| Tool | read | destr. | idem. | Behaviour that justifies it |
|---|---|---|---|---|
| `laddro.resume.schema` | ✅ | ❌ | ✅ | Returns a static JSON Schema. Stores nothing. |
| `laddro.resume.list` | ✅ | ❌ | ✅ | `GET /v1/resumes`. |
| `laddro.resume.get` | ✅ | ❌ | ✅ | `GET /v1/resumes/{id}`. |
| `laddro.coverLetter.schema` | ✅ | ❌ | ✅ | Returns a static JSON Schema. |
| `laddro.coverLetter.list` | ✅ | ❌ | ✅ | `GET /v1/cover-letters`. |
| `laddro.coverLetter.get` | ✅ | ❌ | ✅ | `GET /v1/cover-letters/{id}`. |
| `laddro.templates.list` | ✅ | ❌ | ✅ | Public reference list. |
| `laddro.fonts.list` | ✅ | ❌ | ✅ | Public reference list. |
| `laddro.languages.list` | ✅ | ❌ | ✅ | Public reference list. |
| `laddro.resume.create` | ❌ | ❌ | ❌ | `POST /v1/resumes` stores a **new** resume. Two calls leave two resumes, so not idempotent. Nothing existing is touched, so not destructive. |
| `laddro.coverLetter.create` | ❌ | ❌ | ❌ | `POST /v1/cover-letters`, same reasoning. |
| `laddro.resume.update` | ❌ | **✅** | ✅ | `PUT /v1/resumes/{id}` **replaces the whole resume content in place**. The previous version is overwritten and this API offers no way back, so it is destructive. Sending the same body twice leaves the same end state, so it is idempotent. The user's default resume is additionally protected server-side: without `confirmEditDefault: true` the call is refused. |
| `laddro.resume.delete` | ❌ | **✅** | ✅ | `DELETE /v1/resumes/{id}`, permanent. After the first call the resume is gone; a repeat changes nothing further. |
| `laddro.resume.setDefault` | ❌ | ❌ | ✅ | `PATCH /v1/resumes/{id}/default` flips one flag. No document content is lost, so not destructive; setting the same default twice is the same state. |
| `laddro.resume.changeTemplate` | ❌ | ❌ | ✅ | `PATCH /v1/resumes/{id}/template` sets a template id. Presentation only - the resume's content is untouched. |
| `laddro.resume.exportPdf` | ❌ | ❌ | ❌ | `POST /v1/export`. **Not a read**: a download is a billed action. The first resume download per user is free and recorded in the `feature_usage` ledger; after that each one costs 1 credit, and with no balance the API answers `403 requires_upgrade`. A repeat call can spend another credit and returns a fresh 24-hour download URL, so not idempotent. It destroys nothing. |
| `laddro.coverLetter.renderPdf` | ❌ | ❌ | ❌ | `PUT /v1/cover-letters/{id}/render`, same billing and reasoning as above with its own free-download allowance. |

## Direct API tools (npm / stdio server, `x-api-key`)

Same rules. The reads (`templates.*`, `fonts.list`, `languages.list`,
`resumes.list`, `resumes.get`, `coverLetters.list`, `coverLetters.get`) are
`readOnly: true, destructive: false, idempotent: true, openWorld: false`.

| Tool | read | destr. | idem. | Behaviour that justifies it |
|---|---|---|---|---|
| `laddro.resumes.render` | ❌ | ❌ | ❌ | Billed download (see `exportPdf`). Previously mis-annotated as read-only; corrected. |
| `laddro.resumes.export` | ❌ | ❌ | ❌ | Billed download. Previously mis-annotated as read-only; corrected. |
| `laddro.coverLetters.render` | ❌ | ❌ | ❌ | Billed download. Previously mis-annotated as read-only; corrected. |
| `laddro.resumes.tailor` | ❌ | ❌ | ❌ | `POST /v1/tailor` spends 1 credit and produces a new tailored document. Does not overwrite the source resume. |
| `laddro.coverLetters.generate` | ❌ | ❌ | ❌ | `POST /v1/cover-letters/generate` spends 1 credit and produces a new letter. |
| `laddro.coverLetters.create` | ❌ | ❌ | ❌ | Stores a new cover letter; a repeat stores a second one. |

Billing behaviour above is enforced in `laddro-career-api`
(`internal/middleware/usagelimit.go`, `gateForRequest`), which is the same
middleware both surfaces go through.
