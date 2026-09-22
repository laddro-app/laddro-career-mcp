---
'@laddro/career-mcp': minor
---

Remove the four tools that call endpoints the Career API deleted in June.

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
