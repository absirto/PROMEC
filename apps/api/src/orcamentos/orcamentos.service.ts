import { Injectable } from '@nestjs/common';
import { Orcamento, Prisma, StatusOrcamento } from '@prisma/client';
import type { MetodoPreco } from '@promec/motor';
import { dataIso, hoje, pct, tt } from '../comum/decimal';
import { conflito, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { ParametrosService } from '../parametros/parametros.service';
import { PrismaService } from '../prisma/prisma.service';
import { buscarVigente, Db, json, resultadoDe } from '../tabelas-custos/entrada';
import { semVigente } from '../tabelas-custos/tabelas.service';
import { promessaDoOrcamento } from '../planejamento/entrada';
import { calcular, colunasDePrecificacao, colunasDoResultado, LinhaEntrada, Precificacao } from './calculo';
import { proximoNumero } from './numeracao';
import { OrcamentoDto, SimularDto } from './orcamentos.dto';

export const STATUS_ORCAMENTO: StatusOrcamento[] = ['RASCUNHO', 'ENVIADO', 'EM_NEGOCIACAO', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'CONVERTIDO'];
export const ABERTOS: StatusOrcamento[] = ['RASCUNHO', 'ENVIADO', 'EM_NEGOCIACAO'];

const ROTULO: Record<StatusOrcamento, string> = {
  RASCUNHO: 'em rascunho',
  ENVIADO: 'enviado ao cliente',
  EM_NEGOCIACAO: 'em negociação',
  APROVADO: 'aprovado',
  RECUSADO: 'recusado',
  EXPIRADO: 'expirado',
  CONVERTIDO: 'convertido em OS'
};

const incluir = {
  cliente: { select: { id: true, nome: true } },
  tabelaCustos: { select: { id: true, competencia: true, versao: true } },
  historico: { orderBy: { data: 'asc' } }
} satisfies Prisma.OrcamentoInclude;
type OrcamentoCompleto = Prisma.OrcamentoGetPayload<{ include: typeof incluir }>;

/** Vencidos enquanto aguardavam o cliente passam a EXPIRADO. */
export const expirarVencidos = (db: Db, tenantId: string) =>
  db.orcamento.updateMany({ where: { tenantId, status: { in: ['ENVIADO', 'EM_NEGOCIACAO'] }, validade: { lt: hoje() } }, data: { status: 'EXPIRADO' } });

@Injectable()
export class OrcamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService
  ) {}

  async listar(tenantId: string, status?: string, q?: string) {
    await expirarVencidos(this.prisma, tenantId);
    const termo = q?.trim();
    const busca: Prisma.OrcamentoWhereInput = termo
      ? {
          OR: [
            { numero: { contains: termo, mode: 'insensitive' } },
            { titulo: { contains: termo, mode: 'insensitive' } },
            { cliente: { nome: { contains: termo, mode: 'insensitive' } } },
            { cliente: { fantasia: { contains: termo, mode: 'insensitive' } } }
          ]
        }
      : {};
    const filtroStatus = STATUS_ORCAMENTO.includes(status as StatusOrcamento) ? { status: status as StatusOrcamento } : {};
    const [itens, grupos] = await Promise.all([
      this.prisma.orcamento.findMany({
        where: { tenantId, ...busca, ...filtroStatus },
        include: { cliente: { select: { id: true, nome: true } } },
        orderBy: { atualizadoEm: 'desc' }
      }),
      this.prisma.orcamento.groupBy({ by: ['status'], where: { tenantId, ...busca }, _count: { _all: true } })
    ]);
    const contagem = Object.fromEntries(STATUS_ORCAMENTO.map((s) => [s, grupos.find((g) => g.status === s)?._count._all ?? 0]));
    return {
      itens: itens.map((o) => ({
        id: o.id,
        numero: o.numero,
        titulo: o.titulo,
        cliente: o.cliente,
        lote: o.lote,
        status: o.status,
        versao: o.versao,
        precoFinalLote: tt(o.precoFinalLote),
        margemEfetiva: tt(o.margemEfetiva),
        situacaoMargem: o.situacaoMargem,
        validade: dataIso(o.validade),
        atualizadoEm: o.atualizadoEm
      })),
      total: itens.length,
      contagem
    };
  }

  async simular(tenantId: string, dto: SimularDto) {
    const tabela = await this.tabelaPara(tenantId, dto.tabelaCustosId, false);
    return calcular(dto.linhas as LinhaEntrada[], resultadoDe(tabela), await this.precificacao(tenantId, dto)).resultado;
  }

  async criar(s: Sessao, dto: OrcamentoDto) {
    await this.clienteApto(s.tenantId, dto.clienteId);
    const tabela = await this.tabelaPara(s.tenantId, dto.tabelaCustosId, true);
    const p = await this.precificacao(s.tenantId, dto);
    const { linhas, resultado } = calcular(dto.linhas as LinhaEntrada[], resultadoDe(tabela), p);
    const validade = await this.validade(s.tenantId, dto.validade);

    const id = await this.prisma.$transaction(async (tx) => {
      const o = await tx.orcamento.create({
        data: {
          tenantId: s.tenantId,
          numero: await proximoNumero(tx, s.tenantId),
          clienteId: dto.clienteId,
          tabelaCustosId: tabela.id,
          titulo: dto.titulo.trim(),
          segmento: dto.segmento ?? 'USINAGEM',
          validade,
          prazoPrometido: dto.prazoPrometido ? new Date(`${dto.prazoPrometido.slice(0, 10)}T00:00:00.000Z`) : null,
          observacoes: dto.observacoes ?? '',
          linhas: json(linhas),
          ...colunasDePrecificacao(p),
          ...colunasDoResultado(resultado)
        }
      });
      await this.registrar(tx, o, 'criado', s.id);
      return o.id;
    });
    return this.detalhe(s.tenantId, id);
  }

  async detalhe(tenantId: string, id: string) {
    await expirarVencidos(this.prisma, tenantId);
    const o = await this.buscar(tenantId, id);
    const [vigente, promessa] = await Promise.all([buscarVigente(this.prisma, tenantId), promessaDoOrcamento(this.prisma, tenantId, o)]);
    return {
      ...cabecalho(o),
      promessa,
      linhas: o.linhas,
      tabelaCustos: o.tabelaCustos,
      tabelaMaisNova: !!vigente && vigente.id !== o.tabelaCustosId,
      resultado: o.resultado,
      historico: o.historico.map((h) => ({ versao: h.versao, status: h.status, evento: h.evento, precoFinalLote: tt(h.precoFinalLote), detalhe: h.detalhe, data: h.data }))
    };
  }

  async substituir(s: Sessao, id: string, dto: OrcamentoDto) {
    const o = await this.buscar(s.tenantId, id);
    if (o.status !== 'RASCUNHO' && o.status !== 'EM_NEGOCIACAO') {
      const dica = o.status === 'ENVIADO' ? ' Marque como em negociação para abrir uma nova versão.' : ' Crie um novo orçamento a partir dele.';
      throw conflito('ORCAMENTO_BLOQUEADO', `Este orçamento está ${ROTULO[o.status]} e não pode ser editado.${dica}`);
    }
    if (dto.clienteId !== o.clienteId) await this.clienteApto(s.tenantId, dto.clienteId);
    const tabela = await this.tabelaPara(s.tenantId, o.tabelaCustosId, true);
    const p = await this.precificacao(s.tenantId, dto);
    const { linhas, resultado } = calcular(dto.linhas as LinhaEntrada[], resultadoDe(tabela), p);
    const novaVersao = !!o.enviadoEm;

    await this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.orcamento.update({
        where: { id },
        data: {
          clienteId: dto.clienteId,
          titulo: dto.titulo.trim(),
          segmento: dto.segmento ?? o.segmento,
          validade: dto.validade ? await this.validade(s.tenantId, dto.validade) : o.validade,
          prazoPrometido: dto.prazoPrometido ? new Date(`${dto.prazoPrometido.slice(0, 10)}T00:00:00.000Z`) : dto.prazoPrometido === null ? null : undefined,
          observacoes: dto.observacoes ?? '',
          linhas: json(linhas),
          ...colunasDePrecificacao(p),
          ...colunasDoResultado(resultado),
          margemLiberada: false,
          justificativaLiberacao: null,
          liberadaPorId: null,
          ...(novaVersao ? { versao: o.versao + 1 } : {})
        }
      });
      if (novaVersao) await this.registrar(tx, atualizado, 'nova_versao', s.id, undefined, fotografia(o));
    });
    return this.detalhe(s.tenantId, id);
  }

  async enviar(s: Sessao, id: string) {
    const o = await this.emStatus(s.tenantId, id, ['RASCUNHO', 'EM_NEGOCIACAO'], 'enviar');
    if (o.exigeAprovacao && !o.margemLiberada) {
      throw conflito(
        'MARGEM_ABAIXO_MINIMO',
        `A margem efetiva ficou em ${pct(tt(o.margemEfetiva))}, abaixo do mínimo de ${pct(tt(o.margemMinima))}. Reduza o desconto ou peça a um gestor para liberar a margem antes de enviar.`,
        { margemEfetiva: tt(o.margemEfetiva), margemMinima: tt(o.margemMinima) }
      );
    }
    if (o.validade < hoje()) {
      throw regra('VALIDADE_VENCIDA', `A validade deste orçamento venceu em ${dataIso(o.validade).split('-').reverse().join('/')}. Ajuste a data antes de enviar.`);
    }
    return this.mudar(s, o, 'ENVIADO', 'enviado', { enviadoEm: new Date() });
  }

  async liberarMargem(s: Sessao, id: string, justificativa: string) {
    const o = await this.emStatus(s.tenantId, id, ['RASCUNHO', 'EM_NEGOCIACAO'], 'liberar a margem de');
    await this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.orcamento.update({
        where: { id },
        data: { margemLiberada: true, justificativaLiberacao: justificativa.trim(), liberadaPorId: s.id }
      });
      await this.registrar(tx, atualizado, 'margem_liberada', s.id, justificativa.trim());
    });
    return this.detalhe(s.tenantId, o.id);
  }

  async negociar(s: Sessao, id: string) {
    const o = await this.emStatus(s.tenantId, id, ['ENVIADO'], 'colocar em negociação');
    return this.mudar(s, o, 'EM_NEGOCIACAO', 'negociacao');
  }

  async aprovar(s: Sessao, id: string) {
    const o = await this.emStatus(s.tenantId, id, ['ENVIADO', 'EM_NEGOCIACAO'], 'aprovar');
    return this.mudar(s, o, 'APROVADO', 'aprovado', { aprovadoEm: new Date() });
  }

  async recusar(s: Sessao, id: string, motivo: string) {
    const o = await this.emStatus(s.tenantId, id, ['ENVIADO', 'EM_NEGOCIACAO'], 'recusar');
    return this.mudar(s, o, 'RECUSADO', 'recusado', { recusadoEm: new Date(), motivoRecusa: motivo.trim() }, motivo.trim());
  }

  async atualizarCustos(s: Sessao, id: string) {
    const o = await this.emStatus(s.tenantId, id, ABERTOS, 'atualizar os custos de');
    const vigente = await buscarVigente(this.prisma, s.tenantId);
    if (!vigente) throw semVigente(422);
    if (vigente.id === o.tabelaCustosId) {
      throw conflito('JA_NA_VIGENTE', 'Este orçamento já usa a Tabela de Custos vigente; não há custos novos para trazer.');
    }
    const p: Precificacao = {
      lote: o.lote,
      impostos: tt(o.impostos),
      comissao: tt(o.comissao),
      margemAlvo: tt(o.margemAlvo),
      margemMinima: tt(o.margemMinima),
      desconto: tt(o.desconto),
      metodo: o.metodo as MetodoPreco
    };
    const { linhas, resultado } = calcular(o.linhas as LinhaEntrada[], resultadoDe(vigente), p);
    await this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.orcamento.update({
        where: { id },
        data: {
          tabelaCustosId: vigente.id,
          linhas: json(linhas),
          ...colunasDoResultado(resultado),
          versao: o.versao + 1,
          margemLiberada: false,
          justificativaLiberacao: null,
          liberadaPorId: null,
          ...(o.status === 'ENVIADO' ? { status: 'EM_NEGOCIACAO' as const } : {})
        }
      });
      await this.registrar(tx, atualizado, 'custos_atualizados', s.id, `Tabela ${vigente.competencia} v${vigente.versao}`, fotografia(o));
    });
    return this.detalhe(s.tenantId, id);
  }

  private async mudar(s: Sessao, o: Orcamento, status: StatusOrcamento, evento: string, extra: Prisma.OrcamentoUpdateInput = {}, detalhe?: string) {
    await this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.orcamento.update({ where: { id: o.id }, data: { ...extra, status } });
      await this.registrar(tx, atualizado, evento, s.id, detalhe);
    });
    return this.detalhe(s.tenantId, o.id);
  }

  private registrar(db: Db, o: Orcamento, evento: string, usuarioId?: string, detalhe?: string, snapshot?: unknown) {
    return db.orcamentoHistorico.create({
      data: {
        tenantId: o.tenantId,
        orcamentoId: o.id,
        versao: o.versao,
        status: o.status,
        evento,
        precoFinalLote: o.precoFinalLote,
        usuarioId,
        detalhe,
        ...(snapshot ? { snapshot: json(snapshot) } : {})
      }
    });
  }

  private async precificacao(tenantId: string, dto: SimularDto): Promise<Precificacao> {
    const p = await this.parametros.carregar(tenantId);
    return {
      lote: dto.lote,
      impostos: dto.impostos !== undefined ? String(dto.impostos) : tt(p.impostosPadrao),
      comissao: dto.comissao !== undefined ? String(dto.comissao) : tt(p.comissaoPadrao),
      margemAlvo: dto.margemAlvo !== undefined ? String(dto.margemAlvo) : tt(p.margemAlvo),
      margemMinima: dto.margemMinima !== undefined ? String(dto.margemMinima) : tt(p.margemMinima),
      desconto: dto.desconto !== undefined ? String(dto.desconto) : '0',
      metodo: (dto.metodo ?? p.metodoPreco) as MetodoPreco
    };
  }

  private async validade(tenantId: string, informada?: string) {
    if (informada) return new Date(`${informada.slice(0, 10)}T00:00:00.000Z`);
    const { validadeOrcamentoDias } = await this.parametros.carregar(tenantId);
    const d = hoje();
    d.setUTCDate(d.getUTCDate() + validadeOrcamentoDias);
    return d;
  }

  private async tabelaPara(tenantId: string, id: string | undefined, publicada: boolean) {
    if (!id) {
      const vigente = await buscarVigente(this.prisma, tenantId);
      if (!vigente) throw semVigente(422);
      return vigente;
    }
    const t = await this.prisma.tabelaCustos.findFirst({ where: { id, tenantId } });
    if (!t) throw naoEncontrado('essa versão da Tabela de Custos');
    if (publicada && t.status === 'RASCUNHO') {
      throw regra('TABELA_RASCUNHO', 'Orçamentos só podem usar uma Tabela de Custos publicada. Publique o rascunho ou use a vigente.');
    }
    return t;
  }

  private async clienteApto(tenantId: string, clienteId: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!c) throw naoEncontrado('esse cliente');
    if (c.status === 'BLOQUEADO') {
      throw conflito('CLIENTE_BLOQUEADO', `${c.nome} está bloqueado e não pode receber novos orçamentos. Fale com o financeiro para liberar o cadastro.`);
    }
    if (c.status === 'INATIVO') {
      throw conflito('CLIENTE_INATIVO', `${c.nome} está inativo. Reative o cadastro do cliente antes de orçar para ele.`);
    }
    return c;
  }

  private async emStatus(tenantId: string, id: string, permitidos: StatusOrcamento[], acao: string) {
    await expirarVencidos(this.prisma, tenantId);
    const o = await this.buscar(tenantId, id);
    if (!permitidos.includes(o.status)) {
      throw conflito(
        'STATUS_INVALIDO',
        `Não dá para ${acao} este orçamento porque ele está ${ROTULO[o.status]}. Só é possível quando ele está ${permitidos.map((p) => ROTULO[p]).join(' ou ')}.`,
        { status: o.status, permitidos }
      );
    }
    return o;
  }

  private async buscar(tenantId: string, id: string) {
    const o = await this.prisma.orcamento.findFirst({ where: { id, tenantId }, include: incluir });
    if (!o) throw naoEncontrado('esse orçamento');
    return o;
  }
}

