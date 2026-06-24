"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { CobranzaRevisarItem } from "@/lib/types";
import { Badge, ErrorPanel } from "@/components/ui";

export function RevisarTab() {
  const [items, setItems] = useState<CobranzaRevisarItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<CobranzaRevisarItem[]>("/cobranza/revisar")
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
          setItems(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorPanel title="No se pudo cargar la lista a revisar" detail={error} />;

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-400">
        Cargando…
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-600">Nada pendiente de revisar 🎉</p>
        <p className="mt-1 text-xs text-slate-400">
          Aparecerán acá las pólizas sin actualización de cobranza hace más de 6 días.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Nº póliza</th>
              <th className="px-3 py-2 font-medium">Organismo</th>
              <th className="px-3 py-2 font-medium">Últ. actualización</th>
              <th className="px-3 py-2 font-medium">Qué sigue</th>
              <th className="px-3 py-2 text-right font-medium">Días sin revisar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it) => (
              <tr key={it.polizaId} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  <Link href={`/polizas/${it.polizaId}`} className="hover:underline">
                    {it.numero}
                  </Link>
                </td>
                <td
                  className="max-w-64 truncate px-3 py-2 text-slate-600"
                  title={it.organismo?.nombre ?? ""}
                >
                  {it.organismo?.nombre ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {formatDate(it.ultimaActualizacion)}
                </td>
                <td className="max-w-72 truncate px-3 py-2 text-slate-600" title={it.queSigue ?? ""}>
                  {it.queSigue ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {it.diasSinRevisar !== null ? (
                    <Badge
                      label={`${it.diasSinRevisar} d`}
                      className="bg-red-50 text-red-700 ring-red-600/20"
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
