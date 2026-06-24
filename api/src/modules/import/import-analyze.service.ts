import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalyzeHeader,
  AnalyzeResult,
  CampoCanonico,
  CompaniaSugerida,
} from './import-analyze.types';
import { ImportTipo, ResolvedImportMapping, SuggestedMapping } from './import-mapping.types';
import { asString, cellValue, colLetter, headerKey } from './xlsx-cell.util';

/** Hasta qué fila escanear buscando el header / identificador de compañía. */
const MAX_HEADER_SCAN = 50;
/** Cantidad de filas de muestra a devolver. */
const SAMPLE_ROWS = 8;

/**
 * Keywords por campo canónico, en orden de prioridad de asignación.
 * El orden importa para desambiguar choques ("fecha hasta facturado" debe caer
 * en colFechaFacturado antes que en colFin, que también matchea "hasta").
 */
const FIELD_KEYWORDS: { field: keyof SuggestedMapping; keywords: string[] }[] = [
  { field: 'colPoliza', keywords: ['POLIZA', 'NRO POLIZA', 'NUMERO POLIZA', 'N POLIZA', 'POLICY'] },
  { field: 'colRamo', keywords: ['RAMA', 'RAMO', 'SECCION', 'COBERTURA'] },
  // colBien antes que colTomador: "Bien Asegurado" debe caer en bien, no en
  // tomador (que matchea "ASEGURADO").
  {
    field: 'colBien',
    keywords: ['BIEN ASEGURADO', 'BIEN', 'OBJETO', 'RIESGO', 'DETALLE BIEN', 'MATRICULA', 'DOMINIO'],
  },
  {
    field: 'colTomador',
    keywords: ['TOMADOR', 'ASEGURADO', 'CLIENTE', 'RAZON SOCIAL', 'CONTRATANTE', 'NOMBRE'],
  },
  // colFechaFacturado antes que colFin: "Fecha Hasta Facturado" debe caer en
  // facturado, no en fin (que matchea "HASTA").
  {
    field: 'colFechaFacturado',
    keywords: ['FACTURADO', 'FACTURACION', 'COBRADO HASTA', 'ULT FACTURA', 'HASTA FACTURADO'],
  },
  {
    field: 'colFin',
    keywords: ['VIGENCIA HASTA', 'VIG HASTA', 'VIGENCIA FIN', 'VENCIMIENTO', 'HASTA', 'FIN'],
  },
  {
    field: 'colInicio',
    keywords: ['VIGENCIA DESDE', 'VIG DESDE', 'VIGENCIA INICIO', 'INICIO', 'DESDE', 'EMISION'],
  },
  {
    field: 'colObs',
    keywords: ['OBSERV', 'OPERACION', 'OBS', 'NOTA', 'DETALLE OPERACION', 'MOVIMIENTO'],
  },
  {
    field: 'colMedioPago',
    keywords: ['MEDIO DE PAGO', 'MEDIO PAGO', 'FORMA DE PAGO', 'FORMA PAGO', 'METODO DE PAGO', 'COBRANZA'],
  },
];

/** Keywords por campo canónico de DEUDA. */
const DEUDA_FIELD_KEYWORDS: { field: string; keywords: string[] }[] = [
  { field: 'colPoliza', keywords: ['POLIZA', 'NRO POLIZA', 'N POLIZA', 'POLICY'] },
  { field: 'colCompania', keywords: ['EMPRESA', 'COMPANIA', 'ASEGURADORA', 'CIA'] },
  { field: 'colImporte', keywords: ['IMPORTE', 'DEUDA', 'MONTO', 'SALDO', 'ADEUDADO'] },
  { field: 'colObs', keywords: ['OBSERV', 'OBS', 'DETALLE', 'NOTA', 'MOTIVO'] },
];

/** Campos canónicos por tipo (para que la UI arme la tabla de mapeo). */
const CAMPOS_POR_TIPO: Record<ImportTipo, CampoCanonico[]> = {
  POLIZAS: [
    { key: 'colPoliza', label: 'Póliza', req: true },
    { key: 'colTomador', label: 'Tomador / Organismo', req: true },
    { key: 'colRamo', label: 'Ramo', req: false },
    { key: 'colInicio', label: 'Inicio vigencia', req: true },
    { key: 'colFin', label: 'Fin vigencia', req: false },
    { key: 'colBien', label: 'Bien asegurado', req: false },
    { key: 'colObs', label: 'Observación', req: false },
    { key: 'colFechaFacturado', label: 'Fecha facturado', req: false },
    { key: 'colMedioPago', label: 'Medio de pago', req: false },
  ],
  DEUDA: [
    { key: 'colPoliza', label: 'Póliza', req: true },
    { key: 'colCompania', label: 'Compañía / Empresa', req: true },
    { key: 'colImporte', label: 'Importe', req: true },
    { key: 'colObs', label: 'Observación', req: false },
  ],
};

