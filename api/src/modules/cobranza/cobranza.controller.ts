import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CobranzaService } from './cobranza.service';
import { UpdateCobranzaDto } from './dto/update-cobranza.dto';

@ApiTags('Cobranza')
@Controller()
export class CobranzaController {
  constructor(private readonly cobranzaService: CobranzaService) {}

  @Put('polizas/:id/cobranza')
  @ApiOperation({ summary: 'Upsert del tracking de cobranza de una póliza' })
  upsert(@Param('id') id: string, @Body() dto: UpdateCobranzaDto) {
    return this.cobranzaService.upsert(id, dto);
  }

  @Get('cobranza/revisar')
  @ApiOperation({ summary: 'Pólizas con revisar=true, ordenadas por más atrasado' })
  revisar() {
    return this.cobranzaService.listarParaRevisar();
  }
}
