const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";
const isDev = API_URL.includes("localhost") || API_URL.includes("127.0.0.1");

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Dev bypass header for local development
    // TODO(P3.4): Replace with session-based auth
    if (isDev) {
      requestHeaders["X-Dev-Bypass"] = "true";
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "unknown",
        message: `HTTP ${response.status}`,
        status: response.status,
        request_id: response.headers.get("x-request-id") ?? "unknown",
      }));
      throw new ApiError(error);
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  async healthCheck(): Promise<{ status: string; version: string } | null> {
    try {
      return await this.get<{ status: string; version: string }>("/health");
    } catch {
      return null;
    }
  }
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: {
    error: string;
    message: string;
    status: number;
    request_id: string;
    details?: Record<string, unknown>;
  }) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.error;
    this.status = error.status;
    this.requestId = error.request_id;
    this.details = error.details;
  }
}

export const api = new ApiClient();
