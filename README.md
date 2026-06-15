# Unleashed Claude MCP

Claude MCP connector for approved Unleashed API access, deployable on Railway.

## Goal

Expose a small, approved set of Unleashed API calls to Claude as a remote MCP connector.

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
UNLEASHED_ENABLE_WRITE_TOOLS=false
NODE_ENV=production
```

`MCP_AUTH_TOKEN` is supported for clients that can send an `Authorization: Bearer ...` header or `x-api-key` header. Claude.ai custom connectors cannot send custom headers from the URL field, so use the query parameter form when this variable is set:

```text
https://your-service.up.railway.app/mcp?api_key=YOUR_MCP_AUTH_TOKEN
```

After deploy, use the public Railway URL as the Claude connector endpoint:

```text
https://your-service.up.railway.app/mcp
```

## Security

- Read tools plus one guarded purchase order upload tool
- Explicit Unleashed endpoint allowlist
- Write tools are disabled unless `UNLEASHED_ENABLE_WRITE_TOOLS=true`
- Purchase order upload requires a dry-run review and explicit `confirmUpload=true`
- Optional bearer token protection for clients that support custom auth headers
- Secrets stored in Railway environment variables
- No raw secret values in logs

## Write scope

Purchase order upload is the only write tool currently exposed.

- Tool: `unleashed_create_purchase_order`
- Endpoint: `POST /PurchaseOrders` or `POST /PurchaseOrders/{purchaseOrderGuid}`
- Default behavior: dry-run only
- Required for live upload: `UNLEASHED_ENABLE_WRITE_TOOLS=true`, `dryRun=false`, and `confirmUpload=true`
- Default order status: `Parked`
- Supported upload statuses: `Parked`, `Placed`

## Current tools

- `unleashed_list_customers`
- `unleashed_get_customer`
- `unleashed_list_products`
- `unleashed_get_product`
- `unleashed_list_sales_orders`
- `unleashed_get_sales_order`
- `unleashed_create_purchase_order`

Customer tools return business-safe fields by default. Contact/address fields are hidden unless the tool call explicitly requests them.
