import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// (En Next 16 "middleware" se renombró a "proxy".)
export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const isLogin = req.nextUrl.pathname === "/login";

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (token && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Corre en todas las rutas de páginas; excluye /api (route handlers),
  // estáticos y favicon.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
