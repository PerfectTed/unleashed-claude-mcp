# Implementation Plan

## 1. Project scaffold

- [x] Create a Node.js and TypeScript MCP server.
- [x] Add build, start, and development scripts.
- [x] Add Railway-compatible HTTP server entrypoint.
- [x] Add `.env.example` for required secrets.

## 2. Claude connector endpoint

- [x] Expose the MCP server over Streamable HTTP.
- [x] Use `/mcp` as the primary endpoint.
- [x] Add a simple `/health` endpoint for Railway checks.
- [x] Require bearer authentication before MCP requests are handled when `MCP_AUTH_TOKEN` is set.

## 3. Unleashed API client

- [x] Read `UNLEASHED_API_ID` and `UNLEASHED_API_KEY` from environment variables.
- [x] Sign requests with Unleashed `api-auth-signature`.
- [x] Centralize request timeout and error handling.
- [x] Keep logs free of API keys, signatures, and private customer details.
- [ ] Confirm each approved endpoint's exact Unleashed query parameters against the spreadsheet.

## 4. Read-only tool allowlist

- [x] Implement initial read-only tools for customers, products, and sales orders.
- [x] Keep tool names specific and business-friendly.
- [x] Validate input schemas before calling Unleashed.
- [ ] Add the remaining approved read-only tools from the review matrix.
- [ ] Tune response summaries after testing against live Unleashed data.

## 5. Customer data policy

- Customer records are allowed for B2B/trade accounts and generic channels such as Shopify, Amazon, or web sales.
- Personal consumer records should be excluded or masked.
- Contact details should be returned only when they are needed for the approved use case.

## 6. Railway deployment

- [ ] Connect Railway to `PerfectTed/unleashed-claude-mcp` after a PerfectTed org owner installs the Railway GitHub App.
- [ ] For early testing, connect Railway to `tec-ted/unleashed-claude-mcp-personal`.
- [ ] Set required environment variables in Railway.
- [ ] Deploy from the main branch.
- [ ] Use the Railway public domain as the Claude connector URL.

## 7. Acceptance checks

- Claude can connect to the Railway MCP URL.
- Unauthorized requests are rejected.
- Approved read-only tools return expected Unleashed data.
- Non-approved operations are unavailable.
- Logs do not contain tokens, API keys, signatures, or unnecessary PII.
