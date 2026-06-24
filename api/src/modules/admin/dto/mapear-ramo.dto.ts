import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class MapearRamoDto {
  @ApiPropertyOptional({ description: 'Si se omite, el mapeo aplica a cualquier compañía' })
  @IsOptional()
  @IsString()
  companiaId?: string;

  @ApiProperty({ description: 'Código crudo de ramo (col C) a mapear' })
  @IsString()
  @IsNotEmpty()
  codigoOrigen!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ramoId!: string;
}
