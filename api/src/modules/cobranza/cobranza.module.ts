import { Module } from '@nestjs/common';
import { CobranzaController } from './cobranza.controller';
import { CobranzaService } from './cobranza.service';

@Module({
  controllers: [CobranzaController],
  providers: [CobranzaService],
})
export class CobranzaModule {}
