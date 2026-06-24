import { ApiProperty } from '@nestjs/swagger';
import { RefDto } from '../../polizas/dto/poliza-response.dto';

export class RefacturacionItemDto {
  @ApiProperty()
  cuotaId!: string;

  @ApiProperty()
  nroCuota!: number;

  @ApiProperty({ type: RefDto, description: 'Póliza { id, nombre=numero }' })
  poliza!: { id: string; numero: string };

  @ApiProperty({ type: RefDto, nullable: true })
  organismo!: RefDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Decimal como string' })
  importe!: string | null;

  @ApiProperty()
  vencimiento!: Date;

  @ApiProperty({ description: 'Negativo si la cuota ya venció' })
  diasParaVencer!: number;
}

export class RefacturacionCountsDto {
  @ApiProperty()
  vencidasImpagas!: number;

  @ApiProperty()
  proximas30!: number;

  @ApiProperty()
  proximas60!: number;
}

export class RefacturacionResponseDto {
  @ApiProperty()
  dias!: number;

  @ApiProperty({ type: RefacturacionCountsDto })
  counts!: RefacturacionCountsDto;

  @ApiProperty({ type: [RefacturacionItemDto] })
  data!: RefacturacionItemDto[];
}
