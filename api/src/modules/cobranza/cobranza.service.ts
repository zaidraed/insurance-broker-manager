import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { diffCalendarDaysUTC } from '../../common/utils/date.util';
import { UpdateCobranzaDto } from './dto/update-cobranza.dto';

const DIAS_PARA_REVISAR = 6;

@Injectable()
export class CobranzaService {
  constructor(private readonly prisma: PrismaService) {}

  /** revisar = ultimaActualizacion != null && diffDays(hoy, ultimaActualizacion) > 6 (UTC). */
  private computeRevisar(ultimaActualizacion: Date | null): boolean {
    if (!ultimaActualizacion) return false;
    return diffCalendarDaysUTC(new Date(), ultimaActualizacion) > DIAS_PARA_REVISAR;
  }

  async upsert(polizaId: string, dto: UpdateCobranzaDto) {
    const poliza = await this.prisma.poliza.findUnique({
      where: { id: polizaId },
      select: { id: true },
    });
    if (!poliza) throw new NotFoundException(`Póliza ${polizaId} no encontrada`);

    const actual = await this.prisma.cobranzaTracking.findUnique({ where: { polizaId } });

    // Merge: solo se pisan los campos provistos en el body.
    const fechaEnvioDoc =
      dto.fechaEnvioDoc !== undefined ? dto.fechaEnvioDoc : (actual?.fechaEnvioDoc ?? null);
    const ultimaActualizacion =
      dto.ultimaActualizacion !== undefined
        ? dto.ultimaActualizacion
        : (actual?.ultimaActualizacion ?? null);
    const queSigue = dto.queSigue !== undefined ? dto.queSigue : (actual?.queSigue ?? null);
    const revisar = this.computeRevisar(ultimaActualizacion);

    const data = { fechaEnvioDoc, ultimaActualizacion, queSigue, revisar };

    return this.prisma.cobranzaTracking.upsert({
      where: { polizaId },
      create: { polizaId, ...data },
      update: data,
    });
  }

  async listarParaRevisar() {
    const tracks = await this.prisma.cobranzaTracking.findMany({
      where: { revisar: true },
      orderBy: { ultimaActualizacion: 'asc' }, // más atrasado primero (más días sin revisar)
      include: {
        poliza: {
          select: {
            id: true,
            numero: true,
            organismo: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    const hoy = new Date();
    return tracks.map((t) => ({
      polizaId: t.polizaId,
      numero: t.poliza.numero,
      organismo: t.poliza.organismo,
      ultimaActualizacion: t.ultimaActualizacion,
      queSigue: t.queSigue,
      diasSinRevisar: t.ultimaActualizacion
        ? diffCalendarDaysUTC(hoy, t.ultimaActualizacion)
        : null,
    }));
  }
}
