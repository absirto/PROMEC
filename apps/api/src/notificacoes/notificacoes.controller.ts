import { Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { naoEncontrado } from '../comum/erros';
import { SemPermissao, Sessao, SessaoAtual } from '../comum/sessao';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('notificacoes')
@ApiBearerAuth()
@SemPermissao()
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@SessaoAtual() s: Sessao, @Query('naoLidas') naoLidas?: string) {
    const where = { tenantId: s.tenantId, usuarioId: s.id };
    const [ns, total] = await Promise.all([
      this.prisma.notificacao.findMany({ where: { ...where, ...(naoLidas === 'true' ? { lida: false } : {}) }, orderBy: { data: 'desc' }, take: 100 }),
      this.prisma.notificacao.count({ where: { ...where, lida: false } })
    ]);
    return { itens: ns.map((n) => ({ id: n.id, tipo: n.tipo, titulo: n.titulo, mensagem: n.mensagem, link: n.link, lida: n.lida, data: n.data })), naoLidas: total };
  }

  @Post('ler-todas')
  @HttpCode(200)
  async lerTodas(@SessaoAtual() s: Sessao) {
    await this.prisma.notificacao.updateMany({ where: { tenantId: s.tenantId, usuarioId: s.id, lida: false }, data: { lida: true } });
    return { naoLidas: 0 };
  }

  @Post(':id/ler')
  @HttpCode(200)
  async ler(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    const n = await this.prisma.notificacao.findFirst({ where: { id, tenantId: s.tenantId, usuarioId: s.id } });
    if (!n) throw naoEncontrado('essa notificação');
    await this.prisma.notificacao.update({ where: { id }, data: { lida: true } });
    return { id, lida: true, naoLidas: await this.prisma.notificacao.count({ where: { tenantId: s.tenantId, usuarioId: s.id, lida: false } }) };
  }
}

@Module({ controllers: [NotificacoesController] })
export class NotificacoesModule {}
