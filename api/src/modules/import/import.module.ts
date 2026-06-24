import { Module } from '@nestjs/common';
import { BasededatosImportService } from './basededatos-import.service';
import { CompaniasMergeService } from './companias-merge.service';
import { CuotasImportService } from './cuotas-import.service';
import { DeudaImportService } from './deuda-import.service';
import { ImportAnalyzeService } from './import-analyze.service';
import { ImportController } from './import.controller';
import { ImportNormalizerService } from './import-normalizer.service';
import { PerfilImportService } from './perfil-import.service';
import { RamoBackfillService } from './ramo-backfill.service';

@Module({
  controllers: [ImportController],
  providers: [
    ImportNormalizerService,
    ImportAnalyzeService,
    BasededatosImportService,
    CompaniasMergeService,
    CuotasImportService,
    DeudaImportService,
    PerfilImportService,
    RamoBackfillService,
  ],
  exports: [
    ImportNormalizerService,
    BasededatosImportService,
    CompaniasMergeService,
    CuotasImportService,
    DeudaImportService,
    PerfilImportService,
    RamoBackfillService,
  ],
})
export class ImportModule {}
