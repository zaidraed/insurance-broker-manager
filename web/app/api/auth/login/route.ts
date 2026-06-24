import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000";
const MAX_AGE = 60 * 60 * 12; // 12h, igual al exp del JWT

export async function POST(req: NextRequest) {
  const body = await req.text();

  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(data ?? { message: "Error de autenticación" }, {
      status: res.status,
    });
  }

  const { accessToken, user } = data as { accessToken: string; user: unknown };
  const response = NextResponse.json({ user });
  response.cookies.set("token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}
