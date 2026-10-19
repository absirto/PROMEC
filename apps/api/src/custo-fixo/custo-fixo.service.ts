import { Injectable } from '@nestjs/common';
import { LancamentoCustoFixo } from '@prisma/client';
import { pd, pdOpc, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado, regra } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { marcarDesatualizada } from '../tabelas-custos/entrada';
import { AtualizarLancamentoDto, CopiarDto, CriarLancamentoDto } from './custo-fixo.dto';

const lancamento = (l: LancamentoCustoFixo) => ({ id: l.id, competencia: l.competencia, categoria: l.categoria, descricao: l.descricao, valor: tt(l.valor) });

@Injectable()
export class CustoFixoService {
  constructor(private readonly prisma: PrismaService) {}

  async competencias(tenantId: string) {
    const grupos = await this.prisma.lancamentoCustoFixo.groupBy({
      by: ['competencia'],
      where: { tenantId },
      _sum: { valor: true },
      _count: { _all: true },
      orderBy: { competencia: 'desc' }
    });
    return grupos.map((g) => ({ competencia: g.competencia, total: g._sum.valor ? tt(g._sum.valor) : '0', lancamentos: g._count._all }));
  }

  async daCompetencia(tenantId: string, competencia: string) {
    const itens = await this.prisma.lancamentoCustoFixo.findMany({ where: { tenantId, competencia }, orderBy: [{ categoria: 'asc' }, { criadoEm: 'asc' }] });
    const total = itens.reduce((acc, l) => acc.plus(l.valor), pd(0));
    return { competencia, total: tt(total), lancamentos: itens.map(lancamento) };
  }

  async criar(tenantId: string, dto: CriarLancamentoDto) {
    const l = await this.prisma.$transaction(async (tx) => {
      const l = await tx.lancamentoCustoFixo.create({
        data: { tenantId, competencia: dto.competencia, categoria: dto.categoria, descricao: dto.descricao ?? '', valor: pd(dto.valor) }
      });
      await marcarDesatualizada(tx, tenantId, dto.competencia);
      return l;
    });
    return lancamento(l);
  }

  async atualizar(tenantId: string, id: string, dto: AtualizarLancamentoDto) {
    const atual = await this.buscar(tenantId, id);
    const l = await this.prisma.$transaction(async (tx) => {
      const l = await tx.lancamentoCustoFixo.update({
        where: { id },
        data: { competencia: dto.competencia, categoria: dto.categoria, descricao: dto.descricao, valor: pdOpc(dto.valor) }
      });
      await marcarDesatualizada(tx, tenantId, atual.competencia);
      if (l.competencia !== atual.competencia) await marcarDesatualizada(tx, tenantId, l.competencia);
      return l;
    });
    return lancamento(l);
  }

  async remover(tenantId: string, id: string) {
    const atual = await this.buscar(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.lancamentoCustoFixo.delete({ where: { id } }),
      this.prisma.tabelaCustos.updateMany({ where: { tenantId, status: 'VIGENTE', competencia: atual.competencia }, data: { desatualizada: true } })
    ]);
    return { id, removido: true };
  }

  async copiar(tenantId: string, { de, para }: CopiarDto) {
    if (de === para) throw invalido('Escolha competências diferentes para copiar os lançamentos.');
    const [origem, jaTem] = await Promise.all([
      this.prisma.lancamentoCustoFixo.findMany({ where: { tenantId, competencia: de } }),
      this.prisma.lancamentoCustoFixo.count({ where: { tenantId, competencia: para } })
    ]);
    if (!origem.length) throw regra('COMPETENCIA_VAZIA', `${de} não tem lançamentos para copiar. Escolha outra competência de origem.`);
    if (jaTem) {
      throw conflito('COMPETENCIA_COM_LANCAMENTOS', `${para} já tem ${jaTem} lançamento(s). Para não duplicar valores, ajuste os existentes ou remova-os antes de copiar.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.lancamentoCustoFixo.createMany({
        data: origem.map((l) => ({ tenantId, competencia: para, categoria: l.categoria, descricao: l.descricao, valor: l.valor }))
      });
      await marcarDesatualizada(tx, tenantId, para);
    });
    return this.daCompetencia(tenantId, para);
  }

  private async buscar(tenantId: string, id: string) {
    const l = await this.prisma.lancamentoCustoFixo.findFirst({ where: { id, tenantId } });
    if (!l) throw naoEncontrado('esse lançamento de custo fixo');
    return l;
  }
}
