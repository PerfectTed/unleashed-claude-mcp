import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { createUnleashedMcpServer } from "./mcp.js";
import { UnleashedClient } from "./unleashedClient.js";

const config = loadConfig();
const unleashed = new UnleashedClient(config.unleashed);
const app = express();

type McpSession = {
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, McpSession>();

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "unleashed-claude-mcp",
    unleashedConfigured: Boolean(config.unleashed.apiId && config.unleashed.apiKey)
  });
});

app.post("/mcp", requireMcpAuth, async (request, response) => {
  try {
    const transport = await getOrCreateTransport(request, response);
    if (!transport) {
      return;
    }

    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    handleMcpError(response, error);
  }
});

app.get("/mcp", requireMcpAuth, async (request, response) => {
  const transport = getExistingTransport(request, response);
  if (!transport) {
    return;
  }

  await transport.handleRequest(request, response);
});

app.delete("/mcp", requireMcpAuth, async (request, response) => {
  const transport = getExistingTransport(request, response);
  if (!transport) {
    return;
  }

  await transport.handleRequest(request, response);
});

app.listen(config.port, () => {
  console.log(`Unleashed Claude MCP listening on port ${config.port}`);
});

async function getOrCreateTransport(
  request: Request,
  response: Response
): Promise<StreamableHTTPServerTransport | undefined> {
  const sessionId = getSessionId(request);
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      response.status(404).json({ error: "Unknown MCP session." });
      return undefined;
    }
    return session.transport;
  }

  if (!isInitializeRequest(request.body)) {
    response.status(400).json({ error: "Missing MCP session. Send an initialize request first." });
    return undefined;
  }

  const server = createUnleashedMcpServer(unleashed);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, { transport });
    }
  });

  transport.onclose = async () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
    await server.close();
  };

  await server.connect(transport);
  return transport;
}

function getExistingTransport(
  request: Request,
  response: Response
): StreamableHTTPServerTransport | undefined {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    response.status(400).json({ error: "Missing mcp-session-id header." });
    return undefined;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    response.status(404).json({ error: "Unknown MCP session." });
    return undefined;
  }

  return session.transport;
}

function requireMcpAuth(request: Request, response: Response, next: () => void) {
  if (!config.mcpAuthToken) {
    next();
    return;
  }

  const expected = `Bearer ${config.mcpAuthToken}`;
  if (request.header("authorization") !== expected) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  next();
}

function getSessionId(request: Request): string | undefined {
  const header = request.header("mcp-session-id");
  return header?.trim() || undefined;
}

function handleMcpError(response: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown MCP error.";
  console.error(message);

  if (!response.headersSent) {
    response.status(500).json({ error: "MCP request failed.", message });
  }
}
