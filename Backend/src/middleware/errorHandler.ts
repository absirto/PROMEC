import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status || 500;
  const details = err.details || undefined;

  const rid = (req as Request & { requestId?: string }).requestId;
  logger.error('Erro: %s | Status: %d | Path: %s | RequestId: %s | Details: %o', err.message, status, req.path, rid || '-', details || '');

  // Em erros 500, nunca expõe a mensagem interna para o cliente (OWASP A09)
  const clientMessage = status >= 500
    ? 'Erro interno do servidor'
    : err.message || 'Erro interno do servidor';

  res.status(status).json({
    status: 'error',
    message: clientMessage,
    ...(details && status < 500 && { details }),
  });
}
