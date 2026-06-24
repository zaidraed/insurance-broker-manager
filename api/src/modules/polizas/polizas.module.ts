import { Module } from '@nestjs/common';
import { PolizasController } from './polizas.controller';
import { PolizasService } from './polizas.service';

@Module({
  controllers: [PolizasController],
  providers: [PolizasService],
  exports: [PolizasService],
})
export class PolizasModule {}
