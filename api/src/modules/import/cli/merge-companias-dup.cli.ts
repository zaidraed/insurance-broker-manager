import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { CompaniasMergeService, MergeReport } from '../companias-merge.service';

function printReport(report: MergeReport): void {
  /* eslint-disable no-console */
  console.log('\n========== Merge de compañías duplicadas ==========');
  console.log(`Grupos colisionados     : ${report.totalGruposColisionados}`);
  console.log(`Duplicadas eliminadas   : ${report.totalDuplicadasEliminadas}`);
  for (const m of report.merges) {
    console.log(
      `\n  "${m.canonical}" <- [${m.duplicadas.join(', ')}]\n` +
        `     pólizas movidas: ${m.polizasMovidas} | colisiones eliminadas: ${m.colisionesEliminadas} | ` +
        `profiles: ${m.profilesMovidos} | mappings: ${m.mappingsMovidos}`,
    );
  }
  console.log('\n==================================================\n');
  /* eslint-enable no-console */
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const report = await app.get(CompaniasMergeService).run();
    printReport(report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error en el merge:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
