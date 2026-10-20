import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, precoDaHora, reais, soma, txt } from '@promec/motor';
import { tt } from '../comum/decimal';
import { custoRealDa, incluirOs } from '../ordens/custo';
import { hojeLocal, dataBanco, somarDias } from '../planejamento/calendario';
import { saldosDosItens } from '../suprimentos/itens.service';
import { Sessao } from '../comum/sessao';
import { ABERTOS, expirarVencidos } from '../orcamentos/orcamentos.service';
import { OrdensService } from '../ordens/ordens.service';
import { ParametrosService } from '../parametros/parametros.service';
import { PlanejamentoService } from '../planejamento/planejamento.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { ManutencaoService } from '../manutencao/manutencao.service';
import { PrismaService } from '../prisma/prisma.service';
import { buscarVigente, resultadoDe } from '../tabelas-custos/entrada';

type Alerta = { tipo: 'perigo' | 'atencao' | 'info'; mensagem: string; link: string };

const saudacao = (agora = new Date()) => {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(agora)) % 24;
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
};

const inicioDoMes = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
    private readonly ordens: OrdensService,
    private readonly planejamento: PlanejamentoService,
    private readonly financeiro: FinanceiroService,
    private readonly manutencao: ManutencaoService
  ) {}

  private async suprimentos(tenantId: string) {
    const itens = await this.prisma.item.findMany({ where: { tenantId, ativo: true, tipo: { not: 'SERVICO_EXTERNO' } } });
    const saldos = await saldosDosItens(this.prisma, tenantId, itens.map((i) => i.id));
    const [pedidosAguardando, recebimentosAtrasados] = await Promise.all([
      this.prisma.pedido.count({ where: { tenantId, status: 'AGUARDANDO_APROVACAO' } }),
      this.prisma.pedido.count({ where: { tenantId, status: { in: ['APROVADO', 'PARCIAL'] }, previsaoEntrega: { lt: dataBanco(hojeLocal()) } } })
    ]);
    return {
      abaixoDoMinimo: itens.filter((i) => i.estoqueMinimo.gt(0) && saldos.get(i.id)!.disponivel.lt(tt(i.estoqueMinimo))).length,
      valorEstoque: reais(txt(soma(itens.map((i) => saldos.get(i.id)!.fisico.times(tt(i.custoMedio)))))),
      pedidosAguardando,
      recebimentosAtrasados
    };
  }

  private async qualidade(tenantId: string) {
    const [ncsAbertas, garantiasAbertas, ordens] = await Promise.all([
      this.prisma.naoConformidade.count({ where: { tenantId, status: { not: 'ENCERRADA' } } }),
      this.prisma.garantia.count({ where: { tenantId, status: 'EM_ANALISE' } }),
      this.prisma.ordemServico.findMany({ where: { tenantId, atualizadoEm: { gte: inicioDoMes() } }, include: incluirOs })
    ]);
    return {
      ncsAbertas,
      custoNaoQualidadeMes: reais(txt(soma(ordens.map((o) => dec(custoRealDa(o).custoNaoQualidade))))),
      garantiasAbertas
    };
  }

  private async rh(tenantId: string) {
    const hoje = dataBanco(hojeLocal());
    const [ausentes, vencendo] = await Promise.all([
      this.prisma.ausencia.findMany({ where: { tenantId, inicio: { lte: hoje }, fim: { gte: hoje } }, distinct: ['colaboradorId'], select: { colaboradorId: true } }),
      this.prisma.habilitacao.count({ where: { tenantId, validade: { gte: hoje, lte: dataBanco(somarDias(hojeLocal(), 30)) } } })
    ]);
    return {
      resumo: { ausentesHoje: ausentes.length, habilitacoesVencendo: vencendo },
      alertas: vencendo ? [{ tipo: 'atencao' as const, mensagem: `${vencendo} habilitação(ões) vencem nos próximos 30 dias. Agende as renovações.`, link: '/rh/habilitacoes?vencendo=30' }] : []
    };
  }

  async painel(s: Sessao) {
    const tenantId = s.tenantId;
    await expirarVencidos(this.prisma, tenantId);
    const financeiro = await this.financeiro.resumoPainel(tenantId);
    const [planejado, ordens, vigente, p, abertos, aprovadosMes, decididos, abaixo, defasados, rascunhos] = await Promise.all([
      this.planejamento.resumoPainel(tenantId),
      this.ordens.resumoPainel(tenantId),
      buscarVigente(this.prisma, tenantId),
      this.parametros.carregar(tenantId),
      this.prisma.orcamento.aggregate({ where: { tenantId, status: { in: ABERTOS } }, _count: { _all: true }, _sum: { precoFinalLote: true } }),
      this.prisma.orcamento.aggregate({
        where: { tenantId, status: { in: ['APROVADO', 'CONVERTIDO'] }, aprovadoEm: { gte: inicioDoMes() } },
        _count: { _all: true },
        _sum: { precoFinalLote: true }
      }),
      this.prisma.orcamento.groupBy({ by: ['status'], where: { tenantId, status: { in: ['APROVADO', 'CONVERTIDO', 'RECUSADO', 'EXPIRADO'] } }, _count: { _all: true } }),
      this.prisma.orcamento.count({ where: { tenantId, status: { in: ['RASCUNHO', 'EM_NEGOCIACAO'] }, exigeAprovacao: true, margemLiberada: false } }),
      this.prisma.tabelaCustos.findFirst({ where: { tenantId, status: 'VIGENTE' } }).then((v) =>
        v ? this.prisma.orcamento.count({ where: { tenantId, status: { in: ABERTOS }, tabelaCustosId: { not: v.id } } }) : 0
      ),
      this.prisma.tabelaCustos.findMany({ where: { tenantId, status: 'RASCUNHO' }, orderBy: { criadaEm: 'desc' }, take: 1 })
    ]);

    const valor = (d: Prisma.Decimal | null) => reais(d ? tt(d) : 0);
    const ganhos = decididos.filter((g) => g.status === 'APROVADO' || g.status === 'CONVERTIDO').reduce((a, g) => a + g._count._all, 0);
    const totalDecididos = decididos.reduce((a, g) => a + g._count._all, 0);

    const resultado = vigente ? resultadoDe(vigente) : null;
    const cheios = resultado?.centros.map((c) => dec(c.cheioHora)) ?? [];
    const precificacao = { impostos: tt(p.impostosPadrao), comissao: tt(p.comissaoPadrao), margem: tt(p.margemAlvo) };

    const alertas: Alerta[] = [];
    if (!vigente) {
      alertas.push({ tipo: 'perigo', mensagem: 'Ainda não há Tabela de Custos vigente. Publique uma para os orçamentos terem custo-hora.', link: '/tabelas-custos' });
    } else if (vigente.desatualizada) {
      alertas.push({
        tipo: 'atencao',
        mensagem: `A Tabela de Custos ${vigente.competencia} v${vigente.versao} ficou desatualizada: cadastros que alimentam o custo mudaram. Gere uma nova versão e publique.`,
        link: `/tabelas-custos/${vigente.id}`
      });
    }
    for (const b of resultado?.avisos ?? []) alertas.push({ tipo: 'atencao', mensagem: b.mensagem, link: b.centroId ? `/centros-trabalho/${b.centroId}` : '/centros-trabalho' });
    if (rascunhos[0]) {
      alertas.push({ tipo: 'info', mensagem: `Há um rascunho da Tabela de Custos ${rascunhos[0].competencia} esperando revisão e publicação.`, link: `/tabelas-custos/${rascunhos[0].id}` });
    }
    if (abaixo) {
      alertas.push({
        tipo: 'atencao',
        mensagem: `${abaixo === 1 ? '1 orçamento está' : `${abaixo} orçamentos estão`} com margem abaixo do mínimo e precisa${abaixo === 1 ? '' : 'm'} de liberação de um gestor.`,
        link: '/orcamentos?status=RASCUNHO'
      });
    }
    const [manutencao, rh] = await Promise.all([this.manutencao.resumoPainel(tenantId), this.rh(tenantId)]);
    alertas.push(...planejado.alertas, ...financeiro.alertas, ...manutencao.alertas, ...rh.alertas);
    const [suprimentos, qualidade, desatualizados] = await Promise.all([
      this.suprimentos(tenantId),
      this.qualidade(tenantId),
      this.prisma.orcamento.count({ where: { tenantId, status: 'RASCUNHO', custoDesatualizado: true } })
    ]);
    if (desatualizados) {
      alertas.push({
        tipo: 'atencao',
        mensagem: `${desatualizados === 1 ? '1 orçamento em rascunho usa' : `${desatualizados} orçamentos em rascunho usam`} material que mudou de preço no último recebimento. Revise o custo antes de enviar.`,
        link: '/orcamentos?status=RASCUNHO'
      });
    }
    if (suprimentos.recebimentosAtrasados) {
      alertas.push({ tipo: 'atencao', mensagem: `${suprimentos.recebimentosAtrasados} pedido(s) de compra passaram da data prevista de entrega. Cobre o fornecedor.`, link: '/compras/pedidos' });
    }
    if (ordens.atrasadas) {
      alertas.push({
        tipo: 'perigo',
        mensagem: `${ordens.atrasadas === 1 ? '1 OS está' : `${ordens.atrasadas} OS estão`} com o prazo vencido. Combine nova data com o cliente ou priorize na fila.`,
        link: '/ordens-servico?atrasadas=true'
      });
    }
    if (defasados) {
      alertas.push({
        tipo: 'info',
        mensagem: `${defasados === 1 ? '1 orçamento aberto usa' : `${defasados} orçamentos abertos usam`} uma Tabela de Custos anterior à vigente. Atualize os custos antes de fechar.`,
        link: '/orcamentos'
      });
    }

    return {
      saudacao: saudacao(),
      usuario: s.nome.split(' ')[0],
      tabelaVigente: vigente
        ? {
            id: vigente.id,
            competencia: vigente.competencia,
            versao: vigente.versao,
            desatualizada: vigente.desatualizada,
            cheioMedio: cheios.length ? reais(soma(cheios).div(cheios.length)) : '0.00'
          }
        : null,
      orcamentos: {
        abertos: abertos._count._all,
        valorAberto: valor(abertos._sum.precoFinalLote),
        aprovadosMes: aprovadosMes._count._all,
        valorAprovadoMes: valor(aprovadosMes._sum.precoFinalLote),
        taxaConversao: totalDecididos ? reais(txt(dec(ganhos).div(totalDecididos))) : '0.00',
        abaixoDoMinimo: abaixo
      },
      ordens,
      ocupacao: planejado.ocupacao,
      suprimentos,
      qualidade,
      financeiro: financeiro.resumo,
      manutencao: manutencao.resumo,
      rh: rh.resumo,
      centros: (resultado?.centros ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        cheioHora: reais(c.cheioHora),
        precoHora: reais(precoDaHora(c.cheioHora, precificacao))
      })),
      alertas
    };
  }
}
