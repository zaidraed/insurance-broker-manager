import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RefDto } from '../polizas/dto/poliza-response.dto';
import { CatalogosService } from './catalogos.service';

@ApiTags('Catálogos')
@Controller()
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('companias')
  @ApiOperation({ summary: 'Lista de compañías (id, nombre) para dropdowns' })
  @ApiOkResponse({ type: [RefDto] })
  companias() {
    return this.catalogosService.companias();
  }

  @Get('ramos')
  @ApiOperation({ summary: 'Lista de ramos (id, nombre) para dropdowns' })
  @ApiOkResponse({ type: [RefDto] })
  ramos() {
    return this.catalogosService.ramos();
  }
}
