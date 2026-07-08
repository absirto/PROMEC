import { Request, Response, NextFunction } from 'express';

export const responseWrapperMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  const oldJson = res.json.bind(res);
  
  res.json = function (this: Response, data: any) {
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
};
