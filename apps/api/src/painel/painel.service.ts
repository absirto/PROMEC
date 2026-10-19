import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, precoDaHora, reais, soma, txt } from '@promec/motor';
import { tt } from '../comum/decimal';
import { Sessao } from '../comum/sessao';
import { ABERTOS, expirarVencidos } from '../orcamentos/orcamentos.service';
import { ParametrosService } from '../parametros/parametros.service';
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
    private readonly parametros: ParametrosService
  ) {}

  async painel(s: Sessao) {
    const tenantId = s.tenantId;
    await expirarVencidos(this.prisma, tenantId);
    const [vigente, p, abertos, aprovadosMes, decididos, abaixo, defasados, rascunhos] = await Promise.all([
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
