import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { PerfilImportService } from '../perfil-import.service';
import { PerfilImportReport } from '../perfil-import-report.types';

function printReport(report: PerfilImportReport): void {
  /* eslint-disable no-console */
  console.log('\n========== Reporte import por perfil ==========');
  console.log(`Perfil                  : ${report.perfil} (${report.compania})`);
  console.log(`Header detectado en fila: ${report.filaHeader}`);
  console.log(`Filas leídas            : ${report.filasLeidas}`);
  console.log(`Creadas                 : ${report.creadas}`);
  console.log(`Actualizadas            : ${report.actualizadas}`);
  console.log(`Ramos no resueltos      : ${report.ramosNoResueltos.size}`);
  if (report.ramosNoResueltos.size > 0) {
    console.log(`   códigos: [${[...report.ramosNoResueltos].join(', ')}]`);
  }
  console.log(`Organismos nuevos       : ${report.organismosNuevos.size}`);
  if (report.organismosNuevos.size > 0) {
    for (const o of report.organismosNuevos) console.log(`   + ${o}`);
  }
  console.log('===============================================\n');
  /* eslint-enable no-console */
}

async function bootstrap(): Promise<void> {
  const identificador = process.argv[2];
  const filePath = process.argv[3];
  if (!identificador || !filePath) {
    // eslint-disable-next-line no-console
    console.error('Uso: npm run import:perfil -- <identificador> <ruta-al-xlsx>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(PerfilImportService);
    const report = await service.run({ identificador }, filePath);
    printReport(report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el import por perfil:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
