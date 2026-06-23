# @laddro/career-mcp

[![smithery badge](https://smithery.ai/badge/laddro/career)](https://smithery.ai/servers/laddro/career)

MCP server for the [Laddro Career API](https://api.laddro.com/reference). Gives AI agents access to resume tailoring, cover letter generation, PDF export, and template browsing.

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "laddro-career": {
      "command": "npx",
      "args": ["@laddro/career-mcp"],
      "env": {
        "LADDRO_API_KEY": "laddro_live_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add laddro-career -- npx @laddro/career-mcp
```

Set the environment variable `LADDRO_API_KEY` before running.

### Remote HTTP

Use the hosted Streamable HTTP endpoint:

```text
https://mcp.laddro.com/mcp
```

Send your Laddro API key on the MCP initialize request:

```http
Authorization: Bearer laddro_live_...
```

or:

```http
x-api-key: laddro_live_...
```

## Available tools

| Tool | Description |
|---|---|
| `laddro.templates.list` | Browse all 22 resume templates |
| `laddro.templates.get` | Get template colors and fonts |
| `laddro.fonts.list` | All available font families |
| `laddro.languages.list` | All 14 supported locales |
| `laddro.models.list` | AI providers for BYOK |
| `laddro.resumes.list` | User's resumes |
| `laddro.resumes.get` | Resume metadata |
| `laddro.resumes.render` | Re-render with new template settings |
| `laddro.resumes.tailor` | AI-tailor resume for a job |
| `laddro.resumes.export` | Export as PDF |
| `laddro.coverLetters.list` | User's cover letters |
| `laddro.coverLetters.get` | Cover letter metadata |
| `laddro.coverLetters.create` | Create manually |
| `laddro.coverLetters.generate` | AI-generate from resume + job |
| `laddro.coverLetters.render` | Render with template settings |
| `laddro.settings.get` | Current AI provider config |
| `laddro.settings.updateModel` | Set BYOK provider |
| `laddro.settings.deleteModel` | Remove BYOK config |

## Connector (OAuth) mode

Behind the `MCP_CONNECTOR_ENABLED` flag (default off). When enabled and a request
carries `Authorization: Bearer lad_at_*` (a Laddro OAuth access token), the server
runs an OAuth connector session that forwards the token to **laddro-backend**
(`service.laddro.com`) instead of career-api. It also serves
`GET /.well-known/oauth-protected-resource` (RFC 9728) and answers unauthenticated
`/mcp` calls with `401 + WWW-Authenticate: Bearer resource_metadata=...` so OAuth
clients can discover the authorization server. With the flag off, behaviour is
unchanged (no discovery route, no 401 enforcement, all 18 tools via career-api).

Connector tools (OAuth sessions only): "You write the content. Laddro stores it
and renders the PDF."

| Tool | Scope | Description |
|---|---|---|
| `laddro.resume.schema` | — | JSON Schema for resume content |
| `laddro.resume.create` | `resumes:write` | Create a resume, returns `{ resumeId }` |
| `laddro.resume.update` | `resumes:write` | Full-replace a resume, returns `{ resumeId, updatedAt }` |
| `laddro.coverLetter.schema` | — | JSON Schema for cover-letter content |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LADDRO_API_KEY` | Yes for stdio; optional fallback for HTTP | Your Laddro API key |
| `LADDRO_BASE_URL` | No | Override API URL (default: `https://api.laddro.com`) |
| `MCP_CONNECTOR_ENABLED` | No | `true` enables OAuth connector mode (default off) |
| `LADDRO_BACKEND_URL` | No | Backend base URL for connector tools (default: `https://service.laddro.com`) |
| `MCP_PUBLIC_URL` | No | This server's public URL for OAuth metadata (else derived from forwarded headers) |

## Development

```bash
npm ci
npm test
```

`npm test` builds the TypeScript package and runs MCP contract tests for auth handling, tool metadata, and handler routing.

## Releases

This package uses Changesets and SemVer.

- Patch: bug fixes, docs, tests, internal hardening.
- Minor: new backwards-compatible MCP tools or capabilities.
- Major: breaking tool names, schemas, auth, or transport behavior.

Every PR that changes the published package should include a changeset:

```bash
npm run changeset
```

After the PR merges to `main`, GitHub Actions opens a release PR with the version bump and changelog. Merging that release PR publishes the package to npm and creates the GitHub release. The Cloud Run deploy workflow also runs on `main`, so hosted MCP updates automatically after release merges.

## Links

- [laddro.com](https://laddro.com)
- [API Reference](https://api.laddro.com/reference)
- [Docs](https://docs.laddro.com)
- [GitHub](https://github.com/laddro-app)

## License

MIT
