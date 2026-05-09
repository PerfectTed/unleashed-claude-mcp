# Unleashed Claude MCP

Read-only Claude MCP connector for approved Unleashed API access, deployable on Railway.

## Goal

Expose a small, approved set of read-only Unleashed API calls to Claude as a remote MCP connector.

## Hosting

- Platform: Railway
- Transport: Streamable HTTP MCP endpoint
- Intended connector: Claude custom connector

## Security

- Read-only tools only
- Explicit Unleashed endpoint allowlist
- Bearer token protection for the MCP endpoint
- Secrets stored in Railway environment variables
- No raw secret values in logs

