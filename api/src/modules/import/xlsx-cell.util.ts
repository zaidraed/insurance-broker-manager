import { Cell, Worksheet } from 'exceljs';

/**
 * Helpers puros de lectura de celdas xlsx, compartidos por los importers y el
 * analizador de planillas. Mismo criterio de extracción de valor que usaban los
 * servicios originales (fórmulas, richText, fechas, etc.).
 */

export function cellValue(cell: Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) return (v as { result?: unknown }).result ?? null;
    if ('text' in v) return (v as { text?: unknown }).text ?? null;
    if ('richText' in v) {
      return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
    }
    return null;
  }
  return v;
}

export function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Clave de comparación de header: sin acentos + trim + uppercase. */
export function headerKey(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/** "A" -> 1, "M" -> 13, "R" -> 18 (base-26, soporta multi-letra). */
export function colIndex(letter: string): number {
  let n = 0;
  for (const ch of letter.trim().toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

/** 1 -> "A", 13 -> "M", 27 -> "AA". */
export function colLetter(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Lee la celda de una columna (letra) de una fila. null si la columna no está definida. */
export function readCol(row: ReturnType<Worksheet['getRow']>, letter: string | null | undefined): unknown {
  if (!letter) return null;
  return cellValue(row.getCell(colIndex(letter)));
}
