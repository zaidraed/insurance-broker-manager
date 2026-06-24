import { ApiProperty } from '@nestjs/swagger';
import { CanalContacto, TipoSeguimiento } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

// Nota: el usuarioId no se acepta del body; se toma del usuario autenticado.
export class CreateSeguimientoDto {
  @ApiProperty({ enum: CanalContacto })
  @IsEnum(CanalContacto)
  canal!: CanalContacto;

  @ApiProperty({ enum: TipoSeguimiento })
  @IsEnum(TipoSeguimiento)
  tipo!: TipoSeguimiento;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  texto!: string;
}
