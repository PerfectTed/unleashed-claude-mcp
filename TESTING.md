# Unleashed MCP Testing Guide

Complete guide to testing the Unleashed Claude MCP endpoint after deployment.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Getting API Credentials](#getting-api-credentials)
3. [Health Check](#health-check)
4. [Testing with curl](#testing-with-curl)
5. [Understanding Responses](#understanding-responses)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

You need:
- `curl` command (installed on Windows 10+, macOS, Linux)
- `jq` (optional, for pretty JSON output - `choco install jq` on Windows)
- Unleashed API credentials (see next section)
- Network access to the endpoint

---

## Getting API Credentials

The Unleashed API keys are stored in **Passportal** by Freelance.

### Steps:
1. Open Passportal
2. Search for "Unleashed" 
3. You'll find two sets of credentials:
   - **Test credentials** (for development/testing)
   - **Live credentials** (for production)

Start with **test credentials** to avoid impacting production data.

Format: `Bearer <API_KEY>`

---

## Health Check

First, verify the server is running and accessible.

### Command:
```bash
curl -i https://unleashed-claude-mcp-production-095e.up.railway.app/health
```

### Expected Response:
```
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

### If it fails:
- Server may not be deployed yet
- Check Railway dashboard for deployment status
- Wait 2-3 minutes for auto-deployment from GitHub

---

## Testing with curl

### Setup (one-time)

```bash
# Set your API key (from Passportal)
export API_KEY="your_api_key_here"

# Set the endpoint
export ENDPOINT="https://unleashed-claude-mcp-production-095e.up.railway.app/mcp"
```

### Test 1: The Fix - Query WITHOUT endDate (was failing before)

This is the exact scenario James was hitting:

```bash
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "unleashed_list_sales_orders",
      "arguments": {
        "pageNumber": 1,
        "pageSize": 10,
        "customerCode": "CSBY001",
        "startDate": "2026-05-18"
      }
    }
  }' | jq .
```

**What this tests:** Optional `endDate` parameter is handled correctly

**Expected result:** Sales orders for Sainsbury (CSBY001) from May 18 onwards

---

### Test 2: Query WITH endDate (should still work)

```bash
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "unleashed_list_sales_orders",
      "arguments": {
        "pageNumber": 1,
        "pageSize": 10,
        "customerCode": "CSBY001",
        "startDate": "2026-05-18",
        "endDate": "2026-05-31"
      }
    }
  }' | jq .
```

**What this tests:** Optional parameters work when provided

**Expected result:** Sales orders for May 18-31 only

---

### Test 3: Different Customer Code

```bash
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "unleashed_list_sales_orders",
      "arguments": {
        "pageNumber": 1,
        "pageSize": 10,
        "customerCode": "TESCO"
      }
    }
  }' | jq .
```

**What this tests:** Works with different customer codes

---

### Test 4: All Filters at Once

```bash
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "unleashed_list_sales_orders",
      "arguments": {
        "pageNumber": 1,
        "pageSize": 5,
        "customerCode": "CSBY001",
        "orderStatus": "Completed",
        "startDate": "2026-05-01",
        "endDate": "2026-05-31",
        "modifiedSince": "2026-05-15"
      }
    }
  }' | jq .
```

**What this tests:** All optional parameters work together

---

## Understanding Responses

### Success Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{...sales orders data...}"
      }
    ]
  }
}
```

**✅ This means:** The fix worked! No validation errors.

---

### Failure Response - The OLD Error (before fix)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Input validation error: Invalid arguments for tool unleashed_list_sales_orders: [  {    \"code\": \"invalid_type\",    \"expected\": \"string\",    \"received\": \"null\",    \"path\": [      \"endDate\"    ],    \"message\": \"Expected string, received null\"  }]"
  }
}
```

**❌ This means:** Fix not applied yet, or old version still deployed.

---

### Failure Response - Invalid Credentials

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Unleashed API returned 401: Invalid API key"
  }
}
```

**❌ This means:** API key is invalid or expired. Check Passportal.

---

