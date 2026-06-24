import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cell, Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from './import-normalizer.service';
import { CuotasImportReport } from './cuotas-import-report.types';

const BATCH_SIZE = 500;
const MAX_MUESTRAS = 10;
const PAGO_REGEX = /pag|abonad|cobrad/i;
/** El header se ubica buscando esta columna (insensible a acentos/símbolos/espacios). */
const HEADER_KEYWORD = 'Nº de Cuota';
/** Hasta qué fila buscar el header antes de rendirse. */
const MAX_HEADER_SCAN = 50;

// Todas las filas pertenecen a ASEGURADORA A (Nº Intermediario 001).
const COMPANIA_ALIAS = 'ASEGURADORA A 001';

// Columnas (1-based)
const COL = {
  POLIZA: 4, // D
  MINISTERIO: 6, // F
  NRO_CUOTA: 11, // K
  VENCIMIENTO: 12, // L
  IMPORTE: 13, // M
  PAGO: 14, // N  (O=Estado es fórmula, se ignora)
} as const;

@Injectable()
export class CuotasImportService {
  private readonly logger = new Logger(CuotasImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: ImportNormalizerService,
  ) {}

  private cellValue(cell: Cell): unknown {
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

  private asString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  /** Clave de comparación de header: sin acentos, sin símbolos/espacios, uppercase. */
  private headerKey(raw: unknown): string {
    return String(raw ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Localiza la solapa y la fila del header buscando la columna "Nº de Cuota".
   * Corre tanto sobre el export "vencimientos" (header fila 1) como sobre
   * "Resumen de Cuotas" (header fila 13).
   */
  private findHeader(wb: Workbook): { ws: Worksheet; headerRow: number } {
    const target = this.headerKey(HEADER_KEYWORD);
    for (const ws of wb.worksheets) {
      const last = Math.min(ws.rowCount, MAX_HEADER_SCAN);
      for (let r = 1; r <= last; r++) {
        const row = ws.getRow(r);
        const cols = ws.columnCount || 1;
        for (let c = 1; c <= cols; c++) {
          if (this.headerKey(this.cellValue(row.getCell(c))) === target) {
            return { ws, headerRow: r };
          }
        }
      }
    }
    throw new Error(
      `No se encontró el header (columna "${HEADER_KEYWORD}") en ninguna solapa. ` +
        `Solapas: ${wb.worksheets.map((w) => w.name).join(', ')}`,
    );
  }

  /** Heurística provisoria. NO asume: los valores crudos se reportan para afinar. */
  private interpretarPago(raw: string | null): boolean {
    return raw != null && PAGO_REGEX.test(raw);
  }

  async run(filePath: string): Promise<CuotasImportReport> {
    const wb = new Workbook();
    await wb.xlsx.readFile(filePath);

    const { ws, headerRow } = this.findHeader(wb);
    const firstDataRow = headerRow + 1;
    this.logger.log(
      `Solapa "${ws.name}" — header en fila ${headerRow}, datos desde ${firstDataRow}.`,
    );

    const companiaObjetivo = await this.normalizer.normalizeCompania(COMPANIA_ALIAS);
    if (!companiaObjetivo) throw new Error('No se pudo resolver la compañía ASEGURADORA A');
    this.logger.log(`Compañía objetivo: ${companiaObjetivo.nombre} (${companiaObjetivo.id})`);

    // Mapa numero -> polizaId para ASEGURADORA A
    const polizas = await this.prisma.poliza.findMany({
      where: { companiaId: companiaObjetivo.id },
      select: { id: true, numero: true },
    });
    const polizaIdByNumero = new Map(polizas.map((p) => [p.numero, p.id]));

    // Claves de cuotas existentes (para creadas vs actualizadas)
    const cuotasExistentes = await this.prisma.cuota.findMany({
      where: { poliza: { companiaId: companiaObjetivo.id } },
      select: { polizaId: true, nroCuota: true },
    });
    const existingKeys = new Set(cuotasExistentes.map((c) => `${c.polizaId}|${c.nroCuota}`));

    const report: CuotasImportReport = {
      filas: 0,
      cuotasCreadas: 0,
      cuotasActualizadas: 0,
      polizasNoEncontradas: { count: 0, muestras: [] },
      valoresDistintosPago: {},
      filasOmitidas: 0,
    };

    let batch: Prisma.PrismaPromise<unknown>[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      await this.prisma.$transaction(batch);
      batch = [];
    };

    const last = ws.rowCount;
    for (let r = firstDataRow; r <= last; r++) {
      const row = ws.getRow(r);

      const numero = this.normalizer.normalizeNumeroPoliza(this.cellValue(row.getCell(COL.POLIZA)));
      if (!numero) continue;
      report.filas++;

      // Registrar valor crudo de pago (todas las filas con D)
      const pagoRaw = this.asString(this.cellValue(row.getCell(COL.PAGO)));
      const pagoKey = pagoRaw ?? '<vacío>';
      report.valoresDistintosPago[pagoKey] = (report.valoresDistintosPago[pagoKey] ?? 0) + 1;

      const nroCuota = this.normalizer.parseCantidad(this.cellValue(row.getCell(COL.NRO_CUOTA)));
      const vencimiento = this.normalizer.cleanDate(this.cellValue(row.getCell(COL.VENCIMIENTO)));
      if (nroCuota === null || vencimiento === null) {
        report.filasOmitidas++;
        continue;
      }

      const polizaId = polizaIdByNumero.get(numero);
      if (!polizaId) {
        report.polizasNoEncontradas.count++;
        if (report.polizasNoEncontradas.muestras.length < MAX_MUESTRAS) {
          report.polizasNoEncontradas.muestras.push(numero);
        }
        continue;
      }

      const importe = this.normalizer.parseImporte(this.cellValue(row.getCell(COL.IMPORTE)));
      const pagada = this.interpretarPago(pagoRaw);

      const key = `${polizaId}|${nroCuota}`;
      if (existingKeys.has(key)) report.cuotasActualizadas++;
      else {
        report.cuotasCreadas++;
        existingKeys.add(key);
      }

      const data = { vencimiento, importe, pagada };
      batch.push(
        this.prisma.cuota.upsert({
          where: { polizaId_nroCuota: { polizaId, nroCuota } },
          create: { polizaId, nroCuota, ...data },
          update: data,
        }),
      );
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    // NOTA: este importer NO toca Poliza.estadoPago. La autoridad de IMPAGA es la
    // solapa DEUDA (ver DeudaImportService); recalcular el estado de pago acá a
    // partir de las cuotas marcaba pólizas como IMPAGA fuera de DEUDA. Las cuotas
    // se importan solo como dato (vencimiento/importe/pagada para refacturación).
    return report;
  }
}
