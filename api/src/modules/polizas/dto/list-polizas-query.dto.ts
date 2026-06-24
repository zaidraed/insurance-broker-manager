import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPago, EstadoVigencia } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Normaliza CSV o valores repetidos a un array de strings limpio. */
function toStringArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  const arr = Array.isArray(value) ? value : [value];
  const out = arr
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return out.length > 0 ? out : undefined;
}

export class ListPolizasQueryDto {
  @ApiPropertyOptional({
    enum: EstadoVigencia,
    isArray: true,
    description: 'Uno o varios estados (CSV "VIGENTE,A_VENCER" o param repetido) -> filtro IN',
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsEnum(EstadoVigencia, { each: true })
  estadoVigencia?: EstadoVigencia[];

  @ApiPropertyOptional({
    enum: EstadoPago,
    isArray: true,
    description: 'Uno o varios estados de pago (CSV o param repetido) -> filtro IN',
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsEnum(EstadoPago, { each: true })
  estadoPago?: EstadoPago[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companiaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organismoId?: string;

  @ApiPropertyOptional({ description: 'Filtra organismo.nombre contains (case-insensitive)' })
  @IsOptional()
  @IsString()
  organismoSearch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ramoId?: string;

  @ApiPropertyOptional({ description: 'ISO date; filtra vigenciaFin >= venceDesde' })
  @IsOptional()
  @IsISO8601()
  venceDesde?: string;

  @ApiPropertyOptional({ description: 'ISO date; filtra vigenciaFin <= venceHasta' })
  @IsOptional()
  @IsISO8601()
  venceHasta?: string;

  @ApiPropertyOptional({ description: 'Busca en numero / tomador / bienAsegurado (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 50;

  @ApiPropertyOptional({
    default: 'vigenciaFin:asc',
    description: 'campo:dir — campo en {vigenciaFin,vigenciaInicio,numero,importe,deudaMonto,estadoVigencia,createdAt,updatedAt}',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z]+:(asc|desc)$/, { message: 'sort debe tener formato campo:asc|desc' })
  sort = 'vigenciaFin:asc';
}
