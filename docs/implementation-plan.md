# Implementation Plan

## 1. Project scaffold

- Create a Node.js and TypeScript MCP server.
- Add build, start, and development scripts.
- Add Railway-compatible HTTP server entrypoint.
- Add `.env.example` for required secrets.

## 2. Claude connector endpoint

- Expose the MCP server over Streamable HTTP.
- Use `/mcp` as the primary endpoint.
- Add a simple `/health` endpoint for Railway checks.
- Require bearer authentication before MCP requests are handled.

## 3. Unleashed API client

- Read `UNLEASHED_API_ID` and `UNLEASHED_API_KEY` from environment variables.
- Sign requests with Unleashed `api-auth-signature`.
- Centralize request timeout, pagination, and error handling.
- Keep logs free of API keys, signatures, and private customer details.

## 4. Read-only tool allowlist

- Implement only approved read-only tools from the review matrix.
- Keep tool names specific and business-friendly.
- Validate input schemas before calling Unleashed.
- Return concise summaries with raw IDs only when useful.

## 5. Customer data policy

- Customer records are allowed for B2B/trade accounts and generic channels such as Shopify, Amazon, or web sales.
- Personal consumer records should be excluded or masked.
- Contact details should be returned only when they are needed for the approved use case.

## 6. Railway deployment

- Connect Railway to `PerfectTed/unleashed-claude-mcp`.
- Set required environment variables in Railway.
- Deploy from the main branch.
- Use the Railway public domain as the Claude connector URL.

## 7. Acceptance checks

- Claude can connect to the Railway MCP URL.
- Unauthorized requests are rejected.
- Approved read-only tools return expected Unleashed data.
- Non-approved operations are unavailable.
- Logs do not contain tokens, API keys, signatures, or unnecessary PII.

