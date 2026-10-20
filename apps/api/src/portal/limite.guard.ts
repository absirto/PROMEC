import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErroApi } from '../comum/erros';

const JANELA = 60_000;
const acessos = new Map<string, number[]>();

export const limparLimitePortal = () => acessos.clear();

/** 30 requisições por minuto por IP nas rotas públicas do portal. */
@Injectable()
export class LimitePortalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? 'desconhecido');
    const limite = Number(process.env.PORTAL_LIMITE_MINUTO ?? 30);
    const agora = Date.now();
    const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < JANELA);
    if (recentes.length >= limite) {
      throw new ErroApi(429, 'MUITAS_TENTATIVAS', 'Recebemos muitas solicitações deste endereço em pouco tempo. Aguarde um minuto e tente de novo.');
    }
    recentes.push(agora);
    acessos.set(ip, recentes);
    return true;
  }
}
