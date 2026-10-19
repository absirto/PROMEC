import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Papel } from '@prisma/client';
import { ErroApi } from '../comum/erros';
import { PAPEIS, PUBLICO, Sessao } from '../comum/sessao';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new ErroApi(401, 'NAO_AUTENTICADO', 'Você precisa entrar no ProMEC para continuar. Faça login e tente de novo.');
    }
    try {
      const p = await this.jwt.verifyAsync(token);
      req.sessao = { id: p.sub, tenantId: p.tenantId, papel: p.papel, nome: p.nome } satisfies Sessao;
    } catch {
      throw new ErroApi(401, 'SESSAO_EXPIRADA', 'Sua sessão expirou. Entre de novo para continuar de onde parou.');
    }

    const papeis = this.reflector.getAllAndOverride<Papel[]>(PAPEIS, alvos);
    if (papeis?.length && req.sessao.papel !== 'ADMIN' && !papeis.includes(req.sessao.papel)) {
      throw new ErroApi(403, 'SEM_PERMISSAO', 'Essa ação é reservada a gestores. Peça a um gestor da empresa para fazê-la ou para ajustar seu perfil.');
    }
    return true;
  }
}
