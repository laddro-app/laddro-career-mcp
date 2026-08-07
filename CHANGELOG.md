# @laddro/career-mcp

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
