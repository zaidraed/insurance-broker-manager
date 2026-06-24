import type { CanalContacto, EstadoPago, EstadoVigencia, TipoSeguimiento } from "./types";

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-AR");

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** Formatea un Decimal (string|number) como pesos argentinos. */
export function formatARS(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "—";
  return arsFormatter.format(n);
}

/** Formatea un entero con separador de miles es-AR. */
export function formatInt(value: number): string {
  return numberFormatter.format(value);
}

/** Formatea una fecha ISO como dd/mm/aaaa (UTC, consistente con la API). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

/** Días desde hoy hasta la fecha (UTC). Negativo si ya pasó; null si inválida. */
export function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/** Etiqueta legible de días restantes: "en 12 d", "hoy", "hace 5 d". */
export function diasRestantesLabel(dias: number | null): string {
  if (dias === null) return "";
  if (dias === 0) return "hoy";
  if (dias > 0) return `en ${dias} d`;
  return `hace ${Math.abs(dias)} d`;
}

export interface BadgeStyle {
  label: string;
  className: string;
}

const ESTADO_VIGENCIA: Record<EstadoVigencia, BadgeStyle> = {
  VIGENTE: { label: "Vigente", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  A_VENCER: { label: "A vencer", className: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  VENCIDO: { label: "Vencido", className: "bg-red-50 text-red-700 ring-red-600/20" },
};

const ESTADO_PAGO: Record<EstadoPago, BadgeStyle> = {
  PAGADA: { label: "Pagada", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  IMPAGA: { label: "Impaga", className: "bg-red-50 text-red-700 ring-red-600/20" },
  PARCIAL: { label: "Parcial", className: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  NA: { label: "N/A", className: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

export function estadoVigenciaBadge(estado: EstadoVigencia): BadgeStyle {
  return ESTADO_VIGENCIA[estado];
}

export function estadoPagoBadge(estado: EstadoPago): BadgeStyle {
  return ESTADO_PAGO[estado];
}

const TIPO_SEGUIMIENTO: Record<TipoSeguimiento, BadgeStyle> = {
  RENOVACION: { label: "Renovación", className: "bg-blue-50 text-blue-700 ring-blue-600/20" },
  ENDOSO: { label: "Endoso", className: "bg-indigo-50 text-indigo-700 ring-indigo-600/20" },
  COBRANZA: { label: "Cobranza", className: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  SINIESTRO: { label: "Siniestro", className: "bg-red-50 text-red-700 ring-red-600/20" },
  NOTA: { label: "Nota", className: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

const CANAL_LABEL: Record<CanalContacto, string> = {
  TELEFONO: "Teléfono",
  WHATSAPP: "WhatsApp",
  MAIL: "Mail",
  OTRO: "Otro",
};

export function tipoSeguimientoBadge(tipo: TipoSeguimiento): BadgeStyle {
  return TIPO_SEGUIMIENTO[tipo];
}

export function canalLabel(canal: CanalContacto): string {
  return CANAL_LABEL[canal];
}

/** Formatea fecha + hora es-AR (para timestamps de seguimientos). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
