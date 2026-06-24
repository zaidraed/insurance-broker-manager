import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000";

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const token = req.cookies.get("token")?.value;

  const url = `${BACKEND_URL}/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  if (token) headers["authorization"] = `Bearer ${token}`;

  // Reenviamos el body crudo (ArrayBuffer) para no corromper binarios: así
  // multipart/form-data (subida de Excel) pasa intacto con su boundary, y el
  // JSON sigue funcionando igual. El content-type original ya se reenvía arriba.
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
