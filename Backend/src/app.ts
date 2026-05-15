


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { connectRedis, redisClient } from './utils/redis';
import { setupSwagger, swaggerSpec } from './utils/swagger';
import { setupSentry } from './utils/sentry';
import { requestIdMiddleware } from './middleware/requestId';
import prisma from './core/prisma';
import { logger } from './utils/logger';
import { sanitizeBody } from './middleware/sanitizeBody';

dotenv.config();
if (process.env.NODE_ENV !== 'test') {
  setupSentry();
  void connectRedis();
}


const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}


app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];
app.use(cors({
  origin: (origin, callback) => {
    // Permite chamadas sem origin (ex: apps mobile, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(sanitizeBody);
app.use(requestIdMiddleware);
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Log de requisições HTTP
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/ready', async (_req, res) => {
  let dbOk = false;
  let redisOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  try {
    if (redisClient.isOpen) {
      await redisClient.ping();
      redisOk = true;
    }
  } catch {
    redisOk = false;
  }
  if (!dbOk) {
    return res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
  res.json({ ok: true, database: true, redis: redisOk });
});

if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generalQueue } = require('./core/queue') as { generalQueue: { add: unknown } | null };
  if (generalQueue) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpressAdapter } = require('@bull-board/express');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createBullBoard } = require('@bull-board/api');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BullAdapter } = require('@bull-board/api/bullAdapter');
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({ queues: [new BullAdapter(generalQueue)], serverAdapter });
    
    // Importar middlewares de segurança
    const { authenticateToken, requireRole } = require('./middleware/auth');
    app.use('/admin/queues', authenticateToken, requireRole('admin'), serverAdapter.getRouter());
  }
}

app.get('/openapi.json', (_req, res) => {
  res.type('application/json').send(JSON.stringify(swaggerSpec));
});

app.use((_req, res, next) => {
  const oldJson = res.json.bind(res);
  res.json = function (this: express.Response, data: any) {
    // Se for erro (>= 400), não envelopa
    if (this.statusCode >= 400) {
      return oldJson(data);
    }
    
    // Se já estiver envelopado ou for nulo/vazio, não envelopa novamente
    if (data && typeof data === 'object' && (data.status === 'success' || data.status === 'error')) {
      return oldJson(data);
    }

    // Se for um objeto com 'data' (ex: vindo do formatPaginatedResponse), envelopa mas mantém o topo
    if (data && typeof data === 'object' && data.data && data.meta) {
       return oldJson({ status: 'success', ...data });
    }

    return oldJson({ status: 'success', data });
  };
  next();
});

setupSwagger(app);

import v1Routes from './v1';
app.use('/v1', v1Routes);

import { errorHandler } from './middleware/errorHandler';
app.get('/', (_req, res) => res.json({ status: 'API Online' }));
app.use(errorHandler);

export default app;