function cabecalho(o: OrcamentoCompleto) {
  return {
    id: o.id,
    numero: o.numero,
    titulo: o.titulo,
    clienteId: o.clienteId,
    cliente: o.cliente,
    segmento: o.segmento,
    lote: o.lote,
    validade: dataIso(o.validade),
    prazoPrometido: o.prazoPrometido ? dataIso(o.prazoPrometido) : null,
    impostos: tt(o.impostos),
    comissao: tt(o.comissao),
    margemAlvo: tt(o.margemAlvo),
    margemMinima: tt(o.margemMinima),
    desconto: tt(o.desconto),
    metodo: o.metodo,
    observacoes: o.observacoes,
    status: o.status,
    versao: o.versao,
    precoFinalLote: tt(o.precoFinalLote),
    margemEfetiva: tt(o.margemEfetiva),
    situacaoMargem: o.situacaoMargem,
    exigeAprovacao: o.exigeAprovacao,
    margemLiberada: o.margemLiberada,
    justificativaLiberacao: o.justificativaLiberacao,
    motivoRecusa: o.motivoRecusa,
    enviadoEm: o.enviadoEm,
    aprovadoEm: o.aprovadoEm,
    criadoEm: o.criadoEm,
    atualizadoEm: o.atualizadoEm
  };
}

/** Como a versão estava antes de ser substituída. */
const fotografia = (o: OrcamentoCompleto) => ({ ...cabecalho(o), tabelaCustos: o.tabelaCustos, linhas: o.linhas, resultado: o.resultado });
