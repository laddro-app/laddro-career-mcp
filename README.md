# @laddro/career-mcp

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

## Available tools

| Tool | Description |
|---|---|
| `list_templates` | Browse all 22 resume templates |
| `get_template` | Get template colors and fonts |
| `list_fonts` | All available font families |
| `list_languages` | All 14 supported locales |
| `list_models` | AI providers for BYOK |
| `list_resumes` | User's resumes |
| `get_resume` | Resume metadata |
| `render_resume` | Re-render with new template settings |
| `tailor_resume` | AI-tailor resume for a job |
| `export_resume` | Export as PDF |
| `list_cover_letters` | User's cover letters |
| `get_cover_letter` | Cover letter metadata |
| `create_cover_letter` | Create manually |
| `generate_cover_letter` | AI-generate from resume + job |
| `render_cover_letter` | Render with template settings |
| `get_settings` | Current AI provider config |
| `update_ai_model` | Set BYOK provider |
| `delete_ai_model` | Remove BYOK config |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LADDRO_API_KEY` | Yes | Your Laddro API key |
| `LADDRO_BASE_URL` | No | Override API URL (default: `https://api.laddro.com`) |

## Links

- [laddro.com](https://laddro.com)
- [API Reference](https://api.laddro.com/reference)
- [Docs](https://docs.laddro.com)
- [GitHub](https://github.com/laddro-app)

## License

MIT
