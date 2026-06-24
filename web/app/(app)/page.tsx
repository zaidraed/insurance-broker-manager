import { ApiError } from "@/lib/api";
import { serverFetch } from "@/lib/server-api";
import { formatARS, formatInt } from "@/lib/format";
import type { ResumenResponse } from "@/lib/types";
import { Card, ErrorPanel, SectionCard, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

const ESTADOS = [
  { key: "VIGENTE", label: "Vigentes", dot: "bg-emerald-500" },
  { key: "A_VENCER", label: "A vencer", dot: "bg-amber-500" },
  { key: "VENCIDO", label: "Vencidas", dot: "bg-red-500" },
] as const;

export default async function ResumenPage() {
  let resumen: ResumenResponse;
  try {
    resumen = await serverFetch<ResumenResponse>("/polizas/resumen");
  } catch (err) {
    const detail = err instanceof ApiError ? `${err.status} · ${err.message}` : String(err);
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">Resumen</h1>
        <ErrorPanel title="No se pudo cargar el resumen" detail={detail} />
      </div>
    );
  }

  const total = ESTADOS.reduce((acc, e) => acc + (resumen.porEstadoVigencia[e.key] ?? 0), 0);
  const maxCompania = Math.max(1, ...resumen.porCompania.map((c) => c.count));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Resumen</h1>
        <p className="text-sm text-slate-500">Vista general de la cartera de pólizas.</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total pólizas" value={formatInt(total)} />
        <StatCard label="Deuda total" value={formatARS(resumen.deudaTotal)} accent="red" />
        <StatCard label="Pólizas impagas" value={formatInt(resumen.cantidadImpaga)} accent="red" />
      </div>

      {/* Estado de vigencia */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ESTADOS.map((e) => (
          <Card key={e.key} className="p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${e.dot}`} />
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {e.label}
              </p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {formatInt(resumen.porEstadoVigencia[e.key] ?? 0)}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Próximas a vencer */}
        <SectionCard title="Próximas a vencer">
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                ["30 días", resumen.proximasAVencer.en30],
                ["60 días", resumen.proximasAVencer.en60],
                ["90 días", resumen.proximasAVencer.en90],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums text-amber-600">
                  {formatInt(value)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Top compañías */}
        <SectionCard title="Top compañías">
          {resumen.porCompania.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos.</p>
          ) : (
            <ul className="space-y-2">
              {resumen.porCompania.map((c) => (
                <li key={c.companiaId} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm text-slate-700" title={c.nombre}>
                    {c.nombre}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-700"
                      style={{ width: `${(c.count / maxCompania) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-600">
                    {formatInt(c.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
