"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { canalLabel, formatDateTime, tipoSeguimientoBadge } from "@/lib/format";
import type { CanalContacto, Seguimiento, TipoSeguimiento } from "@/lib/types";
import { Badge } from "@/components/ui";

const CANALES: CanalContacto[] = ["TELEFONO", "WHATSAPP", "MAIL", "OTRO"];
const TIPOS: TipoSeguimiento[] = ["RENOVACION", "ENDOSO", "COBRANZA", "SINIESTRO", "NOTA"];

export function SeguimientosPanel({
  polizaId,
  seguimientos,
}: {
  polizaId: string;
  seguimientos: Seguimiento[];
}) {
  const router = useRouter();
  const [canal, setCanal] = useState<CanalContacto>("TELEFONO");
  const [tipo, setTipo] = useState<TipoSeguimiento>("NOTA");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/polizas/${polizaId}/seguimientos`, { canal, tipo, texto: texto.trim() });
      setTexto("");
      setTipo("NOTA");
      setCanal("TELEFONO");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
    } finally {
      setSaving(false);
    }
  };

  const ctrl =
    "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Seguimientos</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-2 border-b border-slate-100 bg-slate-50 p-4">
        <div className="flex flex-wrap gap-2">
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalContacto)} className={ctrl}>
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {canalLabel(c)}
              </option>
            ))}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSeguimiento)} className={ctrl}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {tipoSeguimientoBadge(t).label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí el seguimiento…"
          rows={2}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !texto.trim()}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-slate-700"
          >
            {saving ? "Guardando…" : "Agregar"}
          </button>
        </div>
      </form>

      <div className="p-4">
        {seguimientos.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay seguimientos.</p>
        ) : (
          <ul className="space-y-3">
            {seguimientos.map((s) => {
              const badge = tipoSeguimientoBadge(s.tipo);
              return (
                <li key={s.id} className="border-l-2 border-slate-200 pl-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{formatDateTime(s.fecha)}</span>
                    <Badge label={badge.label} className={badge.className} />
                    <span className="text-slate-400">{canalLabel(s.canal)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.texto}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
