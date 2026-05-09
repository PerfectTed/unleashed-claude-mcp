export type AppConfig = {
  port: number;
  nodeEnv: string;
  mcpAuthToken?: string;
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

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development",
    mcpAuthToken: optionalEnv("MCP_AUTH_TOKEN"),
    unleashed: {
      apiId: optionalEnv("UNLEASHED_API_ID"),
      apiKey: optionalEnv("UNLEASHED_API_KEY"),
      baseUrl: optionalEnv("UNLEASHED_BASE_URL") ?? "https://api.unleashedsoftware.com",
      clientType: optionalEnv("UNLEASHED_CLIENT_TYPE") ?? "PerfectTed Claude MCP"
    }
  };
}
