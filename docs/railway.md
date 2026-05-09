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
MCP_AUTH_TOKEN=
UNLEASHED_BASE_URL=https://api.unleashedsoftware.com
UNLEASHED_CLIENT_TYPE=PerfectTed Claude MCP
```

`MCP_AUTH_TOKEN` is optional for local smoke tests, but should be set on Railway.

## Claude connector URL

After Railway deploys, open the generated public domain and use:

```text
https://your-service.up.railway.app/mcp
```

The Railway health check uses:

```text
https://your-service.up.railway.app/health
```
