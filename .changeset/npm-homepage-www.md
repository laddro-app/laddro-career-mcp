---
'@laddro/career-mcp': patch
---

Point the npm `homepage` at https://www.laddro.com/en/mcp instead of
https://docs.laddro.com.

Registry and package listings are the only channel that has ever earned this
project external links: of the 61 backlinks laddro.com has, 59 came from MCP
directory listings and just 2 point at `www`, the host that actually has to
rank. `server.json`'s `websiteUrl` was already corrected and 0.5.0 is live in
the official MCP registry pointing at www, but npm's own package page still
linked to the docs subdomain, so that link kept feeding a host we do not need
to rank.

The target serves 200 and is a real 937-word page, not a redirect.
