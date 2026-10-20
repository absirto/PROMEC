import { Controller, Get, Module, Query } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaInterceptor } from './auditoria.interceptor';

const ALIAS: Record<string, string> = { orcamentos: 'Orcamento', 'tabelas-custos': 'TabelaCustos', 'ordens-servico': 'OrdemServico', titulos: 'Titulo', usuarios: 'Usuario', perfis: 'Perfil' };

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Permissao('usuarios.visualizar', 'configuracoes.visualizar')
  @Get()
  async listar(
    @SessaoAtual() s: Sessao,
    @Query('entidade') entidade?: string,
    @Query('entidadeId') entidadeId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string
  ) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId: s.tenantId,
        ...(entidade ? { entidade: ALIAS[entidade] ?? entidade } : {}),
        ...(entidadeId ? { entidadeId } : {}),
        ...(usuarioId ? { usuarioId } : {}),
        ...(de || ate
          ? { data: { ...(de ? { gte: new Date(`${de.slice(0, 10)}T00:00:00-03:00`) } : {}), ...(ate ? { lt: new Date(new Date(`${ate.slice(0, 10)}T00:00:00-03:00`).getTime() + 86_400_000) } : {}) } }
          : {})
      },
      orderBy: { data: 'desc' },
      take: 500
    });
    const usuarios = await this.prisma.usuario.findMany({ where: { tenantId: s.tenantId, id: { in: logs.map((l) => l.usuarioId).filter(Boolean) as string[] } }, select: { id: true, nome: true } });
    const itens = logs.map((l) => ({
      id: l.id,
      data: l.data,
      usuario: usuarios.find((u) => u.id === l.usuarioId) ?? (l.usuarioId ? null : { id: null, nome: 'Portal do cliente / sistema' }),
      entidade: l.entidade,
      entidadeId: l.entidadeId,
      acao: l.acao,
      rota: l.rota,
      antes: l.antes,
      depois: l.depois
    }));
    return { itens, total: itens.length };
  }
}

@Module({ controllers: [AuditoriaController], providers: [{ provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor }] })
export class AuditoriaModule {}
