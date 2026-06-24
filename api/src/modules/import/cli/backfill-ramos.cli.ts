import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { RamoBackfillService } from '../ramo-backfill.service';
import { BackfillRamosReport } from '../ramo-backfill.types';

function printReport(report: BackfillRamosReport): void {
  /* eslint-disable no-console */
  console.log('\n========== Backfill de ramos (basededatos) ==========');
  console.log(`Sin ramo antes   : ${report.sinRamoAntes}`);
  console.log(`Resueltas        : ${report.resueltas}`);
  console.log(`Siguen sin ramo  : ${report.siguenSinRamo}`);
  console.log(`Códigos no mapeados (${report.codigosNoMapeados.length}):`);
  for (const c of report.codigosNoMapeados.slice(0, 40)) {
    console.log(`   ${c.compania} | código=${c.codigo ?? '(sin código)'} -> ${c.count}`);
  }
  console.log('=====================================================\n');
  /* eslint-enable no-console */
}

async function bootstrap(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error('Uso: npm run backfill:ramos -- <ruta-al-xlsx>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(RamoBackfillService);
    const report = await service.run(filePath);
    printReport(report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el backfill:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
