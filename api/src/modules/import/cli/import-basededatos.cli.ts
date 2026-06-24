import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { BasededatosImportService } from '../basededatos-import.service';
import { ImportReport } from '../import-report.types';

function printReport(report: ImportReport): void {
  const motivos = new Map<string, number>();
  for (const d of report.descartadas) {
    motivos.set(d.motivo, (motivos.get(d.motivo) ?? 0) + 1);
  }

  /* eslint-disable no-console */
  console.log('\n========== Reporte import "basededatos" ==========');
  console.log(`Total filas con datos : ${report.total}`);
  console.log(`Creadas               : ${report.creadas}`);
  console.log(`Actualizadas          : ${report.actualizadas}`);
  console.log(`Descartadas           : ${report.descartadas.length}`);
  for (const [motivo, count] of motivos) {
    console.log(`   - ${motivo}: ${count}`);
  }
  console.log(`Ramos no resueltos    : ${report.ramosNoResueltos.size}`);
  if (report.ramosNoResueltos.size > 0) {
    console.log(`   [${[...report.ramosNoResueltos].join(' | ')}]`);
  }
  console.log(`Compañías creadas     : ${report.companiasCreadas.size}`);
  if (report.companiasCreadas.size > 0) {
    console.log(`   [${[...report.companiasCreadas].join(' | ')}]`);
  }
  console.log('==================================================\n');
  /* eslint-enable no-console */
}

async function bootstrap(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error('Uso: npm run import:basededatos -- <ruta-al-xlsx>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(BasededatosImportService);
    const report = await service.run(filePath);
    printReport(report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el import:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
