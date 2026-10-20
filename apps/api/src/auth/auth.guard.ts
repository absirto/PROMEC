import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { garantirPerfis, papelDoPerfil, temPermissao } from '../acesso/permissoes';
import { ErroApi } from '../comum/erros';
import { MODULO, PERMISSAO, PUBLICO, SEM_PERMISSAO, Sessao } from '../comum/sessao';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new ErroApi(401, 'NAO_AUTENTICADO', 'Você precisa entrar no ProMEC para continuar. Faça login e tente de novo.');
    }
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync(token)).sub;
    } catch {
      throw new ErroApi(401, 'SESSAO_EXPIRADA', 'Sua sessão expirou. Entre de novo para continuar de onde parou.');
    }
    let u = await this.prisma.usuario.findUnique({ where: { id: sub }, include: { perfil: true } });
    if (u && !u.perfil) {
      await garantirPerfis(this.prisma, u.tenantId);
      u = await this.prisma.usuario.findUnique({ where: { id: sub }, include: { perfil: true } });
    }
    if (!u || !u.ativo || !u.perfil) {
      throw new ErroApi(401, 'SESSAO_EXPIRADA', 'Seu acesso foi desativado ou a sessão expirou. Fale com o administrador da empresa.');
    }
    const sessao: Sessao = { id: u.id, tenantId: u.tenantId, nome: u.nome, papel: papelDoPerfil(u.perfil), permissoes: u.perfil.permissoes };
    req.sessao = sessao;

    if (this.reflector.getAllAndOverride<boolean>(SEM_PERMISSAO, alvos)) return true;
    const explicitas = this.reflector.getAllAndOverride<string[]>(PERMISSAO, alvos);
    const modulos = this.reflector.getAllAndOverride<string[]>(MODULO, alvos);
    const acao = req.method === 'GET' ? 'visualizar' : 'gerenciar';
    const exigidas = explicitas?.length ? explicitas : (modulos ?? []).map((m) => `${m}.${acao}`);
    if (exigidas.length && !exigidas.some((p) => temPermissao(sessao.permissoes, p))) {
      throw new ErroApi(403, 'SEM_PERMISSAO', 'Seu perfil não permite essa ação. Peça a um gestor ou ao administrador para fazê-la ou ajustar seu perfil.', {
        permissao: exigidas[0]
      });
    }
    return true;
  }
}
