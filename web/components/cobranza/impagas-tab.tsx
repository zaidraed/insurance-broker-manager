"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { estadoVigenciaBadge, formatARS, formatDate, formatInt } from "@/lib/format";
import type { Paginated, PolizaListItem, ResumenResponse } from "@/lib/types";
import { Badge, ErrorPanel } from "@/components/ui";

const PAGE_SIZE = 50;

export function ImpagasTab() {
  const [data, setData] = useState<Paginated<PolizaListItem> | null>(null);
  const [deudaTotal, setDeudaTotal] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ResumenResponse>("/polizas/resumen")
      .then((r) => setDeudaTotal(r.deudaTotal))
      .catch(() => setDeudaTotal(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<PolizaListItem>>(
        `/polizas?estadoPago=IMPAGA&sort=deudaMonto:desc&pageSize=${PAGE_SIZE}&page=${page}`,
      )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const desde = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(page * PAGE_SIZE, total);

  if (error) return <ErrorPanel title="No se pudieron cargar las impagas" detail={error} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Deuda total</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-red-600">
            {deudaTotal !== null ? formatARS(deudaTotal) : "…"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pólizas impagas
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
            {loading && !data ? "…" : formatInt(total)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Nº póliza</th>
                <th className="px-3 py-2 font-medium">Organismo</th>
                <th className="px-3 py-2 text-right font-medium">Deuda</th>
                <th className="px-3 py-2 font-medium">Actualizada</th>
                <th className="px-3 py-2 font-medium">Vigencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : data && data.data.length > 0 ? (
                data.data.map((p) => {
                  const vig = estadoVigenciaBadge(p.estadoVigencia);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <Link href={`/polizas/${p.id}`} className="hover:underline">
                          {p.numero}
                        </Link>
                      </td>
                      <td
                        className="max-w-64 truncate px-3 py-2 text-slate-600"
                        title={p.organismo?.nombre ?? ""}
                      >
                        {p.organismo?.nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-red-600">
                        {formatARS(p.deudaMonto)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                        {formatDate(p.deudaActualizadaAl)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge label={vig.label} className={vig.className} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                    No hay pólizas impagas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm text-slate-600">
          <span>
            {desde}–{hasta} de {formatInt(total)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-slate-50"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              Pág. {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-slate-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
