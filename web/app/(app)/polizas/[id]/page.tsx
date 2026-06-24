import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverFetch } from "@/lib/server-api";
import {
  estadoPagoBadge,
  estadoVigenciaBadge,
  formatARS,
  formatDate,
} from "@/lib/format";
import type { PolizaDetail } from "@/lib/types";
import { Badge, Card, ErrorPanel } from "@/components/ui";
import { CobranzaPanel } from "@/components/polizas/cobranza-panel";
import { SeguimientosPanel } from "@/components/polizas/seguimientos-panel";

export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{children}</dd>
    </div>
  );
}

export default async function PolizaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let poliza: PolizaDetail;
  try {
    poliza = await serverFetch<PolizaDetail>(`/polizas/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    const detail = err instanceof ApiError ? `${err.status} · ${err.message}` : String(err);
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Link href="/polizas" className="text-sm text-slate-500 hover:underline">
          ← Volver a pólizas
        </Link>
        <ErrorPanel title="No se pudo cargar la póliza" detail={detail} />
      </div>
    );
  }

  const vig = estadoVigenciaBadge(poliza.estadoVigencia);
  const pago = estadoPagoBadge(poliza.estadoPago);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Link href="/polizas" className="text-sm text-slate-500 hover:underline">
          ← Volver a pólizas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-800">Póliza {poliza.numero}</h1>
          <Badge label={vig.label} className={vig.className} />
          <span className="text-sm text-slate-500">{poliza.compania.nombre}</span>
        </div>
      </div>

      {/* Datos generales */}
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Compañía">{poliza.compania.nombre}</Field>
          <Field label="Organismo">
            {poliza.organismo
              ? `${poliza.organismo.nombre}${poliza.organismo.codigo ? ` (${poliza.organismo.codigo})` : ""}`
              : "—"}
          </Field>
          <Field label="Dirección">{poliza.direccion?.nombre ?? "—"}</Field>
          <Field label="Ramo">{poliza.ramo?.nombre ?? "—"}</Field>
          <Field label="Tomador">{poliza.tomador ?? "—"}</Field>
          <Field label="Bien asegurado">{poliza.bienAsegurado ?? "—"}</Field>
          <Field label="Vigencia inicio">{formatDate(poliza.vigenciaInicio)}</Field>
          <Field label="Vigencia fin">{formatDate(poliza.vigenciaFin)}</Field>
          <Field label="Importe">{formatARS(poliza.importe)}</Field>
          <Field label="Responsable">{poliza.responsable?.nombre ?? "—"}</Field>
        </dl>
      </Card>

      {/* Estado de pago / deuda */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Pago</span>
          <Badge label={pago.label} className={pago.className} />
          {poliza.estadoPago === "IMPAGA" && poliza.deudaMonto ? (
            <span className="text-lg font-semibold tabular-nums text-red-600">
              {formatARS(poliza.deudaMonto)}
            </span>
          ) : null}
        </div>
        {poliza.estadoPago === "IMPAGA" ? (
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {poliza.deudaObs ? <p className="whitespace-pre-wrap">{poliza.deudaObs}</p> : null}
            {poliza.deudaActualizadaAl ? (
              <p className="text-xs text-slate-400">
                Deuda actualizada al {formatDate(poliza.deudaActualizadaAl)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Seguimientos */}
        <SeguimientosPanel polizaId={poliza.id} seguimientos={poliza.seguimientos} />

        <div className="space-y-6">
          {/* Cobranza */}
          <CobranzaPanel polizaId={poliza.id} cobranza={poliza.cobranzaTracking} />

          {/* Cuotas */}
          <Card>
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Cuotas {poliza.cuotas.length > 0 ? `(${poliza.cuotas.length})` : ""}
              </h2>
            </div>
            {poliza.cuotas.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Esta póliza no tiene cuotas cargadas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium">Cuota</th>
                      <th className="px-3 py-2 font-medium">Vencimiento</th>
                      <th className="px-3 py-2 text-right font-medium">Importe</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poliza.cuotas.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{c.nroCuota}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDate(c.vencimiento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {formatARS(c.importe)}
                        </td>
                        <td className="px-3 py-2">
                          {c.pagada ? (
                            <Badge label="Pagada" className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" />
                          ) : (
                            <Badge label="Impaga" className="bg-red-50 text-red-700 ring-red-600/20" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
