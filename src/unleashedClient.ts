import { createHmac } from "node:crypto";

export type UnleashedClientConfig = {
  apiId?: string;
  apiKey?: string;
  baseUrl: string;
  clientType: string;
};

export type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

export class UnleashedClient {
  private readonly config: UnleashedClientConfig;

  constructor(config: UnleashedClientConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, "")
    };
  }

  async get<T>(path: string, query: QueryParams = {}): Promise<T> {
    return this.request<T>("GET", path, query);
  }

  async post<T>(path: string, body: unknown, query: QueryParams = {}): Promise<T> {
    return this.request<T>("POST", path, query, body);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    query: QueryParams = {},
    body?: unknown
  ): Promise<T> {
    if (!this.config.apiId || !this.config.apiKey) {
      throw new Error("Unleashed API credentials are not configured.");
    }

    // Unleashed paginates via a URL path segment (/SalesOrders/2), not a query param.
    // Pull `page` out of the query: only page 2+ needs the segment (page 1 is the default),
    // and the HMAC signature is computed over the remaining query string, which must NOT
    // include the page number.
    const { page, ...filters } = query;
    const pageSegment =
      page !== undefined && page !== null && Number(page) > 1 ? `/${Number(page)}` : "";

    const queryString = buildQueryString(filters);
    const signature = createSignature(queryString, this.config.apiKey);
    const url = `${this.config.baseUrl}${path}${pageSegment}${queryString ? `?${queryString}` : ""}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "api-auth-id": this.config.apiId,
          "api-auth-signature": signature,
          "client-type": this.config.clientType
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      const text = await response.text();
      const payload = text ? safeJsonParse(text) : undefined;

      if (!response.ok) {
        throw new Error(formatApiError(response.status, payload));
      }

      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildQueryString(query: QueryParams): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.append(key, String(value));
  }

  return params.toString();
}

function createSignature(queryString: string, apiKey: string): string {
  return createHmac("sha256", apiKey).update(queryString).digest("base64");
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function formatApiError(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    return `Unleashed API returned ${status}: ${String(payload.message)}`;
  }

  return `Unleashed API returned ${status}.`;
}
