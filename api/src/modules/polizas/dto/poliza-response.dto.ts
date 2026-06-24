import { ApiProperty } from '@nestjs/swagger';
import { EstadoPago, EstadoVigencia } from '@prisma/client';

export class RefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;
}

export class PolizaListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  numero!: string;

  @ApiProperty({ enum: EstadoVigencia })
  estadoVigencia!: EstadoVigencia;

  @ApiProperty({ enum: EstadoPago })
  estadoPago!: EstadoPago;

  @ApiProperty({ nullable: true })
  tomador!: string | null;

  @ApiProperty({ nullable: true })
  bienAsegurado!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Decimal serializado como string' })
  importe!: string | null;

  @ApiProperty({ nullable: true })
  vigenciaInicio!: Date | null;

  @ApiProperty({ nullable: true })
  vigenciaFin!: Date | null;

  @ApiProperty({ type: RefDto })
  compania!: RefDto;

  @ApiProperty({ type: RefDto, nullable: true })
  organismo!: RefDto | null;

  @ApiProperty({ type: RefDto, nullable: true })
  ramo!: RefDto | null;
}

export class PaginatedPolizasDto {
  @ApiProperty({ type: [PolizaListItemDto] })
  data!: PolizaListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class CompaniaCountDto {
  @ApiProperty()
  companiaId!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  count!: number;
}

export class ProximasAVencerDto {
  @ApiProperty()
  en30!: number;

  @ApiProperty()
  en60!: number;

  @ApiProperty()
  en90!: number;
}

export class ResumenDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  porEstadoVigencia!: Record<EstadoVigencia, number>;

  @ApiProperty({ type: [CompaniaCountDto] })
  porCompania!: CompaniaCountDto[];

  @ApiProperty({ type: ProximasAVencerDto })
  proximasAVencer!: ProximasAVencerDto;

  @ApiProperty({ type: String, description: 'Suma de deudaMonto (fuente solapa DEUDA), Decimal como string' })
  deudaTotal!: string;

  @ApiProperty({ description: 'Cantidad de pólizas con estadoPago = IMPAGA' })
  cantidadImpaga!: number;
}
