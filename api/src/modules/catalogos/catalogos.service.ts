import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  companias() {
    return this.prisma.compania.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  ramos() {
    return this.prisma.ramo.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
