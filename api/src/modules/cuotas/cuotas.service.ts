import { Injectable } from '@nestjs/common';
import { addDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { diffCalendarDaysUTC, todayUTC } from '../../common/utils/date.util';

@Injectable()
export class CuotasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Semáforo de refacturación: cuotas impagas con vencimiento <= hoy+dias (incluye vencidas). */
  async refacturacion(dias: number) {
    const today = todayUTC();
    const horizon = addDays(today, dias);
    const in30 = addDays(today, 30);
    const in60 = addDays(today, 60);

    const [cuotas, vencidasImpagas, proximas30, proximas60] = await Promise.all([
      this.prisma.cuota.findMany({
        where: { pagada: false, vencimiento: { lte: horizon } },
        orderBy: { vencimiento: 'asc' }, // más urgente primero (más vencida)
        include: {
          poliza: {
            select: {
              id: true,
              numero: true,
              organismo: { select: { id: true, nombre: true } },
            },
          },
        },
      }),
      this.prisma.cuota.count({ where: { pagada: false, vencimiento: { lt: today } } }),
      this.prisma.cuota.count({ where: { pagada: false, vencimiento: { gte: today, lte: in30 } } }),
      this.prisma.cuota.count({ where: { pagada: false, vencimiento: { gte: today, lte: in60 } } }),
    ]);

    const data = cuotas.map((c) => ({
      cuotaId: c.id,
      nroCuota: c.nroCuota,
      poliza: { id: c.poliza.id, numero: c.poliza.numero },
      organismo: c.poliza.organismo,
      importe: c.importe?.toString() ?? null,
      vencimiento: c.vencimiento,
      diasParaVencer: diffCalendarDaysUTC(c.vencimiento, today),
    }));

    return {
      dias,
      counts: { vencidasImpagas, proximas30, proximas60 },
      data,
    };
  }
}
