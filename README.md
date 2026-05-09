# Unleashed Claude MCP

Read-only Claude MCP connector for approved Unleashed API access, deployable on Railway.

## Goal

Expose a small, approved set of read-only Unleashed API calls to Claude as a remote MCP connector.

## Hosting

- Platform: Railway
- Transport: Streamable HTTP MCP endpoint
- Intended connector: Claude custom connector

## Endpoints

- `GET /health` - Railway health check
- `POST /mcp` - Claude MCP endpoint
- `GET /mcp` - MCP server-to-client stream for active sessions
- `DELETE /mcp` - MCP session termination

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The server starts on `http://localhost:3000` by default.

## Railway

Set these variables in Railway:

```env
UNLEASHED_API_ID=
UNLEASHED_API_KEY=
NODE_ENV=production
```

`MCP_AUTH_TOKEN` is supported for clients that can send an `Authorization: Bearer ...` header. For Claude custom connector testing, leave it unset unless an OAuth layer or proxy is added, because Claude's connector setup accepts a remote MCP URL and optional OAuth client settings rather than a static bearer token.

After deploy, use the public Railway URL as the Claude connector endpoint:

```text
https://your-service.up.railway.app/mcp
```

## Security

- Read-only tools only
- Explicit Unleashed endpoint allowlist
- Optional bearer token protection for clients that support custom auth headers
- Secrets stored in Railway environment variables
- No raw secret values in logs

## Current tools

- `unleashed_list_customers`
- `unleashed_get_customer`
- `unleashed_list_products`
- `unleashed_get_product`
- `unleashed_list_sales_orders`
- `unleashed_get_sales_order`

Customer tools return business-safe fields by default. Contact/address fields are hidden unless the tool call explicitly requests them.
