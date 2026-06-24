import { Module } from '@nestjs/common';
import { ImportModule } from '../import/import.module';
import { AdminController } from './admin.controller';
import { RecalculoService } from './recalculo.service';

@Module({
  imports: [ImportModule],
  controllers: [AdminController],
  providers: [RecalculoService],
})
export class AdminModule {}
