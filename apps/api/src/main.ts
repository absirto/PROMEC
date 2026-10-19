import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configurar } from './configurar';

async function iniciar() {
  const app = configurar(await NestFactory.create(AppModule));
  const doc = new DocumentBuilder()
    .setTitle('ProMEC API')
    .setDescription('ERP para oficinas, usinagem e caldeiraria com motor de custo-hora. Contrato em docs/API.md.')
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  const porta = Number(process.env.PORT ?? 3333);
  await app.listen(porta);
  Logger.log(`API em http://localhost:${porta}/api/v1 · documentação em /api/docs`, 'ProMEC');
}

iniciar();
