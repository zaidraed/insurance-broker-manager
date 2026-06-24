import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { DeudaImportService } from '../deuda-import.service';
import { DeudaImportReport } from '../deuda-import.types';

function printReport(report: DeudaImportReport): void {
  /* eslint-disable no-console */
  console.log('\n========== Reporte import "DEUDA" ==========');
  console.log(`Filas con póliza       : ${report.filas}`);
  console.log(`Pólizas con deuda      : ${report.polizasConDeuda}`);
  console.log(`Marcadas IMPAGA        : ${report.marcadasImpaga}`);
  console.log(`No encontradas         : ${report.noEncontradas.count}`);
  if (report.noEncontradas.muestras.length > 0) {
    console.log(`   muestras: [${report.noEncontradas.muestras.join(', ')}]`);
  }
  console.log(`Deuda total aplicada   : ${report.deudaTotal}`);
  console.log('===========================================\n');
  /* eslint-enable no-console */
}

async function bootstrap(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    // eslint-disable-next-line no-console
    console.error('Uso: npm run import:deuda -- <ruta-al-xlsx>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(DeudaImportService);
    const report = await service.run(filePath);
    printReport(report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el import de deuda:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
