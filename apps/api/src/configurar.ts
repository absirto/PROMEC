import { INestApplication } from '@nestjs/common';
import { FiltroExcecoes } from './comum/filtro-excecoes';
import { pipeValidacao } from './comum/validacao';

export function configurar(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5273').split(','), credentials: true });
  app.useGlobalPipes(pipeValidacao());
  app.useGlobalFilters(new FiltroExcecoes());
  return app;
}
