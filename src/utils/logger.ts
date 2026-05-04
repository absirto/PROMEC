import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'promec-backend' },
  transports: [
    new transports.Console(),
    // Adicione outros transports como arquivo se desejar
  ],
});
