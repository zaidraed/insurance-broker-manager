"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatARS, formatDate, formatInt } from "@/lib/format";
import type { RefacturacionResponse } from "@/lib/types";
import { ErrorPanel } from "@/components/ui";

const DIAS_OPCIONES = [30, 60, 90];

export function RefacturacionTab() {
  const [dias, setDias] = useState(30);
  const [resp, setResp] = useState<RefacturacionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<RefacturacionResponse>(`/refacturacion?dias=${dias}`)
      .then((res) => {
        if (!cancelled) setResp(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
          setResp(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dias]);

  if (error) return <ErrorPanel title="No se pudo cargar la refacturación" detail={error} />;

  const counts = resp?.counts;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Vencidas impagas
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-red-600">
            {counts ? formatInt(counts.vencidasImpagas) : "…"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Próx. 30 días</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-amber-600">
            {counts ? formatInt(counts.proximas30) : "…"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Próx. 60 días</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-amber-600">
            {counts ? formatInt(counts.proximas60) : "…"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Horizonte:</span>
        {DIAS_OPCIONES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDias(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              dias === d ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {d} días
          </button>
        ))}
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-600/20">
        Los datos de cuotas se completan al refrescar los exports (importación de vencimientos).
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Nº póliza</th>
                <th className="px-3 py-2 font-medium">Cuota</th>
                <th className="px-3 py-2 font-medium">Organismo</th>
                <th className="px-3 py-2 text-right font-medium">Importe</th>
                <th className="px-3 py-2 font-medium">Vencimiento</th>
                <th className="px-3 py-2 text-right font-medium">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : resp && resp.data.length > 0 ? (
                resp.data.map((c) => (
                  <tr key={c.cuotaId} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <Link href={`/polizas/${c.poliza.id}`} className="hover:underline">
                        {c.poliza.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{c.nroCuota}</td>
                    <td
                      className="max-w-56 truncate px-3 py-2 text-slate-600"
                      title={c.organismo?.nombre ?? ""}
                    >
                      {c.organismo?.nombre ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {formatARS(c.importe)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatDate(c.vencimiento)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        c.diasParaVencer < 0 ? "font-medium text-red-600" : "text-slate-600"
                      }`}
                    >
                      {c.diasParaVencer}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                    Sin cuotas impagas en el horizonte seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
