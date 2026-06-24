import { Injectable, Logger } from '@nestjs/common';
import { EstadoVigencia } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from '../import/import-normalizer.service';
import { diffCalendarDaysUTC } from '../../common/utils/date.util';

const CHUNK = 1000;
const DIAS_PARA_REVISAR = 6;

export interface RecalculoResult {
  estadosActualizados: number;
  cobranzasActualizadas: number;
}

function* chunked<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

@Injectable()
export class RecalculoService {
  private readonly logger = new Logger(RecalculoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: ImportNormalizerService,
  ) {}

  // 03:00 todos los días (hora de Argentina). El cómputo es en UTC, independiente de la TZ.
  @Cron('0 3 * * *', { name: 'recalculo-diario', timeZone: 'America/Argentina/Buenos_Aires' })
  async handleCron(): Promise<void> {
    this.logger.log('Iniciando recálculo diario (cron 03:00)');
    const res = await this.recalcularTodo();
    this.logger.log(
      `Recálculo diario OK: estados=${res.estadosActualizados}, cobranzas=${res.cobranzasActualizadas}`,
    );
  }

  async recalcularTodo(): Promise<RecalculoResult> {
    const estadosActualizados = await this.recalcularEstadosVigencia();
    const cobranzasActualizadas = await this.recalcularRevisar();
    return { estadosActualizados, cobranzasActualizadas };
  }

  /** Recalcula estadoVigencia de todas las pólizas; solo escribe las que cambian. */
  async recalcularEstadosVigencia(): Promise<number> {
    const polizas = await this.prisma.poliza.findMany({
      select: { id: true, vigenciaFin: true, estadoVigencia: true },
    });

    const buckets = new Map<EstadoVigencia, string[]>();
    for (const p of polizas) {
      const nuevo = this.normalizer.computeEstadoVigencia(p.vigenciaFin);
      if (nuevo !== p.estadoVigencia) {
        const list = buckets.get(nuevo) ?? [];
        list.push(p.id);
        buckets.set(nuevo, list);
      }
    }

    let total = 0;
    for (const [estado, ids] of buckets) {
      for (const ch of chunked(ids, CHUNK)) {
        await this.prisma.poliza.updateMany({
          where: { id: { in: ch } },
          data: { estadoVigencia: estado },
        });
        total += ch.length;
      }
    }
    return total;
  }

  /** Recalcula revisar de todos los CobranzaTracking; solo escribe los que cambian. */
  async recalcularRevisar(): Promise<number> {
    const tracks = await this.prisma.cobranzaTracking.findMany({
      select: { id: true, ultimaActualizacion: true, revisar: true },
    });

    const hoy = new Date();
    const toTrue: string[] = [];
    const toFalse: string[] = [];
    for (const t of tracks) {
      const nuevo =
        t.ultimaActualizacion != null &&
        diffCalendarDaysUTC(hoy, t.ultimaActualizacion) > DIAS_PARA_REVISAR;
      if (nuevo !== t.revisar) (nuevo ? toTrue : toFalse).push(t.id);
    }

    let total = 0;
    for (const [valor, ids] of [
      [true, toTrue],
      [false, toFalse],
    ] as const) {
      for (const ch of chunked(ids, CHUNK)) {
        await this.prisma.cobranzaTracking.updateMany({
          where: { id: { in: ch } },
          data: { revisar: valor },
        });
        total += ch.length;
      }
    }
    return total;
  }
}
