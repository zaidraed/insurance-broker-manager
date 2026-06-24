import { Module } from '@nestjs/common';
import { CuotasController } from './cuotas.controller';
import { CuotasService } from './cuotas.service';

@Module({
  controllers: [CuotasController],
  providers: [CuotasService],
})
export class CuotasModule {}
