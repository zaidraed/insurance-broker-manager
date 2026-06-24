import { Suspense } from "react";
import { PolizasClient } from "@/components/polizas/polizas-client";

export const metadata = { title: "Pólizas · Broker Seguros" };

export default function PolizasPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <PolizasClient />
      </Suspense>
    </div>
  );
}
