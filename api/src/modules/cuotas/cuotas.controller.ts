import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CuotasService } from './cuotas.service';
import { RefacturacionQueryDto } from './dto/refacturacion-query.dto';
import { RefacturacionResponseDto } from './dto/refacturacion-response.dto';

@ApiTags('Refacturación')
@Controller('refacturacion')
export class CuotasController {
  constructor(private readonly cuotasService: CuotasService) {}

  @Get()
  @ApiOperation({ summary: 'Semáforo de refacturación: cuotas impagas por vencer/vencidas' })
  @ApiOkResponse({ type: RefacturacionResponseDto })
  refacturacion(@Query() query: RefacturacionQueryDto) {
    return this.cuotasService.refacturacion(query.dias);
  }
}
