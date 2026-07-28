#!/usr/bin/env bash
#
# Publish server.json to the official MCP registry from your machine.
#
# CI does this automatically on every release (see
# .github/workflows/publish-registry.yml). Use this script for a manual
# catch-up publish, e.g. when the registry has drifted behind npm.
#
# Auth is DNS-based. The Ed25519 public key is in the laddro.com TXT record
# (v=MCPv1; k=ed25519; p=...). You need the matching private key (hex).
#
# Usage:
#   MCP_PUBLISHER_ED25519_KEY=<hex-private-key> ./scripts/publish-registry.sh
#
# Requires the `mcp-publisher` CLI on PATH (brew install mcp-publisher, or
# download from github.com/modelcontextprotocol/registry/releases).

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v mcp-publisher >/dev/null 2>&1; then
  echo "error: mcp-publisher not found on PATH." >&2
  echo "  Install: https://github.com/modelcontextprotocol/registry/releases" >&2
  exit 1
fi

if [ -z "${MCP_PUBLISHER_ED25519_KEY:-}" ]; then
  echo "error: MCP_PUBLISHER_ED25519_KEY is not set (Ed25519 private key, hex)." >&2
  echo "  This is the private half of the key published in laddro.com's DNS TXT record." >&2
  exit 1
fi

VERSION="$(node -p "require('./server.json').version")"
NAME="$(node -p "require('./server.json').name")"

echo "Validating server.json..."
mcp-publisher validate

echo "Authenticating with the registry (DNS, laddro.com)..."
mcp-publisher login dns --domain laddro.com --private-key "$MCP_PUBLISHER_ED25519_KEY"

echo "Publishing $NAME@$VERSION..."
mcp-publisher publish

echo "Done. Verifying live version..."
sleep 5
curl -fsSL "https://registry.modelcontextprotocol.io/v0/servers?search=com.laddro" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d).servers||[];const latest=s.find(x=>x._meta?.['io.modelcontextprotocol.registry/official']?.isLatest)||s.at(-1);console.log('registry latest:', latest?.server?.name, latest?.server?.version);});"
