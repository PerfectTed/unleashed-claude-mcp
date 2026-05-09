# Railway Deployment

## Personal test deployment

Use this repo while Railway cannot install its GitHub App in the PerfectTed organization:

```text
https://github.com/tec-ted/unleashed-claude-mcp-personal
```

## Production repository

Use this repo once a PerfectTed organization owner approves or installs Railway:

```text
https://github.com/PerfectTed/unleashed-claude-mcp
```

## Environment variables

```env
NODE_ENV=production
UNLEASHED_API_ID=
UNLEASHED_API_KEY=
UNLEASHED_BASE_URL=https://api.unleashedsoftware.com
UNLEASHED_CLIENT_TYPE=PerfectTed Claude MCP
```

Optional:

```env
MCP_AUTH_TOKEN=
```

Only set `MCP_AUTH_TOKEN` for clients that can send an `Authorization: Bearer ...` header. Claude custom connectors accept a remote MCP URL and optional OAuth client settings, so a static bearer token is not enough for Claude unless an OAuth layer or auth proxy is added.

For Claude smoke testing, deploy without Unleashed credentials first to confirm the connector loads. Add real Unleashed credentials only when the Railway URL is not being shared and the approved auth approach is clear.

## Claude connector URL

After Railway deploys, open the generated public domain and use:

```text
https://your-service.up.railway.app/mcp
```

The Railway health check uses:

```text
https://your-service.up.railway.app/health
```
