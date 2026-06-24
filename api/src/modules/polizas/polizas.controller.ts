import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListPolizasQueryDto } from './dto/list-polizas-query.dto';
import { PaginatedPolizasDto, ResumenDto } from './dto/poliza-response.dto';
import { PolizasService } from './polizas.service';

@ApiTags('Pólizas')
@Controller('polizas')
export class PolizasController {
  constructor(private readonly polizasService: PolizasService) {}

  @Get()
  @ApiOperation({ summary: 'Listado paginado de pólizas con filtros' })
  @ApiOkResponse({ type: PaginatedPolizasDto })
  list(@Query() query: ListPolizasQueryDto) {
    return this.polizasService.list(query);
  }

  // Debe ir antes de :id para no ser capturado por la ruta paramétrica.
  @Get('resumen')
  @ApiOperation({ summary: 'Métricas agregadas para dashboard' })
  @ApiOkResponse({ type: ResumenDto })
  resumen() {
    return this.polizasService.resumen();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una póliza con sus relaciones' })
  detalle(@Param('id') id: string) {
    return this.polizasService.detalle(id);
  }
}