/** Keywords combinadas por tipo, para puntuar filas candidatas a header. */
const ALL_KEYWORDS_POR_TIPO: Record<ImportTipo, string[]> = {
  POLIZAS: FIELD_KEYWORDS.flatMap((f) => f.keywords),
  DEUDA: DEUDA_FIELD_KEYWORDS.flatMap((f) => f.keywords),
};

/** Si DEUDA y existe una solapa así llamada, se restringe la detección a ella. */
const DEUDA_SHEET = 'DEUDA';

@Injectable()
export class ImportAnalyzeService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(buffer: Buffer, tipo: ImportTipo = 'POLIZAS'): Promise<AnalyzeResult> {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    if (wb.worksheets.length === 0) {
      throw new Error('El archivo no tiene solapas legibles.');
    }

    const { ws, headerRow } = this.detectHeader(wb, tipo);
    const headers = this.readHeaders(ws, headerRow);
    const sampleRows = this.readSampleRows(ws, headerRow, headers);

    // POLIZAS sugiere compañía + perfil; DEUDA es multi-compañía (no aplica).
    const companiaSugerida =
      tipo === 'POLIZAS' ? await this.suggestCompania(wb) : null;
    const profileExistente = companiaSugerida
      ? await this.loadProfileMapping(companiaSugerida.id)
      : null;

    const mappingSugerido =
      tipo === 'DEUDA'
        ? this.suggestByKeywords(headers, DEUDA_FIELD_KEYWORDS)
        : (this.suggestMapping(headers, profileExistente) as Record<string, string>);

