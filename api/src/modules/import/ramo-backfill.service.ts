import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cell, Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from './import-normalizer.service';
import { BackfillRamosReport, CodigoNoMapeado } from './ramo-backfill.types';

const SHEET_NAME = 'basededatos';
const FIRST_DATA_ROW = 4; // header en fila 3
const BATCH_SIZE = 500;

const COL = {
  POLIZA: 1, // A
  RAMA_CODIGO: 3, // C
  COMPANIA: 6, // F
} as const;

@Injectable()
export class RamoBackfillService {
  private readonly logger = new Logger(RamoBackfillService.name);

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

  private cleanCodigo(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim().replace(/\.0$/, '');
    return s === '' ? null : s;
  }

  async run(filePath: string): Promise<BackfillRamosReport> {
    const wb = new Workbook();
    await wb.xlsx.readFile(filePath);
    let ws: Worksheet | undefined = wb.getWorksheet(SHEET_NAME);
    if (!ws) ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === SHEET_NAME);
    if (!ws) throw new Error(`No se encontró la solapa "${SHEET_NAME}"`);

    const polizas = await this.prisma.poliza.findMany({
      select: { id: true, companiaId: true, numero: true, ramoId: true },
    });
    const polizaByKey = new Map(polizas.map((p) => [`${p.companiaId}|${p.numero}`, p]));
    const sinRamoAntes = polizas.filter((p) => p.ramoId === null).length;

    const companias = await this.prisma.compania.findMany({ select: { id: true, nombre: true } });
    const nombreByCompania = new Map(companias.map((c) => [c.id, c.nombre]));

    const report: BackfillRamosReport = {
      sinRamoAntes,
      resueltas: 0,
      siguenSinRamo: 0,
      codigosNoMapeados: [],
    };
    const noMapeados = new Map<string, CodigoNoMapeado>();

    const processed = new Set<string>();
    let batch: Prisma.PrismaPromise<unknown>[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      await this.prisma.$transaction(batch);
      batch = [];
    };

    const last = ws.rowCount;
    for (let r = FIRST_DATA_ROW; r <= last; r++) {
      const row = ws.getRow(r);
      const numero = this.normalizer.normalizeNumeroPoliza(this.cellValue(row.getCell(COL.POLIZA)));
      if (!numero) continue;

      const compania = await this.normalizer.normalizeCompania(this.cellValue(row.getCell(COL.COMPANIA)));
      if (!compania) continue;

      const poliza = polizaByKey.get(`${compania.id}|${numero}`);
      if (!poliza || processed.has(poliza.id)) continue;
      processed.add(poliza.id);

      const codigo = this.cleanCodigo(this.cellValue(row.getCell(COL.RAMA_CODIGO)));
      const data: Prisma.PolizaUpdateInput = { ramoCodigoOrigen: codigo };

      if (poliza.ramoId === null) {
        const ramoId = await this.normalizer.resolveRamoByCode(poliza.companiaId, codigo);
        if (ramoId) {
          data.ramo = { connect: { id: ramoId } };
          report.resueltas++;
        } else {
          const cNombre = nombreByCompania.get(poliza.companiaId) ?? '(desconocida)';
          const key = `${cNombre}|${codigo ?? ''}`;
          const entry = noMapeados.get(key) ?? { compania: cNombre, codigo, count: 0 };
          entry.count++;
          noMapeados.set(key, entry);
        }
      }

      batch.push(this.prisma.poliza.update({ where: { id: poliza.id }, data }));
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    report.siguenSinRamo = sinRamoAntes - report.resueltas;
    report.codigosNoMapeados = [...noMapeados.values()].sort((a, b) => b.count - a.count);
    return report;
  }

  // ---------------------------------------------------------------------------
  // Operaciones admin (mapeo manual del remanente)
  // ---------------------------------------------------------------------------

  /** Agrupa pólizas sin ramo por (compania, ramoCodigoOrigen). */
  async noMapeados() {
    const groups = await this.prisma.poliza.groupBy({
      by: ['companiaId', 'ramoCodigoOrigen'],
      where: { ramoId: null },
      _count: { _all: true },
      orderBy: { _count: { companiaId: 'desc' } },
    });

    const companias = await this.prisma.compania.findMany({ select: { id: true, nombre: true } });
    const nombreByCompania = new Map(companias.map((c) => [c.id, c.nombre]));

    return groups.map((g) => ({
      compania: { id: g.companiaId, nombre: nombreByCompania.get(g.companiaId) ?? '(desconocida)' },
      codigoOrigen: g.ramoCodigoOrigen,
      count: g._count._all,
    }));
  }

  /** Crea un RamoMapping manual y backfillea las pólizas afectadas. */
  async mapear(input: { companiaId?: string; codigoOrigen: string; ramoId: string }) {
    const { companiaId, codigoOrigen, ramoId } = input;

    const ramo = await this.prisma.ramo.findUnique({ where: { id: ramoId }, select: { id: true } });
    if (!ramo) throw new NotFoundException(`Ramo ${ramoId} no encontrado`);

    if (companiaId) {
      const comp = await this.prisma.compania.findUnique({
        where: { id: companiaId },
        select: { id: true },
      });
      if (!comp) throw new NotFoundException(`Compañía ${companiaId} no encontrada`);
    }

    const existente = await this.prisma.ramoMapping.findFirst({
      where: { companiaId: companiaId ?? null, codigoOrigen, ramoId, textoOrigen: null },
      select: { id: true },
    });
    const mapping =
      existente ??
      (await this.prisma.ramoMapping.create({
        data: { companiaId: companiaId ?? null, codigoOrigen, textoOrigen: null, ramoId },
        select: { id: true },
      }));

    const { count } = await this.prisma.poliza.updateMany({
      where: {
        ramoId: null,
        ramoCodigoOrigen: codigoOrigen,
        ...(companiaId ? { companiaId } : {}),
      },
      data: { ramoId },
    });

    return { ramoMappingId: mapping.id, polizasActualizadas: count };
  }
}
