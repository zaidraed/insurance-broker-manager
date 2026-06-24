const MS_PER_DAY = 86_400_000;

/** Fecha de hoy a medianoche UTC (consistente con cómo se guardan las fechas del import). */
export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/**
 * Diferencia en días calendario UTC: later - earlier.
 * Se evalúa en UTC para no correrse un día por la zona horaria local (UTC-3),
 * que fue el bug que tuvimos con las fechas del TABLERO.
 */
export function diffCalendarDaysUTC(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const b = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.round((a - b) / MS_PER_DAY);
}
