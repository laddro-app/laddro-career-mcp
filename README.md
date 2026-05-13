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

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LADDRO_API_KEY` | Yes for stdio; optional fallback for HTTP | Your Laddro API key |
| `LADDRO_BASE_URL` | No | Override API URL (default: `https://api.laddro.com`) |

## Links

- [laddro.com](https://laddro.com)
- [API Reference](https://api.laddro.com/reference)
- [Docs](https://docs.laddro.com)
- [GitHub](https://github.com/laddro-app)

## License

MIT
