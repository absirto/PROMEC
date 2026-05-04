import { createClient } from 'redis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
  if (process.env.NODE_ENV === 'test') return;
  logger.warn('Redis: %s', err.message);
});

export async function connectRedis() {
  if (redisClient.isOpen) return;
  try {
    await redisClient.connect();
  } catch (err: any) {
    if (process.env.NODE_ENV === 'test') return;
    logger.warn('Redis indisponível (API continua sem cache/filas locais): %s', err?.message || err);
  }
}
