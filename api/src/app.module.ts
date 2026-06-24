import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ImportModule } from './modules/import/import.module';
import { PolizasModule } from './modules/polizas/polizas.module';
import { SeguimientosModule } from './modules/seguimientos/seguimientos.module';
import { CobranzaModule } from './modules/cobranza/cobranza.module';
import { CuotasModule } from './modules/cuotas/cuotas.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    PrismaModule,
    HealthModule,
    ImportModule,
    PolizasModule,
    SeguimientosModule,
    CobranzaModule,
    CuotasModule,
    CatalogosModule,
    UsuariosModule,
    AdminModule,
  ],
})
export class AppModule {}
