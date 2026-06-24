import { Injectable, Logger } from '@nestjs/common';
import { EstadoPago, Prisma } from '@prisma/client';
import { Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from './import-normalizer.service';
import { DeudaImportReport, DeudaScopedReport } from './deuda-import.types';
import { ResolvedDeudaMapping } from './import-mapping.types';
import { asString, cellValue, headerKey, readCol } from './xlsx-cell.util';

const SHEET_NAME = 'DEUDA';
const BATCH_SIZE = 500;
const MAX_MUESTRAS = 10;
const MAX_HEADER_SCAN = 50;
const AL_FECHA_REGEX = /AL\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;

/** Mapping fijo de la solapa DEUDA del TABLERO (header en fila 1, obs = E + F). */
const CLI_DEUDA_MAPPING: Omit<ResolvedDeudaMapping, 'sheet'> = {
  headerRow: 1,
  colPoliza: 'A',
  colCompania: 'D',
  colImporte: 'C',
  colObs: 'E',
  colObs2: 'F',
};

interface DeudaGrupo {
  companiaId: string;
  numero: string;
  monto: Prisma.Decimal;
  obs: string[];
  actualizadaAl: Date | null;
  /** Combos (importe|obs) ya contados, para deduplicar filas idénticas antes de sumar. */
  vistos: Set<string>;
}

@Injectable()
export class DeudaImportService {
  private readonly logger = new Logger(DeudaImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: ImportNormalizerService,
  ) {}

  /** Extrae la fecha de un "AL dd/mm/aaaa" en el texto (UTC), o null. */
  private parseFechaAl(texto: string): Date | null {
    const m = AL_FECHA_REGEX.exec(texto);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += yy < 50 ? 2000 : 1900;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Ubica la solapa de deuda: por nombre exacto del mapping, por palabra clave, o "DEUDA". */
  private resolveSheet(wb: Workbook, mapping: ResolvedDeudaMapping): Worksheet {
    const wanted = mapping.sheet?.trim().toLowerCase();
    if (wanted) {
      const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === wanted);
      if (!ws) throw new Error(`No se encontró la solapa "${mapping.sheet}".`);
      return ws;
    }
    if (mapping.palabraClaveFila) {
      const target = headerKey(mapping.palabraClaveFila);
      for (const ws of wb.worksheets) {
        const last = Math.min(ws.rowCount, MAX_HEADER_SCAN);
        for (let r = 1; r <= last; r++) {
          const row = ws.getRow(r);
          const cols = ws.columnCount || 1;
          for (let c = 1; c <= cols; c++) {
            if (headerKey(cellValue(row.getCell(c))) === target) return ws;
          }
        }
      }
      throw new Error(`No se encontró la solapa con palabra clave "${mapping.palabraClaveFila}".`);
    }
    const ws =
      wb.getWorksheet(SHEET_NAME) ??
      wb.worksheets.find((w) => w.name.trim().toLowerCase() === SHEET_NAME.toLowerCase());
    if (!ws) throw new Error(`No se encontró la solapa "${SHEET_NAME}".`);
    return ws;
  }

  // -------------------------------------------------------------------------
  // Wrappers de entrada
  // -------------------------------------------------------------------------

  /** Path CLI: solapa DEUDA del TABLERO con el mapping fijo histórico (obs = E + F). */
  async run(filePath: string): Promise<DeudaImportReport> {
    const wb = new Workbook();
    await wb.xlsx.readFile(filePath);
    const r = await this.runScoped(wb, { sheet: SHEET_NAME, ...CLI_DEUDA_MAPPING });
    return {
      filas: r.filasLeidas,
      polizasConDeuda: r.polizasConDeuda,
      marcadasImpaga: r.marcadasImpaga,
      noEncontradas: r.noEncontradas,
      deudaTotal: r.deudaTotalAplicada,
    };
  }

  /** Path UI: corre desde un buffer xlsx con el mapping armado en el front. */
  async runFromUi(buffer: Buffer, mapping: ResolvedDeudaMapping): Promise<DeudaScopedReport> {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return this.runScoped(wb, mapping);
  }

  // -------------------------------------------------------------------------
  // Core: reset + aplicación SCOPED por las compañías presentes en el archivo
  // -------------------------------------------------------------------------

  async runScoped(wb: Workbook, mapping: ResolvedDeudaMapping): Promise<DeudaScopedReport> {
    const ws = this.resolveSheet(wb, mapping);
    const firstDataRow = (mapping.headerRow ?? 1) + 1;
    const obsCols = [mapping.colObs, mapping.colObs2].filter((c): c is string => Boolean(c));

    // Mapa numero por compañía -> polizaId (lazy por compañía).
    const polizaIdCache = new Map<string, Map<string, string>>();
    const loadPolizas = async (companiaId: string): Promise<Map<string, string>> => {
      const cached = polizaIdCache.get(companiaId);
      if (cached) return cached;
      const polizas = await this.prisma.poliza.findMany({
        where: { companiaId },
        select: { id: true, numero: true },
      });
      const map = new Map(polizas.map((p) => [p.numero, p.id]));
      polizaIdCache.set(companiaId, map);
      return map;
    };

    const grupos = new Map<string, DeudaGrupo>();
    // Compañías presentes en el archivo = scope del reset (id -> nombre).
    const companiasEnArchivo = new Map<string, string>();
    let filas = 0;

    const last = ws.rowCount;
    for (let r = firstDataRow; r <= last; r++) {
      const row = ws.getRow(r);
      const numero = this.normalizer.normalizeNumeroPoliza(readCol(row, mapping.colPoliza));
      if (!numero) continue;
      filas++;

      const compania = await this.normalizer.normalizeCompania(readCol(row, mapping.colCompania));
      if (!compania) continue;
      companiasEnArchivo.set(compania.id, compania.nombre);

      const importe = this.normalizer.parseImporte(readCol(row, mapping.colImporte));
      const obs = obsCols
        .map((c) => asString(readCol(row, c)))
        .filter((x): x is string => x !== null)
        .join(' ')
        .trim();

      const key = `${compania.id}|${numero}`;
      const grupo =
        grupos.get(key) ??
        {
          companiaId: compania.id,
          numero,
          monto: new Prisma.Decimal(0),
          obs: [],
          actualizadaAl: null,
          vistos: new Set<string>(),
        };

      // Dedup: misma fila (mismo importe + misma obs) no se vuelve a sumar.
      // Si el importe difiere, se mantienen ambas (deudas distintas).
      const dedupKey = `${importe ? importe.toString() : 'null'}|${obs}`;
      if (!grupo.vistos.has(dedupKey)) {
        grupo.vistos.add(dedupKey);
        if (importe) grupo.monto = grupo.monto.add(importe);
        if (obs) grupo.obs.push(obs);
        const fecha = obs ? this.parseFechaAl(obs) : null;
        if (fecha && (!grupo.actualizadaAl || fecha > grupo.actualizadaAl)) {
          grupo.actualizadaAl = fecha;
        }
      }
      grupos.set(key, grupo);
    }

    // POST-PROCESO: DEUDA es autoridad, PERO solo de las compañías del archivo.
    // Reset acotado: estadoPago=NA + limpiar deuda SOLO para esas compañías, así
    // una carga parcial no pisa la impaga de las demás.
    const scope = [...companiasEnArchivo.keys()];
    if (scope.length > 0) {
      await this.prisma.poliza.updateMany({
        where: { companiaId: { in: scope } },
        data: { estadoPago: EstadoPago.NA, deudaMonto: null, deudaObs: null, deudaActualizadaAl: null },
      });
    }

    const report: DeudaScopedReport = {
      filasLeidas: filas,
      polizasConDeuda: grupos.size,
      marcadasImpaga: 0,
      noEncontradas: { count: 0, muestras: [] },
      deudaTotalAplicada: '0',
      companiasEnArchivo: [...companiasEnArchivo.values()],
    };
    let deudaTotal = new Prisma.Decimal(0);

    let batch: Prisma.PrismaPromise<unknown>[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      await this.prisma.$transaction(batch);
      batch = [];
    };

    for (const grupo of grupos.values()) {
      const polizas = await loadPolizas(grupo.companiaId);
      const polizaId = polizas.get(grupo.numero);
      if (!polizaId) {
        report.noEncontradas.count++;
        if (report.noEncontradas.muestras.length < MAX_MUESTRAS) {
          report.noEncontradas.muestras.push(grupo.numero);
        }
        continue;
      }

      report.marcadasImpaga++;
      deudaTotal = deudaTotal.add(grupo.monto);

      batch.push(
        this.prisma.poliza.update({
          where: { id: polizaId },
          data: {
            estadoPago: EstadoPago.IMPAGA,
            deudaMonto: grupo.monto,
            deudaObs: grupo.obs.length > 0 ? grupo.obs.join(' | ') : null,
            deudaActualizadaAl: grupo.actualizadaAl,
          },
        }),
      );
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    report.deudaTotalAplicada = deudaTotal.toString();
    this.logger.log(
      `Deuda (scope: ${scope.length} compañías): ${report.marcadasImpaga} IMPAGA, total ${report.deudaTotalAplicada}, ${report.noEncontradas.count} no encontradas`,
    );
    return report;
  }
}
