"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  daysUntil,
  diasRestantesLabel,
  estadoPagoBadge,
  estadoVigenciaBadge,
  formatARS,
  formatDate,
  formatInt,
} from "@/lib/format";
import type { EstadoVigencia, Paginated, PolizaListItem, Ref } from "@/lib/types";
import { Badge, ErrorPanel } from "@/components/ui";

const PAGE_SIZE = 50;
const DEFAULT_SORT = "vigenciaFin:asc";

const ESTADO_CHIPS: { key: string; label: string; estados: EstadoVigencia[] }[] = [
  { key: "activas", label: "Activas", estados: ["VIGENTE", "A_VENCER"] },
  { key: "vigente", label: "Vigente", estados: ["VIGENTE"] },
  { key: "avencer", label: "A vencer", estados: ["A_VENCER"] },
  { key: "vencida", label: "Vencida", estados: ["VENCIDO"] },
  { key: "todas", label: "Todas", estados: [] },
];

const COLUMNS: { key: string; label: string; sortField?: string; align?: "right" }[] = [
  { key: "numero", label: "Nº póliza", sortField: "numero" },
  { key: "tomador", label: "Tomador" },
  { key: "organismo", label: "Organismo" },
  { key: "compania", label: "Compañía" },
  { key: "ramo", label: "Ramo" },
  { key: "vigenciaFin", label: "Fin vigencia", sortField: "vigenciaFin" },
  { key: "estadoVigencia", label: "Estado", sortField: "estadoVigencia" },
  { key: "estadoPago", label: "Pago" },
  { key: "importe", label: "Importe", sortField: "importe", align: "right" },
];

function buildApiQuery(sp: URLSearchParams): string {
  const estadoKey = sp.get("estado") ?? "activas";
  const chip = ESTADO_CHIPS.find((c) => c.key === estadoKey) ?? ESTADO_CHIPS[0];
  const params = new URLSearchParams();
  if (chip.estados.length > 0) params.set("estadoVigencia", chip.estados.join(","));
  for (const k of ["companiaId", "ramoId", "search", "organismoSearch", "venceDesde", "venceHasta"]) {
    const v = sp.get(k);
    if (v) params.set(k, v);
  }
  params.set("page", sp.get("page") ?? "1");
  params.set("pageSize", String(PAGE_SIZE));
  params.set("sort", sp.get("sort") ?? DEFAULT_SORT);
  return params.toString();
}

