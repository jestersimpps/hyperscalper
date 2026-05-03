# Hyperscalper MCP Server

Local MCP server exposing Hyperliquid trading data to Claude Code. Read-only at the moment — only `get_positions` is implemented.

## Install

```bash
cd mcp
npm install
```

## Configure

Reads `HYPERLIQUID_WALLET_ADDRESS` and `HYPERLIQUID_TESTNET` from the parent repo's `.env.local`.

## Run standalone (debug)

```bash
npm start
```

It will sit on stdio waiting for MCP messages. You normally don't run it directly — Claude Code launches it via `.claude/settings.json` in the repo root.

## Use from Claude Code

The repo's `.claude/settings.json` registers this server. After `npm install` here, run `claude` from the repo root and it will pick up the `hyperscalper` MCP server. Try:

> What positions do I have open?

## Tools

| Tool | Args | Returns |
|---|---|---|
| `get_positions` | `user?: string` | open perp positions for the wallet (default = `HYPERLIQUID_WALLET_ADDRESS`) |
