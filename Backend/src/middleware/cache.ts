import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../utils/redis';

export function cacheMiddleware(keyPrefix: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyPrefix + (req.params.id || 'all');
    const cached = await redisClient.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    // Intercepta o res.json para salvar no cache
    const oldJson = res.json.bind(res);
    res.json = (data) => {
      redisClient.setEx(key, 60, JSON.stringify(data)); // cache por 60s
      return oldJson(data);
    };
    next();
  };
}
