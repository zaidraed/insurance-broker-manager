import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RamoBackfillService } from '../import/ramo-backfill.service';
import { MapearRamoDto } from './dto/mapear-ramo.dto';
import { RecalculoService } from './recalculo.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly recalculoService: RecalculoService,
    private readonly ramoBackfill: RamoBackfillService,
  ) {}

  @Post('recalcular')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dispara manualmente el recálculo de estadoVigencia y revisar' })
  recalcular() {
    return this.recalculoService.recalcularTodo();
  }

  @Get('ramos/no-mapeados')
  @ApiOperation({ summary: 'Pólizas sin ramo agrupadas por (compañía, código de origen)' })
  ramosNoMapeados() {
    return this.ramoBackfill.noMapeados();
  }

  @Post('ramos/mapear')
  @HttpCode(200)
  @ApiOperation({ summary: 'Crea un RamoMapping y backfillea las pólizas afectadas' })
  mapearRamo(@Body() dto: MapearRamoDto) {
    return this.ramoBackfill.mapear(dto);
  }
}
