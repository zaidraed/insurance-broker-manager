"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImpagasTab } from "./impagas-tab";
import { RevisarTab } from "./revisar-tab";
import { RefacturacionTab } from "./refacturacion-tab";

const TABS = [
  { key: "impagas", label: "Impagas" },
  { key: "revisar", label: "A revisar" },
  { key: "refacturacion", label: "Refacturación" },
];

export function CobranzaClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "impagas";

  const setTab = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key === "impagas") params.delete("tab");
      else params.set("tab", key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Cobranza</h1>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-slate-800 text-slate-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "revisar" ? (
        <RevisarTab />
      ) : tab === "refacturacion" ? (
        <RefacturacionTab />
      ) : (
        <ImpagasTab />
      )}
    </div>
  );
}
