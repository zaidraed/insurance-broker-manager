import { Suspense } from "react";
import { CobranzaClient } from "@/components/cobranza/cobranza-client";

export const metadata = { title: "Cobranza · Broker Seguros" };

export default function CobranzaPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
        <CobranzaClient />
      </Suspense>
    </div>
  );
}
