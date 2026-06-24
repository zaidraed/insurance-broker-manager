import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoVigencia, Prisma } from '@prisma/client';
import { addDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { todayUTC } from '../../common/utils/date.util';
import { ListPolizasQueryDto } from './dto/list-polizas-query.dto';

const SORTABLE = new Set([
  'vigenciaFin',
  'vigenciaInicio',
  'numero',
  'importe',
  'deudaMonto',
  'estadoVigencia',
  'createdAt',
  'updatedAt',
]);
const NULLABLE_SORT = new Set(['vigenciaFin', 'vigenciaInicio', 'importe', 'deudaMonto']);

@Injectable()
export class PolizasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPolizasQueryDto) {
    const where: Prisma.PolizaWhereInput = {};

    if (query.estadoVigencia && query.estadoVigencia.length > 0) {
      where.estadoVigencia = { in: query.estadoVigencia };
    }
    if (query.estadoPago && query.estadoPago.length > 0) {
      where.estadoPago = { in: query.estadoPago };
    }
    if (query.companiaId) where.companiaId = query.companiaId;
    if (query.organismoId) where.organismoId = query.organismoId;
    if (query.organismoSearch) {
      where.organismo = {
        nombre: { contains: query.organismoSearch, mode: Prisma.QueryMode.insensitive },
      };
    }
    if (query.ramoId) where.ramoId = query.ramoId;

    if (query.venceDesde || query.venceHasta) {
      where.vigenciaFin = {
        ...(query.venceDesde ? { gte: new Date(query.venceDesde) } : {}),
        ...(query.venceHasta ? { lte: new Date(query.venceHasta) } : {}),
      };
    }

    if (query.search) {
      const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
      where.OR = [{ numero: contains }, { tomador: contains }, { bienAsegurado: contains }];
    }

    const [field, dir] = query.sort.split(':');
    const sortField = SORTABLE.has(field) ? field : 'vigenciaFin';
    const sortDir: Prisma.SortOrder = dir === 'desc' ? 'desc' : 'asc';
    const orderBy = (
      NULLABLE_SORT.has(sortField)
        ? { [sortField]: { sort: sortDir, nulls: 'last' } }
        : { [sortField]: sortDir }
    ) as Prisma.PolizaOrderByWithRelationInput;

    const skip = (query.page - 1) * query.pageSize;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.poliza.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        include: {
          compania: { select: { id: true, nombre: true } },
          organismo: { select: { id: true, nombre: true } },
          ramo: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.poliza.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async detalle(id: string) {
    const poliza = await this.prisma.poliza.findUnique({
      where: { id },
      include: {
        compania: true,
        organismo: true,
        direccion: true,
        ramo: true,
        responsable: true,
        cuotas: { orderBy: { nroCuota: 'asc' } },
        seguimientos: { orderBy: { fecha: 'desc' } },
        cobranzaTracking: true,
      },
    });
    if (!poliza) throw new NotFoundException(`Póliza ${id} no encontrada`);
    return poliza;
  }

  async resumen() {
    const today = todayUTC();
    const in30 = addDays(today, 30);
    const in60 = addDays(today, 60);
    const in90 = addDays(today, 90);

    const [
      porEstadoRaw,
      porCompaniaRaw,
      venc30,
      venc60,
      venc90,
      sumDeuda,
      cantidadImpaga,
    ] = await Promise.all([
      this.prisma.poliza.groupBy({ by: ['estadoVigencia'], _count: { _all: true } }),
      this.prisma.poliza.groupBy({
        by: ['companiaId'],
        _count: { _all: true },
        orderBy: { _count: { companiaId: 'desc' } },
        take: 10,
      }),
      this.prisma.poliza.count({ where: { vigenciaFin: { gte: today, lte: in30 } } }),
      this.prisma.poliza.count({ where: { vigenciaFin: { gte: today, lte: in60 } } }),
      this.prisma.poliza.count({ where: { vigenciaFin: { gte: today, lte: in90 } } }),
      this.prisma.poliza.aggregate({ _sum: { deudaMonto: true } }),
      this.prisma.poliza.count({ where: { estadoPago: 'IMPAGA' } }),
    ]);

    const porEstadoVigencia: Record<EstadoVigencia, number> = {
      [EstadoVigencia.VIGENTE]: 0,
      [EstadoVigencia.A_VENCER]: 0,
      [EstadoVigencia.VENCIDO]: 0,
    };
    for (const row of porEstadoRaw) porEstadoVigencia[row.estadoVigencia] = row._count._all;

    const companias = await this.prisma.compania.findMany({
      where: { id: { in: porCompaniaRaw.map((c) => c.companiaId) } },
      select: { id: true, nombre: true },
    });
    const nombreById = new Map(companias.map((c) => [c.id, c.nombre]));
    const porCompania = porCompaniaRaw.map((c) => ({
      companiaId: c.companiaId,
      nombre: nombreById.get(c.companiaId) ?? '(desconocida)',
      count: c._count._all,
    }));

    return {
      porEstadoVigencia,
      porCompania,
      proximasAVencer: { en30: venc30, en60: venc60, en90: venc90 },
      deudaTotal: (sumDeuda._sum.deudaMonto ?? 0).toString(),
      cantidadImpaga,
    };
  }
}
