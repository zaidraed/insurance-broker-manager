import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaService } from './prisma/prisma.service';
import type { Env } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Normalización global de errores
  app.useGlobalFilters(new AllExceptionsFilter());

  // Shutdown ordenado de Prisma
  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);
  app.enableShutdownHooks();

  // Swagger en /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Broker Seguros API')
    .setDescription('API para gestión de pólizas de seguros')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const configService = app.get(ConfigService<Env, true>);
  const port = configService.get('PORT', { infer: true });

  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🚀 Broker Seguros API escuchando en http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`📚 Swagger disponible en http://localhost:${port}/docs`);
}

void bootstrap();
