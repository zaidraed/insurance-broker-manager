import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RefacturacionQueryDto {
  @ApiPropertyOptional({
    default: 30,
    minimum: 0,
    maximum: 365,
    description: 'Horizonte en días: incluye cuotas impagas con vencimiento <= hoy + dias (y las ya vencidas)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dias = 30;
}