    return {
      tipo,
      campos: CAMPOS_POR_TIPO[tipo],
      sheets: wb.worksheets.map((w) => w.name),
      sheet: ws.name,
      headerRowDetectada: headerRow,
      headers,
      sampleRows,
      companiaSugerida,
      profileExistente,
      mappingSugerido,
    };
  }

  // -------------------------------------------------------------------------
  // Detección de header
  // -------------------------------------------------------------------------

  /**
   * Header = fila que más keywords canónicas (del tipo) matchea. Robusto frente
   * a planillas con título/metadata arriba (p.ej. POLIZAS con header en fila 10).
   * Para DEUDA, si existe una solapa "DEUDA" se restringe la búsqueda a ella
   * (el TABLERO tiene muchas solapas con columnas tipo "póliza/importe").
   */
  private detectHeader(wb: Workbook, tipo: ImportTipo): { ws: Worksheet; headerRow: number } {
    const keywords = ALL_KEYWORDS_POR_TIPO[tipo];
    let sheets = wb.worksheets;
    if (tipo === 'DEUDA') {
      const deuda = wb.worksheets.find(
        (w) => w.name.trim().toLowerCase() === DEUDA_SHEET.toLowerCase(),
      );
      if (deuda) sheets = [deuda];
    }

    let best: { ws: Worksheet; headerRow: number; score: number } | null = null;
    for (const ws of sheets) {
      const last = Math.min(ws.rowCount, MAX_HEADER_SCAN);
      const cols = ws.columnCount || 1;
      for (let r = 1; r <= last; r++) {
        const row = ws.getRow(r);
        let nonEmpty = 0;
        let score = 0;
        for (let c = 1; c <= cols; c++) {
          const key = headerKey(cellValue(row.getCell(c)));
          if (key === '') continue;
          nonEmpty++;
          if (keywords.some((kw) => key.includes(kw))) score++;
        }
        // Requiere algo de ancho para no confundir un título suelto con el header.
        if (nonEmpty < 3) continue;
        if (!best || score > best.score) {
          best = { ws, headerRow: r, score };
        }
      }
    }

    if (!best || best.score === 0) {
      throw new Error('No se pudo detectar la fila de encabezados en el archivo.');
    }
    return { ws: best.ws, headerRow: best.headerRow };
  }

  /**
   * Auto-match genérico por keywords (usado por DEUDA). Cada header se asigna a
   * lo sumo a un campo; cada campo toma el primer header (por orden de columna)
   * que matchee y siga libre.
   */
  private suggestByKeywords(
    headers: AnalyzeHeader[],
    fields: { field: string; keywords: string[] }[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const usado = new Set<string>();
    for (const { field, keywords } of fields) {
      for (const h of headers) {
        if (usado.has(h.col)) continue;
        if (keywords.some((kw) => headerKey(h.nombre).includes(kw))) {
          result[field] = h.col;
          usado.add(h.col);
          break;
        }
      }
    }
    return result;
  }

  private readHeaders(ws: Worksheet, headerRow: number): AnalyzeHeader[] {
    const row = ws.getRow(headerRow);
    const cols = ws.columnCount || 1;
    const out: AnalyzeHeader[] = [];
    for (let c = 1; c <= cols; c++) {
      const nombre = asString(cellValue(row.getCell(c)));
      if (nombre) out.push({ col: colLetter(c), nombre });
    }
    return out;
  }

  private readSampleRows(
    ws: Worksheet,
    headerRow: number,
    headers: AnalyzeHeader[],
  ): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const last = ws.rowCount;
    for (let r = headerRow + 1; r <= last && out.length < SAMPLE_ROWS; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, unknown> = {};
      let hasData = false;
      for (const h of headers) {
        const v = cellValue(row.getCell(this.colIndexOf(h.col)));
        obj[h.col] = v ?? null;
        if (v !== null && v !== undefined && String(v).trim() !== '') hasData = true;
      }
      if (hasData) out.push(obj);
    }
    return out;
  }

  private colIndexOf(letter: string): number {
    let n = 0;
    for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  }

  // -------------------------------------------------------------------------
  // Sugerencia de mapping
  // -------------------------------------------------------------------------

  /**
   * Auto-matchea los headers a campos canónicos por keywords. Cada header se
   * asigna a lo sumo a un campo; cada campo toma el primer header (por orden de
   * columna) que matchee y siga libre.
   * Si hay un perfil guardado para la compañía, sus columnas tienen prioridad
   * (es el mapeo confiable y reusable de esa compañía).
   */
  suggestMapping(
    headers: AnalyzeHeader[],
    profile: ResolvedImportMapping | null,
  ): SuggestedMapping {
    const result: SuggestedMapping = {};
    const usado = new Set<string>();

    for (const { field, keywords } of FIELD_KEYWORDS) {
      for (const h of headers) {
        if (usado.has(h.col)) continue;
        const key = headerKey(h.nombre);
        if (keywords.some((kw) => key.includes(kw))) {
          result[field] = h.col;
          usado.add(h.col);
          break;
        }
      }
    }

    if (profile) {
      const fromProfile: SuggestedMapping = {
        colPoliza: profile.colPoliza,
        colTomador: profile.colTomador,
        colRamo: profile.colRamo ?? undefined,
        colInicio: profile.colInicio,
        colFin: profile.colFin ?? undefined,
        colObs: profile.colObs ?? undefined,
        colBien: profile.colBien ?? undefined,
        colFechaFacturado: profile.colFechaFacturado ?? undefined,
        colMedioPago: profile.colMedioPago ?? undefined,
      };
      for (const [k, v] of Object.entries(fromProfile)) {
        if (v) result[k as keyof SuggestedMapping] = v;
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Sugerencia de compañía (por identificador/productor en el archivo)
  // -------------------------------------------------------------------------

  private async suggestCompania(wb: Workbook): Promise<CompaniaSugerida | null> {
    const profiles = await this.prisma.companiaImportProfile.findMany({
      include: { compania: { select: { id: true, nombre: true } } },
    });
    if (profiles.length === 0) return null;

    const haystack = this.scanText(wb);

    for (const p of profiles) {
      const candidatos = this.matchCandidates(p.identificador, p.compania.nombre);
      const hit = candidatos.find((c) => haystack.includes(c));
      if (hit) {
        return { id: p.compania.id, nombre: p.compania.nombre, match: hit };
      }
    }
    return null;
  }

  /** Texto normalizado de las primeras filas de todas las solapas. */
  private scanText(wb: Workbook): string {
    const parts: string[] = [];
    for (const ws of wb.worksheets) {
      parts.push(headerKey(ws.name));
      const last = Math.min(ws.rowCount, MAX_HEADER_SCAN);
      const cols = ws.columnCount || 1;
      for (let r = 1; r <= last; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= cols; c++) {
          const key = headerKey(cellValue(row.getCell(c)));
          if (key) parts.push(key);
        }
      }
    }
    return parts.join(' | ');
  }

  /** Strings distintivos a buscar: identificador, nombre y tokens numéricos (>=3 díg.). */
  private matchCandidates(identificador: string, nombre: string): string[] {
    const out = new Set<string>();
    const idKey = headerKey(identificador);
    if (idKey) out.add(idKey);
    const nombreKey = headerKey(nombre);
    if (nombreKey) out.add(nombreKey);
    for (const tok of idKey.match(/\d{3,}/g) ?? []) out.add(tok);
    return [...out];
  }

  // -------------------------------------------------------------------------
  // Perfil existente
  // -------------------------------------------------------------------------

  private async loadProfileMapping(companiaId: string): Promise<ResolvedImportMapping | null> {
    const p = await this.prisma.companiaImportProfile.findFirst({ where: { companiaId } });
    if (!p) return null;
    return {
      companiaId: p.companiaId,
      palabraClaveFila: p.palabraClaveFila,
      colPoliza: p.colPoliza,
      colTomador: p.colTomador,
      colRamo: p.colRamo,
      colInicio: p.colInicioVig,
      colFin: p.colFinVig,
      colObs: p.colObservaciones,
      colBien: p.colBienAsegurado,
      colFechaFacturado: p.colFechaFacturado,
      colMedioPago: p.colMedioPago,
    };
  }
}
