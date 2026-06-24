import { Module } from '@nestjs/common';
import { SeguimientosController } from './seguimientos.controller';
import { SeguimientosService } from './seguimientos.service';

@Module({
  controllers: [SeguimientosController],
  providers: [SeguimientosService],
})
export class SeguimientosModule {}
