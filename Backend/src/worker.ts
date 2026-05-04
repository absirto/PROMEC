import { generalQueue } from './services/queue';
import { logger } from './utils/logger';

if (!generalQueue) {
  logger.error('Worker requer Bull/Redis (defina NODE_ENV=production ou development).');
  process.exit(1);
}

logger.info('Worker Bull iniciado. Processando jobs...');

// O processamento já está definido em services/queue.ts
// Este arquivo serve para rodar o worker isoladamente

process.on('SIGTERM', () => {
  logger.info('Worker finalizando...');
  process.exit(0);
});
