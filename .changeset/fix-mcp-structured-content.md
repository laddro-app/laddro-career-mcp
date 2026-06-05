---
"@laddro/career-mcp": patch
---

Fix MCP error `-32600 "Tool has an output schema but did not return structured content"` on every tool call.

The MCP spec requires tools that declare an `outputSchema` to populate `structuredContent` on the response. The `json` and `binary` helpers in `handlers.ts` were returning `content[]` blocks only, which made the SDK reject every response.

- `json(data)` now sets `structuredContent` to the data (wrapping non-object values in `{ value }` so the field is always an object).
- `binary(data, mimeType, metadata)` now sets `structuredContent` to `{ content: base64, mimeType, ...metadata }`, matching the declared `pdfResultSchema`.

This unblocks every published tool — `templates.list`, `resumes.render`, `resumes.export`, `resumes.tailor`, `settings.get`, and all the others.
