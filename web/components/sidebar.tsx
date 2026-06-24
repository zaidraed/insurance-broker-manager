"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/polizas", label: "Pólizas" },
  { href: "/cobranza", label: "Cobranza" },
];

const ADMIN_NAV = [
  { href: "/import", label: "Importar" },
  { href: "/usuarios", label: "Usuarios" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
      <div className="flex h-14 items-center border-b border-slate-800 px-4">
        <span className="text-sm font-semibold tracking-tight text-white">Broker Seguros</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">v1 · interno</div>
    </aside>
  );
}
