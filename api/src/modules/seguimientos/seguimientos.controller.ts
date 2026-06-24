import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';
import { SeguimientosService } from './seguimientos.service';

@ApiTags('Seguimientos')
@ApiBearerAuth()
@Controller('polizas/:id/seguimientos')
export class SeguimientosController {
  constructor(private readonly seguimientosService: SeguimientosService) {}

  @Post()
  @ApiOperation({ summary: 'Agrega un seguimiento a la póliza (append-only, atribuido al usuario del token)' })
  crear(@Param('id') id: string, @Body() dto: CreateSeguimientoDto, @CurrentUser() user: AuthUser) {
    return this.seguimientosService.crear(id, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los seguimientos de la póliza (desc por fecha)' })
  listar(@Param('id') id: string) {
    return this.seguimientosService.listar(id);
  }
}
