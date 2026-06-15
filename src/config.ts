export type AppConfig = {
  port: number;
  nodeEnv: string;
  mcpAuthToken?: string;
  writeToolsEnabled: boolean;
  unleashed: {
    apiId?: string;
    apiKey?: string;
    baseUrl: string;
    clientType: string;
  };
};

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function envFlag(name: string): boolean {
  const value = optionalEnv(name)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development",
    mcpAuthToken: optionalEnv("MCP_AUTH_TOKEN"),
    writeToolsEnabled: envFlag("UNLEASHED_ENABLE_WRITE_TOOLS"),
    unleashed: {
      apiId: optionalEnv("UNLEASHED_API_ID"),
      apiKey: optionalEnv("UNLEASHED_API_KEY"),
      baseUrl: optionalEnv("UNLEASHED_BASE_URL") ?? "https://api.unleashedsoftware.com",
      clientType: optionalEnv("UNLEASHED_CLIENT_TYPE") ?? "PerfectTed Claude MCP"
    }
  };
}
