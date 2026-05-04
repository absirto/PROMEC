import app from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, encerrando servidor...');
  server.close(() => {
    logger.info('Servidor finalizado com sucesso.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Recebido SIGINT, encerrando servidor...');
  server.close(() => {
    logger.info('Servidor finalizado com sucesso.');
    process.exit(0);
  });
});
