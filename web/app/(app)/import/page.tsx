"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  AnalyzeResult,
  DeudaRunReport,
  ImportMapping,
  ImportRunReport,
  ImportTipo,
  Ref,
} from "@/lib/types";
import { formatARS, formatDate, formatInt } from "@/lib/format";
import { Badge, Card, ErrorPanel } from "@/components/ui";

const STEPS = ["Subir", "Mapeo", "Preview", "Importar"] as const;
const TIPOS: { value: ImportTipo; label: string }[] = [
  { value: "POLIZAS", label: "Pólizas" },
  { value: "DEUDA", label: "Deuda" },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

const ctrl =
  "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";

/** Renderiza un valor crudo de celda para el preview. */
function cellText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && ISO_DATE.test(v)) return formatDate(v);
  return String(v);
}

export default function ImportPage() {
  const [step, setStep] = useState(0);
  const [tipo, setTipo] = useState<ImportTipo>("POLIZAS");

  // datos
  const [companias, setCompanias] = useState<Ref[]>([]);
  const [companiaId, setCompaniaId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analyze, setAnalyze] = useState<AnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [guardarProfile, setGuardarProfile] = useState(true);
  const [report, setReport] = useState<ImportRunReport | DeudaRunReport | null>(null);

  // ui
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const esPolizas = tipo === "POLIZAS";

  useEffect(() => {
    api
      .get<Ref[]>("/companias")
      .then(setCompanias)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setForbidden(true);
      });
  }, []);

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 403) {
      setForbidden(true);
      return;
    }
    setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
  };

  const resetDesdeAnalyze = () => {
    setAnalyze(null);
    setMapping({});
    setReport(null);
  };

  // Paso 1 -> analizar
  const onAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postForm<AnalyzeResult>(`/import/analyze?tipo=${tipo}`, form);
      setAnalyze(res);
      setMapping({ ...res.mappingSugerido });
      if (esPolizas && !companiaId && res.companiaSugerida) setCompaniaId(res.companiaSugerida.id);
      setStep(1);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // Campos activos (del tipo analizado) y validez del mapeo.
  const campos = analyze?.campos ?? [];
  const mappingValido = useMemo(() => {
    if (esPolizas && !companiaId) return false;
    return campos.filter((c) => c.req).every((c) => Boolean(mapping[c.key]));
  }, [campos, mapping, companiaId, esPolizas]);

  // Paso 4 -> importar
  const onRun = async () => {
    if (!file || !analyze || !mappingValido) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        headerRow: analyze.headerRowDetectada,
        sheet: analyze.sheet,
      };
      for (const c of campos) {
        if (mapping[c.key]) payload[c.key] = mapping[c.key];
      }
      const form = new FormData();
      form.append("file", file);
      form.append("mapping", JSON.stringify(payload));
      form.append("guardarProfile", String(esPolizas && guardarProfile));
      if (esPolizas) form.append("companiaId", companiaId);
      const res = await api.postForm<ImportRunReport | DeudaRunReport>(
        `/import/run?tipo=${tipo}`,
        form,
      );
      setReport(res);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    resetDesdeAnalyze();
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">Importar</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          No tenés permisos para importar (solo ADMIN).
        </div>
      </div>
    );
  }

  const headerOptions = analyze?.headers ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Importar</h1>

      {/* Stepper */}
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => {
          const state = i === step ? "active" : i < step ? "done" : "todo";
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "active"
                    ? "bg-slate-800 text-white"
                    : state === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {i + 1}
              </span>
              <span className={state === "active" ? "font-medium text-slate-800" : "text-slate-400"}>
                {label}
              </span>
              {i < STEPS.length - 1 ? <span className="text-slate-300">›</span> : null}
            </li>
          );
        })}
      </ol>

      {error ? <ErrorPanel title="Algo falló" detail={error} /> : null}

      {/* Paso 1: Tipo + Subir */}
      {step === 0 ? (
        <Card className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Tipo de reporte
            </label>
            <div className="inline-flex rounded-md border border-slate-300 p-0.5">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTipo(t.value);
                    resetDesdeAnalyze();
                  }}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    tipo === t.value
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {esPolizas
                ? "Importa/actualiza pólizas de una compañía."
                : "Refresca la impaga: solo toca las compañías presentes en el archivo."}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Archivo Excel (.xlsx)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                resetDesdeAnalyze();
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
            />
          </div>

          {esPolizas ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Compañía <span className="text-slate-400">(opcional, se autodetecta)</span>
              </label>
              <select
                className={`${ctrl} w-full max-w-sm`}
                value={companiaId}
                onChange={(e) => setCompaniaId(e.target.value)}
              >
                <option value="">— Autodetectar —</option>
                {companias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onAnalyze}
            disabled={!file || loading}
            className="h-9 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:enabled:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Analizando…" : "Analizar"}
          </button>
        </Card>
      ) : null}

      {/* Paso 2: Mapeo */}
      {step === 1 && analyze ? (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge label={`Tipo: ${esPolizas ? "Pólizas" : "Deuda"}`} className="bg-slate-100 text-slate-600 ring-slate-500/20" />
            <Badge label={`Solapa: ${analyze.sheet}`} className="bg-slate-100 text-slate-600 ring-slate-500/20" />
            <Badge label={`Header fila ${analyze.headerRowDetectada}`} className="bg-slate-100 text-slate-600 ring-slate-500/20" />
            {analyze.companiaSugerida ? (
              <Badge label={`Sugerida: ${analyze.companiaSugerida.nombre}`} className="bg-indigo-50 text-indigo-700 ring-indigo-600/20" />
            ) : null}
          </div>

          {esPolizas ? (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Compañía destino <span className="text-red-500">*</span>
              </label>
              <select
                className={`${ctrl} w-full max-w-sm`}
                value={companiaId}
                onChange={(e) => setCompaniaId(e.target.value)}
              >
                <option value="">— Elegir compañía —</option>
                {companias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Multi-compañía: la compañía sale de la columna mapeada como “Compañía / Empresa”.
            </p>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Campo</th>
                  <th className="px-3 py-2 font-medium">Columna del Excel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campos.map((campo) => (
                  <tr key={campo.key}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {campo.label}
                      {campo.req ? <span className="text-red-500"> *</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={`${ctrl} w-full max-w-xs ${campo.req && !mapping[campo.key] ? "border-red-300" : ""}`}
                        value={mapping[campo.key] ?? ""}
                        onChange={(e) =>
                          setMapping((prev) => {
                            const next = { ...prev };
                            if (e.target.value) next[campo.key] = e.target.value;
                            else delete next[campo.key];
                            return next;
                          })
                        }
                      >
                        <option value="">{campo.req ? "— Elegir —" : "— (ninguna) —"}</option>
                        {headerOptions.map((h) => (
                          <option key={h.col} value={h.col}>
                            {h.col} — {h.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep(0)} className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50">
              Volver
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!mappingValido}
              className="h-9 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:enabled:bg-slate-700 disabled:opacity-50"
            >
              Continuar
            </button>
            {!mappingValido ? (
              <span className="text-xs text-slate-400">
                Completá {esPolizas ? "la compañía y " : ""}los campos con *.
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Paso 3: Preview */}
      {step === 2 && analyze ? (
        <Card className="space-y-4 p-4">
          <p className="text-sm text-slate-500">
            Vista previa de {analyze.sampleRows.length} filas con el mapeo aplicado (sanity check).
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  {campos.filter((c) => mapping[c.key]).map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analyze.sampleRows.map((row, i) => (
                  <tr key={i}>
                    {campos.filter((c) => mapping[c.key]).map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {cellText(row[mapping[c.key]])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep(1)} className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50">
              Volver
            </button>
            <button type="button" onClick={() => setStep(3)} className="h-9 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700">
              Continuar
            </button>
          </div>
        </Card>
      ) : null}

      {/* Paso 4: Importar */}
      {step === 3 && analyze ? (
        <Card className="space-y-4 p-4">
          {report ? (
            esPolizas ? (
              <ReportePolizas report={report as ImportRunReport} onReset={reset} />
            ) : (
              <ReporteDeuda report={report as DeudaRunReport} onReset={reset} />
            )
          ) : (
            <div className="space-y-4">
              {esPolizas ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={guardarProfile}
                    onChange={(e) => setGuardarProfile(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Guardar mapeo para esta compañía (reusable)
                </label>
              ) : (
                <p className="text-sm text-slate-500">
                  Se marcará IMPAGA a las pólizas con deuda y se reseteará la impaga de las
                  compañías presentes en el archivo.
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:enabled:bg-slate-50 disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={onRun}
                  disabled={loading || !mappingValido}
                  className="h-9 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:enabled:bg-slate-700 disabled:opacity-50"
                >
                  {loading ? "Importando…" : "Importar"}
                </button>
              </div>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function ReportePolizas({ report, onReset }: { report: ImportRunReport; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Importación completada.
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Filas leídas" value={formatInt(report.filasLeidas)} />
        <Stat label="Creadas" value={formatInt(report.creadas)} accent="emerald" />
        <Stat label="Actualizadas" value={formatInt(report.actualizadas)} accent="amber" />
      </div>
      <ChipList title="Ramos no resueltos" items={report.ramosNoResueltos} />
      <ChipList title="Organismos nuevos" items={report.organismosNuevos} />
      <ResetButton onReset={onReset} />
    </div>
  );
}

function ReporteDeuda({ report, onReset }: { report: DeudaRunReport; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Impaga actualizada.
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pólizas con deuda" value={formatInt(report.polizasConDeuda)} />
        <Stat label="Marcadas impaga" value={formatInt(report.marcadasImpaga)} accent="red" />
        <Stat label="No encontradas" value={formatInt(report.noEncontradas.count)} accent="amber" />
        <Stat label="Deuda total" value={formatARS(report.deudaTotalAplicada)} accent="red" />
      </div>
      <ChipList title="Compañías en el archivo" items={report.companiasEnArchivo} />
      {report.noEncontradas.muestras.length > 0 ? (
        <ChipList title="No encontradas (muestras)" items={report.noEncontradas.muestras} />
      ) : null}
      <ResetButton onReset={onReset} />
    </div>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="h-9 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
    >
      Importar otro archivo
    </button>
  );
}

function Stat({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "emerald" | "amber" | "red";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "red"
          ? "text-red-600"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function ChipList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-500/20"
            >
              {it}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
