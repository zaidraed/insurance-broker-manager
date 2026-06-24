export const API_BASE = "/api";

// Cliente: siempre pega a /api, donde el route handler catch-all inyecta el
// Bearer desde la cookie httpOnly. Para Server Components usar serverFetch().
function resolveUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Preparado para auth a futuro: setear un token y se manda como Bearer.
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    let message = res.statusText;
    if (data && typeof data === "object" && "message" in data) {
      const m = (data as { message: unknown }).message;
      message = Array.isArray(m) ? m.join(", ") : String(m);
    }
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    throw new ApiError(0, `No se pudo conectar con la API (${(err as Error).message})`);
  }

  return parseResponse<T>(res);
}

/**
 * POST multipart/form-data. NO seteamos Content-Type: el browser arma el
 * boundary del FormData. El proxy /api reenvía el body crudo + Bearer.
 */
async function requestForm<T>(method: string, path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(resolveUrl(path), { method, headers, body: form, cache: "no-store" });
  } catch (err) {
    throw new ApiError(0, `No se pudo conectar con la API (${(err as Error).message})`);
  }

  return parseResponse<T>(res);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  postForm: <T>(path: string, form: FormData) => requestForm<T>("POST", path, form),
};
