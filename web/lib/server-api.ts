import { cookies } from "next/headers";
import { ApiError } from "./api";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000";

/**
 * Fetch para Server Components: lee la cookie httpOnly "token" y pega directo
 * al backend con Authorization: Bearer. Lanza ApiError si la respuesta no es OK.
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const token = (await cookies()).get("token")?.value;
  const p = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`${BACKEND_URL}${p}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

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

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