export function PolizasClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const spString = searchParams.toString();

  const [companias, setCompanias] = useState<Ref[]>([]);
  const [ramos, setRamos] = useState<Ref[]>([]);
  const [data, setData] = useState<Paginated<PolizaListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // valores actuales desde la URL
  const estadoKey = searchParams.get("estado") ?? "activas";
  const companiaId = searchParams.get("companiaId") ?? "";
  const ramoId = searchParams.get("ramoId") ?? "";
  const venceDesde = searchParams.get("venceDesde") ?? "";
  const venceHasta = searchParams.get("venceHasta") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;
  const [sortField, sortDir] = sort.split(":");

  // inputs de texto con estado local + debounce hacia la URL
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [organismoInput, setOrganismoInput] = useState(searchParams.get("organismoSearch") ?? "");

  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      if (resetPage) params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // catálogos (una vez)
  useEffect(() => {
    api.get<Ref[]>("/companias").then(setCompanias).catch(() => setCompanias([]));
    api.get<Ref[]>("/ramos").then(setRamos).catch(() => setRamos([]));
  }, []);

  // fetch de pólizas cuando cambia la URL
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<Paginated<PolizaListItem>>(`/polizas?${buildApiQuery(new URLSearchParams(spString))}`)
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
  }, [spString]);

  // debounce search -> URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== (searchParams.get("search") ?? "")) {
        updateParams({ search: searchInput || null });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // debounce organismoSearch -> URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (organismoInput !== (searchParams.get("organismoSearch") ?? "")) {
        updateParams({ organismoSearch: organismoInput || null });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organismoInput]);

  const toggleSort = (field: string) => {
    const dir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    updateParams({ sort: `${field}:${dir}` });
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const desde = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(page * PAGE_SIZE, total);

  const selectCls =
    "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";
  const inputCls = selectCls + " placeholder:text-slate-400";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Pólizas</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Cargando…" : `${formatInt(total)} resultado${total === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ESTADO_CHIPS.map((chip) => {
            const active = estadoKey === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => updateParams({ estado: chip.key === "activas" ? null : chip.key })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={companiaId}
            onChange={(e) => updateParams({ companiaId: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Todas las compañías</option>
            {companias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <select
            value={ramoId}
            onChange={(e) => updateParams({ ramoId: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Todos los ramos</option>
            {ramos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar nº / tomador / bien…"
            className={`${inputCls} min-w-56 flex-1`}
          />
          <input
            type="text"
            value={organismoInput}
            onChange={(e) => setOrganismoInput(e.target.value)}
            placeholder="Organismo…"
            className={`${inputCls} min-w-44`}
          />

          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>Vence</span>
            <input
              type="date"
              value={venceDesde}
              onChange={(e) => updateParams({ venceDesde: e.target.value || null })}
              className={selectCls}
            />
            <span>—</span>
            <input
              type="date"
              value={venceHasta}
              onChange={(e) => updateParams({ venceHasta: e.target.value || null })}
              className={selectCls}
            />
          </div>
        </div>
      </div>

      {error ? (
        <ErrorPanel title="No se pudieron cargar las pólizas" detail={error} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  {COLUMNS.map((col) => {
                    const sortable = Boolean(col.sortField);
                    const isSorted = col.sortField === sortField;
                    return (
                      <th
                        key={col.key}
                        className={`px-3 py-2 font-medium ${col.align === "right" ? "text-right" : ""} ${
                          sortable ? "cursor-pointer select-none hover:text-slate-700" : ""
                        }`}
                        onClick={sortable ? () => toggleSort(col.sortField as string) : undefined}
                      >
                        {col.label}
                        {isSorted ? <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                ) : data && data.data.length > 0 ? (
                  data.data.map((p) => {
                    const dias = daysUntil(p.vigenciaFin);
                    const vig = estadoVigenciaBadge(p.estadoVigencia);
                    const pago = estadoPagoBadge(p.estadoPago);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/polizas/${p.id}`)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="px-3 py-2 font-medium text-slate-800">
                          <Link
                            href={`/polizas/${p.id}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {p.numero}
                          </Link>
                        </td>
                        <td className="max-w-48 truncate px-3 py-2 text-slate-600" title={p.tomador ?? ""}>
                          {p.tomador ?? "—"}
                        </td>
                        <td className="max-w-48 truncate px-3 py-2 text-slate-600" title={p.organismo?.nombre ?? ""}>
                          {p.organismo?.nombre ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{p.compania.nombre}</td>
                        <td className="px-3 py-2 text-slate-600">{p.ramo?.nombre ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          {formatDate(p.vigenciaFin)}
                          {dias !== null ? (
                            <span className="ml-1 text-xs text-slate-400">({diasRestantesLabel(dias)})</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge label={vig.label} className={vig.className} />
                        </td>
                        <td className="px-3 py-2">
                          <Badge label={pago.label} className={pago.className} />
                          {p.estadoPago === "IMPAGA" && p.deudaMonto ? (
                            <span className="ml-1 text-xs font-medium text-red-600">
                              {formatARS(p.deudaMonto)}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                          {formatARS(p.importe)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-slate-400">
                      Sin resultados para los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm text-slate-600">
            <span>
              {desde}–{hasta} de {formatInt(total)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) }, false)}
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
                onClick={() => updateParams({ page: String(page + 1) }, false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-slate-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
