"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { daysUntil, formatDate } from "@/lib/format";
import type { CobranzaTracking } from "@/lib/types";
import { Badge } from "@/components/ui";

function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function dateInputToIso(value: string): string | null {
  return value ? `${value}T00:00:00.000Z` : null;
}

export function CobranzaPanel({
  polizaId,
  cobranza,
}: {
  polizaId: string;
  cobranza: CobranzaTracking | null;
}) {
  const router = useRouter();
  const [fechaEnvioDoc, setFechaEnvioDoc] = useState(isoToDateInput(cobranza?.fechaEnvioDoc ?? null));
  const [ultimaActualizacion, setUltimaActualizacion] = useState(
    isoToDateInput(cobranza?.ultimaActualizacion ?? null),
  );
  const [queSigue, setQueSigue] = useState(cobranza?.queSigue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revisar = cobranza?.revisar ?? false;
  const dias = daysUntil(cobranza?.ultimaActualizacion ?? null);
  const diasSinRevisar = dias === null ? null : -dias;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/polizas/${polizaId}/cobranza`, {
        fechaEnvioDoc: dateInputToIso(fechaEnvioDoc),
        ultimaActualizacion: dateInputToIso(ultimaActualizacion),
        queSigue: queSigue.trim() || null,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
    } finally {
      setSaving(false);
    }
  };

  const ctrl =
    "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Cobranza</h2>
        {revisar ? (
          <Badge
            label={`REVISAR${diasSinRevisar !== null ? ` · ${diasSinRevisar} d` : ""}`}
            className="bg-red-50 text-red-700 ring-red-600/20"
          />
        ) : (
          <Badge label="Al día" className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" />
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-500">
            Fecha envío doc.
            <input
              type="date"
              value={fechaEnvioDoc}
              onChange={(e) => setFechaEnvioDoc(e.target.value)}
              className={`mt-1 ${ctrl}`}
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Última actualización
            <input
              type="date"
              value={ultimaActualizacion}
              onChange={(e) => setUltimaActualizacion(e.target.value)}
              className={`mt-1 ${ctrl}`}
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-slate-500">
          Qué sigue
          <textarea
            value={queSigue}
            onChange={(e) => setQueSigue(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
          />
        </label>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {cobranza?.ultimaActualizacion
              ? `Últ. actualización: ${formatDate(cobranza.ultimaActualizacion)}`
              : "Sin registros previos"}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-slate-700"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </section>
  );
}
