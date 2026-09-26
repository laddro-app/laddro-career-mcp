---
"@laddro/career-mcp": patch
---

Set all four MCP annotation hints explicitly on every tool, and correct the ones that did not match behaviour.

`idempotentHint` was never set, so every tool advertised it as null - the reason OpenAI app review rejected the ChatGPT app. It is now explicit on all tools, alongside `readOnlyHint`, `destructiveHint` and `openWorldHint`.

Two behaviour mismatches fixed:

- `laddro.resume.update` is now `destructiveHint: true`. It replaces a resume's entire content in place and the previous version is not recoverable.
- `laddro.resumes.render`, `laddro.resumes.export` and `laddro.coverLetters.render` are no longer `readOnlyHint: true`. A download is a billed action: the first per document type is free, each one after costs a credit.

`ANNOTATIONS.md` documents the justification for every value and the tests pin them.
