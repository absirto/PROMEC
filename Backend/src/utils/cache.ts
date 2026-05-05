import { redisClient } from '../utils/redis';

function isRedisReady() {
  return redisClient.isOpen && redisClient.isReady;
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60) {
  if (!isRedisReady()) return;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    // Silently fail cache
  }
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (!isRedisReady()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

export async function cacheDel(key: string) {
  if (!isRedisReady()) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    // Silently fail cache
  }
}
