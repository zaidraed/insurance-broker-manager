import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cell, Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from './import-normalizer.service';
import { ImportReport } from './import-report.types';

const SHEET_NAME = 'basededatos';
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;
const BATCH_SIZE = 500;

// Columnas (1-based): A=1 ... K=11
const COL = {
  POLIZA: 1, // A
  MINISTERIO: 2, // B (organismo)
  RAMA_CODIGO: 3, // C
  FEC_VIGENCIA: 4, // D
  FIN_VIGENCIA: 5, // E
  COMPANIA: 6, // F
  IMPORTE: 7, // G
  OBSERVACIONES: 8, // H
  BIEN_ASEGURADO: 9, // I
  RAMO_TEXTO: 10, // J
  CANT_CUOTAS: 11, // K
} as const;

@Injectable()
export class BasededatosImportService {
  private readonly logger = new Logger(BasededatosImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: ImportNormalizerService,
  ) {}

  /** Lee el valor "plano" de una celda exceljs (resuelve fórmulas, rich text, hyperlinks). */
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

  async run(filePath: string): Promise<ImportReport> {
    const wb = new Workbook();
    await wb.xlsx.readFile(filePath);

    let ws: Worksheet | undefined = wb.getWorksheet(SHEET_NAME);
    if (!ws) {
      ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === SHEET_NAME);
    }
    if (!ws) {
      const disponibles = wb.worksheets.map((w) => w.name).join(', ');
      throw new Error(
        `No se encontró la solapa "${SHEET_NAME}". Solapas disponibles: ${disponibles}`,
      );
    }
    this.logger.log(
      `Solapa "${ws.name}" (${ws.rowCount} filas; header en ${HEADER_ROW}, datos desde ${FIRST_DATA_ROW})`,
    );

    const report: ImportReport = {
      total: 0,
      creadas: 0,
      actualizadas: 0,
      descartadas: [],
      ramosNoResueltos: new Set<string>(),
      companiasCreadas: new Set<string>(),
    };

    // Preload de claves existentes para distinguir creadas vs actualizadas.
    const existentes = await this.prisma.poliza.findMany({
      select: { companiaId: true, numero: true },
    });
    const existingKeys = new Set(existentes.map((p) => `${p.companiaId}|${p.numero}`));

    let batch: Prisma.PrismaPromise<unknown>[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      await this.prisma.$transaction(batch);
      batch = [];
    };

    const lastRow = ws.rowCount;
    for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
      const row = ws.getRow(r);

      const polizaStr = this.asString(this.cellValue(row.getCell(COL.POLIZA)));
      const companiaStr = this.asString(this.cellValue(row.getCell(COL.COMPANIA)));

      // Fila vacía (sin póliza ni compañía): se ignora, no cuenta.
      if (!polizaStr && !companiaStr) continue;
      report.total++;

      if (!polizaStr) {
        report.descartadas.push({ fila: r, motivo: 'sin número de póliza' });
        continue;
      }
      if (!companiaStr) {
        report.descartadas.push({ fila: r, motivo: 'sin compañía' });
        continue;
      }

      const compania = await this.normalizer.normalizeCompania(companiaStr);
      if (!compania) {
        report.descartadas.push({ fila: r, motivo: 'compañía no normalizable' });
        continue;
      }
      if (compania.created) report.companiasCreadas.add(compania.nombre);

      const organismo = await this.normalizer.splitOrganismo(
        this.cellValue(row.getCell(COL.MINISTERIO)),
      );
      if (!organismo) {
        report.descartadas.push({ fila: r, motivo: 'sin organismo (MINISTERIO)' });
        continue;
      }

      const codigoRamoRaw = this.asString(this.cellValue(row.getCell(COL.RAMA_CODIGO)));
      const textoRamoRaw = this.asString(this.cellValue(row.getCell(COL.RAMO_TEXTO)));
      const ramo = await this.normalizer.normalizeRamo(textoRamoRaw, codigoRamoRaw, {
        id: compania.id,
      });
      if (!ramo.resolved && (textoRamoRaw || codigoRamoRaw)) {
        report.ramosNoResueltos.add(textoRamoRaw ?? codigoRamoRaw ?? '');
      }

      const numero = this.normalizer.normalizeNumeroPoliza(polizaStr);
      const vigenciaInicio = this.normalizer.cleanDate(this.cellValue(row.getCell(COL.FEC_VIGENCIA)));
      const vigenciaFin = this.normalizer.cleanDate(this.cellValue(row.getCell(COL.FIN_VIGENCIA)));
      const importe = this.normalizer.parseImporte(this.cellValue(row.getCell(COL.IMPORTE)));
      const cantCuotas = this.normalizer.parseCantidad(this.cellValue(row.getCell(COL.CANT_CUOTAS)));
      const observacionRaw = this.asString(this.cellValue(row.getCell(COL.OBSERVACIONES)));
      const bienAsegurado = this.asString(this.cellValue(row.getCell(COL.BIEN_ASEGURADO)));
      const estadoVigencia = this.normalizer.computeEstadoVigencia(vigenciaFin);

      const key = `${compania.id}|${numero}`;
      if (existingKeys.has(key)) {
        report.actualizadas++;
      } else {
        report.creadas++;
        existingKeys.add(key);
      }

      const data = {
        organismoId: organismo.id,
        ramoId: ramo.ramoId,
        tomador: null,
        bienAsegurado,
        vigenciaInicio,
        vigenciaFin,
        importe,
        cantCuotas,
        observacionRaw,
        estadoVigencia,
      };

      batch.push(
        this.prisma.poliza.upsert({
          where: { companiaId_numero: { companiaId: compania.id, numero } },
          create: { numero, companiaId: compania.id, ...data },
          update: data,
        }),
      );

      if (batch.length >= BATCH_SIZE) await flush();
    }

    await flush();
    return report;
  }
}
