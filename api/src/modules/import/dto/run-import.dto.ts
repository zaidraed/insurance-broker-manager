import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Mapping de columnas que arma el front (campos canónicos -> letra de columna).
 * Cubre ambos tipos de import; los requeridos dependen del tipo y se validan en
 * el controller (POLIZAS: poliza/tomador/inicio · DEUDA: poliza/compania/importe).
 */
export class ImportMappingDto {
  @ApiPropertyOptional({ description: 'Palabra clave del header (alternativa a headerRow)' })
  @IsOptional()
  @IsString()
  palabraClaveFila?: string;

  @ApiPropertyOptional({ description: 'Fila (1-based) del header (alternativa a palabraClaveFila)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  headerRow?: number;

  @ApiPropertyOptional({ description: 'Solapa que acota headerRow (default: primera)' })
  @IsOptional()
  @IsString()
  sheet?: string;

  // Comunes / POLIZAS
  @ApiPropertyOptional({ description: 'Columna del número de póliza, ej "B"' })
  @IsOptional() @IsString() colPoliza?: string;
  @ApiPropertyOptional({ description: 'Columna del tomador/asegurado (POLIZAS)' })
  @IsOptional() @IsString() colTomador?: string;
  @ApiPropertyOptional({ description: 'Columna de inicio de vigencia (POLIZAS)' })
  @IsOptional() @IsString() colInicio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colRamo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colFin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colObs?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colBien?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colFechaFacturado?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colMedioPago?: string;

  // DEUDA
  @ApiPropertyOptional({ description: 'Columna de compañía/empresa (DEUDA)' })
  @IsOptional() @IsString() colCompania?: string;
  @ApiPropertyOptional({ description: 'Columna del importe de deuda (DEUDA)' })
  @IsOptional() @IsString() colImporte?: string;
  @ApiPropertyOptional({ description: 'Segunda columna de observaciones (DEUDA, opcional)' })
  @IsOptional() @IsString() colObs2?: string;
}

/**
 * En multipart `mapping` llega como string JSON. Lo parseamos y lo convertimos
 * a una instancia de ImportMappingDto: @ValidateNested necesita una instancia
 * real (con un objeto plano tira "unknownValue" y se pierden campos).
 */
function parseMapping(value: unknown): unknown {
  let obj: unknown = value;
  if (typeof value === 'string') {
    try {
      obj = JSON.parse(value);
    } catch {
      return value; // deja que falle @IsObject con un mensaje claro
    }
  }
  if (obj && typeof obj === 'object') return plainToInstance(ImportMappingDto, obj);
  return obj;
}

export class RunImportDto {
  @ApiPropertyOptional({ description: 'Id de la compañía destino (requerido en POLIZAS)' })
  @IsOptional()
  @IsString()
  companiaId?: string;

  @ApiProperty({
    type: ImportMappingDto,
    description: 'Mapping de columnas (objeto JSON; en multipart, string JSON)',
  })
  @Transform(({ value }) => parseMapping(value))
  @IsObject()
  @ValidateNested()
  @Type(() => ImportMappingDto)
  mapping!: ImportMappingDto;

  @ApiPropertyOptional({ description: 'Si true, guarda/actualiza el perfil reusable de la compañía' })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsOptional()
  @IsBoolean()
  guardarProfile?: boolean;
}