### Failure Response - Customer Not Found

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Unleashed API returned 400: ..."
  }
}
```

**✓ This is actually OK!** The endpoint works; the customer code just doesn't exist in Unleashed.

---

## Troubleshooting

### "Connection refused" or "Failed to connect"

**Cause:** Server not running or endpoint URL is wrong

**Fix:**
```bash
# Check server health
curl -i https://unleashed-claude-mcp-production-095e.up.railway.app/health

# If it fails, check Railway dashboard for deployment
```

---

### "401 Unauthorized"

**Cause:** Invalid API key

**Fix:**
```bash
# Verify your API key is set
echo $API_KEY

# If empty, set it again
export API_KEY="your_actual_key_from_passportal"
```

---

### "Input validation error: Expected string, received null" (endDate)

**Cause:** Old code before the fix

**Fix:**
1. Check if Railway has deployed the fix (look for commit `8d35f45`)
2. If deployed, wait 30 seconds and try again
3. If not deployed, check Railway deployment logs

---

### "jq: command not found"

**Cause:** jq not installed (optional, nice-to-have)

**Fix:** Either install jq or remove `| jq .` from curl command for raw output

```bash
# Windows
choco install jq

# macOS
brew install jq

# Linux
sudo apt-get install jq
```

---

### JSON output is hard to read without jq

**Fix:** Use Python instead:

```bash
curl ... | python -m json.tool
```

Or just remove `| jq .` to see raw output.

---

## Quick Test Script

Save this as `test-mcp.sh`:

```bash
#!/bin/bash

set -e

API_KEY="${1:-}"
if [ -z "$API_KEY" ]; then
  echo "Usage: ./test-mcp.sh YOUR_API_KEY"
  exit 1
fi

ENDPOINT="https://unleashed-claude-mcp-production-095e.up.railway.app/mcp"

echo "🔍 Testing Unleashed MCP Endpoint"
echo "=================================="
echo ""

# Health check
echo "1️⃣  Health Check..."
if curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT/../health" | grep -q "200"; then
  echo "✅ Server is running"
else
  echo "❌ Server is not responding"
  exit 1
fi
echo ""

# Test without endDate
echo "2️⃣  Testing WITHOUT endDate (the fix)..."
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "unleashed_list_sales_orders",
      "arguments": {
        "pageNumber": 1,
        "pageSize": 10,
        "customerCode": "CSBY001",
        "startDate": "2026-05-18"
      }
    }
  }')

if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ FAILED"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
else
  echo "✅ PASSED"
  echo "$RESPONSE" | jq '.result.content[0].text' 2>/dev/null | head -20 || echo "Response received"
fi
echo ""

echo "=================================="
echo "✅ Testing complete!"
```

**Run it:**
```bash
chmod +x test-mcp.sh
./test-mcp.sh your_api_key_here
```

---

## Deployment Status

Check if the fix is deployed:

1. Go to https://railway.app/dashboard
2. Select `unleashed-claude-mcp` project
3. Click `Deployments` tab
4. Look for commit message: `fix: strip null/undefined query parameters...`
5. Status should be green (Success)

If you don't see it:
- The GitHub push may not have completed
- Wait 30 seconds and refresh
- Check the "Builds" tab to see if it's in progress

---

## More Information

- **Repository:** https://github.com/PerfectTed/unleashed-claude-mcp
- **Issue:** optional date fields (e.g. `endDate`) rejecting `null` with `-32602 Expected string, received null`
- **Root cause:** the Zod `inputSchema` used `z.string().trim().optional()`, which accepts `string | undefined` but rejects `null`. MCP clients send `endDate: null` explicitly, so validation failed before the handler ran.
- **Fix:** optional date params now use `.nullish().transform(v => v ?? undefined)`, accepting `null` and coercing it to `undefined` (the query builder then omits it).
- **Commit:** `1d18ef9`

---

## Questions?

If tests fail or you need help:
1. Check the Troubleshooting section above
2. Review Railway deployment logs
3. Ask in #perfecttech Teams channel
