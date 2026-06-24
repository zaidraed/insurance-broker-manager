import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';

@Injectable()
export class SeguimientosService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPolizaExiste(polizaId: string): Promise<void> {
    const poliza = await this.prisma.poliza.findUnique({
      where: { id: polizaId },
      select: { id: true },
    });
    if (!poliza) throw new NotFoundException(`Póliza ${polizaId} no encontrada`);
  }

  /** Crea un seguimiento (append-only). usuarioId viene del usuario autenticado. */
  async crear(polizaId: string, dto: CreateSeguimientoDto, usuarioId: string | null) {
    await this.assertPolizaExiste(polizaId);
    try {
      return await this.prisma.seguimiento.create({
        data: {
          polizaId,
          canal: dto.canal,
          tipo: dto.tipo,
          texto: dto.texto,
          usuarioId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException('El usuario del token ya no existe');
      }
      throw e;
    }
  }

  async listar(polizaId: string) {
    await this.assertPolizaExiste(polizaId);
    return this.prisma.seguimiento.findMany({
      where: { polizaId },
      orderBy: { fecha: 'desc' },
    });
  }
}
