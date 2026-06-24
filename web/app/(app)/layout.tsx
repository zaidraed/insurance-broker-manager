import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/server-api";
import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import { Sidebar } from "@/components/sidebar";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user: AuthUser;
  try {
    user = await serverFetch<AuthUser>("/auth/me");
  } catch (err) {
    // token inválido/expirado -> a login
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={user.rol === "ADMIN"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-sm font-semibold text-slate-800">Broker Seguros</h1>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-700">{user.nombre}</p>
              <p className="text-xs text-slate-400">{user.rol}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
