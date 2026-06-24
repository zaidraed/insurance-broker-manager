import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { CuotasImportService } from '../cuotas-import.service';
import { CuotasImportReport } from '../cuotas-import-report.types';

function printReport(report: CuotasImportReport): void {
  /* eslint-disable no-console */
  console.log('\n========== Reporte import "vencimientos" (cuotas) ==========');
  console.log(`Filas con póliza        : ${report.filas}`);
  console.log(`Cuotas creadas          : ${report.cuotasCreadas}`);
  console.log(`Cuotas actualizadas     : ${report.cuotasActualizadas}`);
  console.log(`Filas omitidas          : ${report.filasOmitidas} (sin nro cuota / sin vencimiento)`);
  console.log(`Pólizas no encontradas  : ${report.polizasNoEncontradas.count}`);
  if (report.polizasNoEncontradas.muestras.length > 0) {
    console.log(`   muestras: [${report.polizasNoEncontradas.muestras.join(', ')}]`);
  }
  console.log('Valores distintos de N (Pago):');
  for (const [valor, count] of Object.entries(report.valoresDistintosPago)) {
    console.log(`   ${JSON.stringify(valor)}: ${count}`);
  }
  console.log('===========================================================\n');
  /* eslint-enable no-console */
}

async function bootstrap(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error('Uso: npm run import:cuotas -- <ruta-al-xlsx>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(CuotasImportService);
    const report = await service.run(filePath);
    printReport(report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el import de cuotas:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
