const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "eih_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(status: number, message: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the API server. Is the backend running?");
  }

  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    setToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    let errors;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join(", ");
      errors = body.errors;
    } catch { /* non-json error body */ }
    throw new ApiError(res.status, detail, errors);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  url: API_URL,
};

/** Streaming chat: POST /api/chat with SSE. Yields parsed events. */
export async function* streamChat(
  message: string,
  conversationId: string | null,
  filters?: { source_types?: string[]; repository?: string },
): AsyncGenerator<
  | { type: "sources"; sources: import("./types").RetrievedSource[] }
  | { type: "token"; token: string }
  | { type: "done"; message_id: string; conversation_id: string }
  | { type: "error"; error: string }
> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      stream: true,
      filters: filters ?? null,
    }),
  });
  if (!res.ok || !res.body) {
    let detail = `Chat request failed (${res.status})`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch { /* ignore */ }
    yield { type: "error", error: detail };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          try {
            const parsed = JSON.parse(data);
            if (event === "sources") {
              yield { type: "sources", sources: parsed };
            } else if (event === "done") {
              yield { type: "done", message_id: parsed.message_id, conversation_id: parsed.conversation_id };
            } else if (event === "error") {
              yield { type: "error", error: String(parsed) };
            } else if (typeof parsed === "string") {
              yield { type: "token", token: parsed };
            }
          } catch { /* keep-alive / malformed */ }
        }
      }
      event = "message";
    }
  }
}
