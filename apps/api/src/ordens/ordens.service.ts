import { Injectable } from '@nestjs/common';
import { Prisma, StatusOs } from '@prisma/client';
import { arredondar, dec, reais, soma, type LinhaOrcamento, type ResultadoOrcamento } from '@promec/motor';
import { dataIso, hoje, pct, pd, pdOpc, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { proximoNumero } from '../orcamentos/numeracao';
import { ParametrosService } from '../parametros/parametros.service';
import { PrismaService } from '../prisma/prisma.service';
import { buscarVigente, Db, json, resultadoDe } from '../tabelas-custos/entrada';
import { semVigente } from '../tabelas-custos/tabelas.service';
import {
  custoRealDa,
  exigeJustificativa,
  horasEntre,
  incluirOs,
  mesclarObjeto,
  OsCompleta,
  roteiroDoOrcamento,
  saidaApontamento,
  saidaOperacao
} from './custo';
import {
  AtualizarCustoDto,
  AtualizarOperacaoDto,
  AtualizarOsDto,
  CriarOsDto,
  CustoOsDto,
  EntregarDto,
  IniciarDto,
  InspecaoDto,
  OperacaoOsDto,
  PararDto,
  PausarDto
} from './ordens.dto';

export const STATUS_OS: StatusOs[] = ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA', 'CONTROLE_QUALIDADE', 'CONCLUIDA', 'ENTREGUE', 'CANCELADA'];
const ENCERRADAS: StatusOs[] = ['ENTREGUE', 'CANCELADA'];
const EM_ANDAMENTO: StatusOs[] = ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA', 'CONTROLE_QUALIDADE', 'CONCLUIDA'];
const ORDEM_PRIORIDADE = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 } as const;
const HORAS_PAUSA_LONGA = 4;

const ROTULO: Record<StatusOs, string> = {
  ABERTA: 'aberta',
  EM_FILA: 'na fila',
  EM_EXECUCAO: 'em execução',
  PAUSADA: 'pausada',
  CONTROLE_QUALIDADE: 'no controle de qualidade',
  CONCLUIDA: 'concluída',
  ENTREGUE: 'entregue',
  CANCELADA: 'cancelada'
};

const DICA: Partial<Record<StatusOs, string>> = {
  ABERTA: ' Libere a OS para a fila primeiro.',
  PAUSADA: ' Retome a OS primeiro.'
};

export const atrasada = (os: { prazo: Date; status: StatusOs }) => os.prazo < hoje() && !ENCERRADAS.includes(os.status);
const data = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
const MOTIVO: Record<string, string> = {
  FALTA_PECA: 'falta de peça',
  AGUARDANDO_CLIENTE: 'aguardando o cliente',
  QUEBRA: 'quebra',
  FALTA_OPERADOR: 'falta de operador',
  OUTRO: 'outro motivo'
};

@Injectable()
export class OrdensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService
  ) {}

  async listar(tenantId: string, filtro: { status?: string; q?: string; atrasadas?: string }) {
    const termo = filtro.q?.trim();
    const todas = await this.prisma.ordemServico.findMany({
      where: {
        tenantId,
        ...(termo
          ? {
              OR: [
                { numero: { contains: termo, mode: 'insensitive' } },
                { titulo: { contains: termo, mode: 'insensitive' } },
                { cliente: { nome: { contains: termo, mode: 'insensitive' } } },
                { cliente: { fantasia: { contains: termo, mode: 'insensitive' } } }
              ]
            }
          : {})
      },
      include: incluirOs,
      orderBy: [{ prioridade: 'desc' }, { prazo: 'asc' }]
    });
    const contagem: Record<string, number> = Object.fromEntries(STATUS_OS.map((s) => [s, todas.filter((o) => o.status === s).length]));
    contagem.ATRASADAS = todas.filter(atrasada).length;
    const itens = todas
      .filter((o) => !STATUS_OS.includes(filtro.status as StatusOs) || o.status === filtro.status)
      .filter((o) => filtro.atrasadas !== 'true' || atrasada(o))
      .map((o) => this.item(o));
    return { itens, total: itens.length, contagem };
  }

  async detalhe(tenantId: string, id: string) {
    const os = await this.buscar(tenantId, id);
    const [apontamentos, ocorrencias, inspecoes, historico] = await Promise.all([
      this.prisma.apontamento.findMany({ where: { osId: id }, orderBy: { inicio: 'asc' }, include: { colaborador: { select: { nome: true } } } }),
      this.prisma.ocorrencia.findMany({ where: { osId: id }, orderBy: { inicio: 'asc' } }),
      this.prisma.inspecao.findMany({ where: { osId: id }, orderBy: { data: 'asc' } }),
      this.prisma.osHistorico.findMany({ where: { osId: id }, orderBy: { data: 'asc' } })
    ]);
    const resultado = custoRealDa(os);
    return {
      ...this.cabecalho(os),
      objeto: mesclarObjeto(os.objeto),
      operacoes: os.operacoes.map(saidaOperacao),
      custos: os.custos.map((c) => ({
        id: c.id,
        descricao: c.descricao,
        categoria: c.categoria,
        orcado: tt(c.orcado),
        real: c.real === null ? null : tt(c.real),
        doOrcamento: c.doOrcamento,
        justificativa: c.justificativa
      })),
      apontamentos: apontamentos.map(saidaApontamento),
      ocorrencias: ocorrencias.map((o) => ({
        id: o.id,
        tipo: o.tipo,
        motivo: o.motivo,
        inicio: o.inicio,
        fim: o.fim,
        horas: o.horas === null ? null : tt(o.horas),
        observacao: o.observacao
      })),
      inspecoes: inspecoes.map((i) => ({ id: i.id, aprovada: i.aprovada, itens: i.itens, observacao: i.observacao, centroRetrabalhoId: i.centroRetrabalhoId, data: i.data })),
      historico: historico.map((h) => ({ status: h.status, evento: h.evento, detalhe: h.detalhe, data: h.data })),
      tabelaCustos: { id: os.tabelaCustos.id, competencia: os.tabelaCustos.competencia, versao: os.tabelaCustos.versao },
      resultado,
      alertas: this.alertas(os, resultado)
    };
  }

  async converter(s: Sessao, orcamentoId: string, prazo?: string) {
    const o = await this.prisma.orcamento.findFirst({ where: { id: orcamentoId, tenantId: s.tenantId } });
    if (!o) throw naoEncontrado('esse orçamento');
    if (o.status !== 'APROVADO') {
      throw conflito(
        'STATUS_INVALIDO',
        o.status === 'CONVERTIDO'
          ? `${o.numero} já foi convertido em OS. Abra a ordem de serviço a partir dele.`
          : `Só orçamentos aprovados viram OS, e ${o.numero} ainda não foi aprovado pelo cliente. Registre a aprovação antes de converter.`,
        { status: o.status }
      );
    }
    const { operacoes, custos } = roteiroDoOrcamento(o.linhas as unknown as LinhaOrcamento[], o.resultado as unknown as ResultadoOrcamento);
    const prazoFinal = prazo ? data(prazo) : await this.prazoPadrao();
    const id = await this.prisma.$transaction(async (tx) => {
      const os = await tx.ordemServico.create({
        data: {
          tenantId: s.tenantId,
          numero: await proximoNumero(tx, s.tenantId, 'OS'),
          orcamentoId: o.id,
          clienteId: o.clienteId,
          tabelaCustosId: o.tabelaCustosId,
          titulo: o.titulo,
          segmento: o.segmento,
          lote: o.lote,
          prazo: prazoFinal,
          objeto: json(mesclarObjeto({})),
          observacoes: o.observacoes,
          status: 'EM_FILA',
          precoFinalLote: o.precoFinalLote,
          impostos: o.impostos,
          comissao: o.comissao,
          margemMinima: o.margemMinima,
          operacoes: {
            create: operacoes.map((op) => ({
              ...op,
              tenantId: s.tenantId,
              custoHora: pd(op.custoHora),
              setupOrcadoHoras: pd(op.setupOrcadoHoras),
              cicloOrcadoHorasPorPeca: pd(op.cicloOrcadoHorasPorPeca)
            }))
          },
          custos: { create: custos.map((c) => ({ ...c, tenantId: s.tenantId, orcado: pd(c.orcado), doOrcamento: true })) }
        }
      });
      const convertido = await tx.orcamento.update({ where: { id: o.id }, data: { status: 'CONVERTIDO' } });
      await tx.orcamentoHistorico.create({
        data: {
          tenantId: s.tenantId,
          orcamentoId: o.id,
          versao: convertido.versao,
          status: 'CONVERTIDO',
          evento: 'convertido',
          precoFinalLote: convertido.precoFinalLote,
          usuarioId: s.id,
          detalhe: os.numero
        }
      });
      await this.registrar(tx, os.tenantId, os.id, 'EM_FILA', 'criada', s.id, `Convertida de ${o.numero}`);
      return os.id;
    });
    return this.detalhe(s.tenantId, id);
  }

  async criarRapida(s: Sessao, dto: CriarOsDto) {
    const p = await this.parametros.carregar(s.tenantId);
    if (pd(dto.precoFinalLote).gt(p.limiteServicoRapido)) {
      throw regra(
        'EXIGE_ORCAMENTO',
        `Serviços acima de R$ ${reais(tt(p.limiteServicoRapido)).replace('.', ',')} precisam de orçamento aprovado antes de virar OS. Monte o orçamento, aprove com o cliente e converta.`,
        { limite: tt(p.limiteServicoRapido) }
      );
    }
    await this.clienteApto(s.tenantId, dto.clienteId);
    const vigente = await buscarVigente(this.prisma, s.tenantId);
    if (!vigente) throw semVigente(422);
    const operacoes: Prisma.OsOperacaoUncheckedCreateWithoutOsInput[] = [];
    for (const [i, op] of dto.operacoes.entries()) {
      if (op.colaboradorId) await this.habilitado(s.tenantId, op.centroId, op.colaboradorId);
      operacoes.push({
        tenantId: s.tenantId,
        sequencia: op.sequencia ?? (i + 1) * 10,
        descricao: op.descricao.trim(),
        centroId: op.centroId,
        colaboradorId: op.colaboradorId ?? null,
        custoHora: pd(this.custoHora(resultadoDe(vigente), op.centroId, op.descricao)),
        setupOrcadoHoras: pd(op.setupOrcadoHoras),
        cicloOrcadoHorasPorPeca: pd(op.cicloOrcadoHorasPorPeca)
      });
    }
    const id = await this.prisma.$transaction(async (tx) => {
      const os = await tx.ordemServico.create({
        data: {
          tenantId: s.tenantId,
          numero: await proximoNumero(tx, s.tenantId, 'OS'),
          clienteId: dto.clienteId,
          tabelaCustosId: vigente.id,
          titulo: dto.titulo.trim(),
          segmento: dto.segmento,
          lote: dto.lote,
          prazo: data(dto.prazo),
          prioridade: dto.prioridade,
          objeto: json(mesclarObjeto({}, dto.objeto)),
          observacoes: dto.observacoes ?? '',
          precoFinalLote: pd(dto.precoFinalLote),
          impostos: p.impostosPadrao,
          comissao: p.comissaoPadrao,
          margemMinima: p.margemMinima,
          operacoes: { create: operacoes },
          custos: {
            create: (dto.custos ?? []).map((c) => ({
              tenantId: s.tenantId,
              descricao: c.descricao.trim(),
              categoria: c.categoria,
              orcado: pd(c.orcado ?? '0'),
              real: pdOpc(c.real),
              doOrcamento: true,
              justificativa: c.justificativa
            }))
          }
        }
      });
      await this.registrar(tx, s.tenantId, os.id, 'ABERTA', 'criada', s.id, 'Serviço rápido sem orçamento');
      return os.id;
    });
    return this.detalhe(s.tenantId, id);
  }

  async atualizar(s: Sessao, id: string, dto: AtualizarOsDto) {
    const os = await this.naoEncerrada(s.tenantId, id, 'editar');
    await this.prisma.ordemServico.update({
      where: { id },
      data: {
        titulo: dto.titulo?.trim(),
        prazo: dto.prazo ? data(dto.prazo) : undefined,
        prioridade: dto.prioridade,
        observacoes: dto.observacoes,
        ...(dto.objeto ? { objeto: json(mesclarObjeto(os.objeto, dto.objeto)) } : {})
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async liberar(s: Sessao, id: string) {
    const os = await this.emStatus(s.tenantId, id, ['ABERTA'], 'liberar');
    return this.mudar(s, os, 'EM_FILA', 'liberada');
  }

  async incluirOperacao(s: Sessao, id: string, dto: OperacaoOsDto) {
    const os = await this.emStatus(s.tenantId, id, ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA'], 'incluir operações em');
    const emExecucao = os.status === 'EM_EXECUCAO' || os.status === 'PAUSADA' || os.operacoes.some((o) => o.apontamentos.length > 0);
    if (emExecucao && !dto.justificativa?.trim()) {
      throw regra(
        'JUSTIFICATIVA_OBRIGATORIA',
        'A OS já está em execução, então esta operação não estava no orçado. Explique por que ela entrou para o desvio ficar registrado.'
      );
    }
    if (dto.colaboradorId) await this.habilitado(s.tenantId, dto.centroId, dto.colaboradorId);
    await this.prisma.osOperacao.create({
      data: {
        tenantId: s.tenantId,
        osId: id,
        sequencia: dto.sequencia ?? Math.max(0, ...os.operacoes.map((o) => o.sequencia)) + 10,
        descricao: dto.descricao.trim(),
        centroId: dto.centroId,
        colaboradorId: dto.colaboradorId ?? null,
        custoHora: pd(this.custoHora(resultadoDe(os.tabelaCustos), dto.centroId, dto.descricao)),
        setupOrcadoHoras: pd(dto.setupOrcadoHoras),
        cicloOrcadoHorasPorPeca: pd(dto.cicloOrcadoHorasPorPeca),
        orcada: !emExecucao,
        justificativa: dto.justificativa?.trim() || null
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async atualizarOperacao(s: Sessao, id: string, opId: string, dto: AtualizarOperacaoDto) {
    const { os, op } = await this.operacaoNaoIniciada(s.tenantId, id, opId, 'alterar');
    const centroId = dto.centroId ?? op.centroId;
    const colaboradorId = dto.colaboradorId === undefined ? op.colaboradorId : dto.colaboradorId;
    if (colaboradorId && (dto.colaboradorId || dto.centroId)) await this.habilitado(s.tenantId, centroId, colaboradorId);
    await this.prisma.osOperacao.update({
      where: { id: opId },
      data: {
        descricao: dto.descricao?.trim(),
        sequencia: dto.sequencia,
        centroId,
        colaboradorId,
        ...(dto.centroId ? { custoHora: pd(this.custoHora(resultadoDe(os.tabelaCustos), centroId, op.descricao)) } : {}),
        setupOrcadoHoras: pdOpc(dto.setupOrcadoHoras),
        cicloOrcadoHorasPorPeca: pdOpc(dto.cicloOrcadoHorasPorPeca),
        justificativa: dto.justificativa
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async removerOperacao(s: Sessao, id: string, opId: string) {
    await this.operacaoNaoIniciada(s.tenantId, id, opId, 'remover');
    await this.prisma.osOperacao.delete({ where: { id: opId } });
    return this.detalhe(s.tenantId, id);
  }

  async incluirCusto(s: Sessao, id: string, dto: CustoOsDto) {
    await this.naoEncerrada(s.tenantId, id, 'lançar custos em');
    const orcado = String(dto.orcado ?? '0');
    const real = dto.real === undefined || dto.real === null ? null : String(dto.real);
    this.conferirJustificativa(dto.descricao, orcado, real, dto.justificativa);
    await this.prisma.osCusto.create({
      data: {
        tenantId: s.tenantId,
        osId: id,
        descricao: dto.descricao.trim(),
        categoria: dto.categoria,
        orcado: pd(orcado),
        real: real === null ? null : pd(real),
        justificativa: dto.justificativa?.trim() || null
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async atualizarCusto(s: Sessao, id: string, custoId: string, dto: AtualizarCustoDto) {
    await this.naoEncerrada(s.tenantId, id, 'lançar custos em');
    const c = await this.custo(s.tenantId, id, custoId);
    const orcado = c.doOrcamento || dto.orcado === undefined ? tt(c.orcado) : String(dto.orcado);
    const real = dto.real === undefined ? (c.real === null ? null : tt(c.real)) : dto.real === null ? null : String(dto.real);
    const justificativa = dto.justificativa ?? c.justificativa ?? undefined;
    this.conferirJustificativa(dto.descricao ?? c.descricao, orcado, real, justificativa);
    await this.prisma.osCusto.update({
      where: { id: custoId },
      data: {
        descricao: dto.descricao?.trim(),
        categoria: dto.categoria,
        orcado: pd(orcado),
        real: real === null ? null : pd(real),
        justificativa: justificativa?.trim() || null
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async removerCusto(s: Sessao, id: string, custoId: string) {
    await this.naoEncerrada(s.tenantId, id, 'remover custos de');
    const c = await this.custo(s.tenantId, id, custoId);
    if (c.doOrcamento) {
      throw conflito('CUSTO_DO_ORCAMENTO', `"${c.descricao}" veio do orçado e não pode ser removido. Se não houve consumo, deixe o real em branco ou zerado.`);
    }
    await this.prisma.osCusto.delete({ where: { id: custoId } });
    return this.detalhe(s.tenantId, id);
  }

  async iniciar(s: Sessao, id: string, opId: string, dto: IniciarDto) {
    const os = await this.emStatus(s.tenantId, id, ['EM_FILA', 'EM_EXECUCAO'], 'iniciar operações de');
    const op = this.operacao(os, opId);
    if (op.status === 'CONCLUIDA') {
      throw conflito('OPERACAO_CONCLUIDA', `${op.descricao} já foi encerrada. Se precisa refazer, registre uma operação de retrabalho.`);
    }
    if (dto.tipo === 'SETUP' && op.setupConcluido) {
      throw conflito('SETUP_ENCERRADO', `O setup de ${op.descricao} já foi encerrado. Inicie a produção.`);
    }
    const colaborador = await this.prisma.colaborador.findFirst({ where: { id: dto.colaboradorId, tenantId: s.tenantId } });
    if (!colaborador) throw naoEncontrado('esse colaborador');
    if (!colaborador.ativo) throw regra('COLABORADOR_INATIVO', `${colaborador.nome} está inativo e não pode apontar horas. Reative o cadastro ou escolha outro operador.`);
    await this.habilitado(s.tenantId, op.centroId, colaborador.id);
    const aberto = await this.prisma.apontamento.findFirst({
      where: { tenantId: s.tenantId, colaboradorId: colaborador.id, fim: null },
      include: { os: { select: { id: true, numero: true } }, operacao: { select: { id: true, descricao: true } } }
    });
    if (aberto) {
      throw conflito(
        'APONTAMENTO_ABERTO',
        `${colaborador.nome} já está apontando em ${aberto.operacao.descricao} da ${aberto.os.numero}. Pare aquele apontamento antes de começar outro.`,
        { apontamentoId: aberto.id, osId: aberto.os.id, osNumero: aberto.os.numero, operacaoId: aberto.operacao.id }
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.apontamento.create({
        data: { tenantId: s.tenantId, osId: id, operacaoId: opId, colaboradorId: colaborador.id, tipo: dto.tipo, inicio: new Date() }
      });
      await tx.osOperacao.update({ where: { id: opId }, data: { status: 'EM_ANDAMENTO', colaboradorId: op.colaboradorId ?? colaborador.id } });
      if (os.status === 'EM_FILA') {
        await tx.ordemServico.update({ where: { id }, data: { status: 'EM_EXECUCAO' } });
        await this.registrar(tx, s.tenantId, id, 'EM_EXECUCAO', 'execucao_iniciada', s.id, `${op.descricao} por ${colaborador.nome}`);
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async parar(s: Sessao, id: string, opId: string, dto: PararDto) {
    const os = await this.emStatus(s.tenantId, id, ['EM_EXECUCAO'], 'parar apontamentos de');
    const op = this.operacao(os, opId);
    const abertos = op.apontamentos.filter((a) => !a.fim && (dto.encerrarOperacao || !dto.colaboradorId || a.colaboradorId === dto.colaboradorId));
    if (!abertos.length && !dto.encerrarSetup && !dto.encerrarOperacao) {
      throw conflito('SEM_APONTAMENTO_ABERTO', `Não há apontamento aberto em ${op.descricao} para parar. Inicie um apontamento ou encerre a operação.`);
    }
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const [i, a] of abertos.entries()) {
        await tx.apontamento.update({
          where: { id: a.id },
          data: {
            fim: agora,
            horas: pd(horasEntre(a.inicio, agora)),
            ...(i === 0 ? { quantidadeBoa: dto.quantidadeBoa ?? 0, refugo: dto.refugo ?? 0, observacao: dto.observacao ?? null } : {})
          }
        });
      }
      const encerrar = !!dto.encerrarOperacao;
      await tx.osOperacao.update({
        where: { id: opId },
        data: { ...(dto.encerrarSetup || encerrar ? { setupConcluido: true } : {}), ...(encerrar ? { status: 'CONCLUIDA' } : {}) }
      });
      if (encerrar && os.operacoes.every((o) => o.id === opId || o.status === 'CONCLUIDA')) {
        await tx.ordemServico.update({ where: { id }, data: { status: 'CONTROLE_QUALIDADE' } });
        await this.registrar(tx, s.tenantId, id, 'CONTROLE_QUALIDADE', 'operacoes_encerradas', s.id);
      }
    });
    return this.detalhe(s.tenantId, id);
  }

  async pausar(s: Sessao, id: string, dto: PausarDto) {
    const os = await this.emStatus(s.tenantId, id, ['EM_EXECUCAO'], 'pausar');
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.fecharApontamentos(tx, os, agora);
      await tx.osOperacao.updateMany({ where: { osId: id, status: 'EM_ANDAMENTO' }, data: { status: 'PAUSADA' } });
      await tx.ocorrencia.create({ data: { tenantId: s.tenantId, osId: id, tipo: 'PAUSA', motivo: dto.motivo, inicio: agora, observacao: dto.observacao ?? null } });
      await tx.ordemServico.update({ where: { id }, data: { status: 'PAUSADA' } });
      await this.registrar(tx, s.tenantId, id, 'PAUSADA', 'pausada', s.id, MOTIVO[dto.motivo] + (dto.observacao ? `: ${dto.observacao}` : ''));
    });
    return this.detalhe(s.tenantId, id);
  }

  async retomar(s: Sessao, id: string) {
    const os = await this.emStatus(s.tenantId, id, ['PAUSADA'], 'retomar');
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.fecharOcorrencias(tx, os, agora);
      await tx.osOperacao.updateMany({ where: { osId: id, status: 'PAUSADA' }, data: { status: 'EM_ANDAMENTO' } });
      await tx.ordemServico.update({ where: { id }, data: { status: 'EM_EXECUCAO' } });
      await this.registrar(tx, s.tenantId, id, 'EM_EXECUCAO', 'retomada', s.id);
    });
    return this.detalhe(s.tenantId, id);
  }

  async inspecao(s: Sessao, id: string, dto: InspecaoDto) {
    const os = await this.emStatus(s.tenantId, id, ['CONTROLE_QUALIDADE'], 'registrar inspeção de');
    const observacao = dto.observacao?.trim();
    if (!dto.aprovada && !observacao) {
      throw regra('OBSERVACAO_OBRIGATORIA', 'Para reprovar, descreva o que ficou fora do especificado. Isso orienta o retrabalho e fica no histórico da OS.');
    }
    const centroId = dto.centroRetrabalhoId ?? os.operacoes[os.operacoes.length - 1]?.centroId;
    const custoHora = dto.aprovada ? null : this.custoHora(resultadoDe(os.tabelaCustos), centroId, 'retrabalho');
    await this.prisma.$transaction(async (tx) => {
      await tx.inspecao.create({
        data: {
          tenantId: s.tenantId,
          osId: id,
          aprovada: dto.aprovada,
          itens: json(dto.itens),
          observacao: observacao ?? null,
          centroRetrabalhoId: dto.aprovada ? null : centroId,
          usuarioId: s.id
        }
      });
      if (dto.aprovada) {
        await tx.ordemServico.update({ where: { id }, data: { status: 'CONCLUIDA' } });
        await this.registrar(tx, s.tenantId, id, 'CONCLUIDA', 'inspecao_aprovada', s.id, observacao);
        return;
      }
      await tx.osOperacao.create({
        data: {
          tenantId: s.tenantId,
          osId: id,
          sequencia: Math.max(0, ...os.operacoes.map((o) => o.sequencia)) + 10,
          descricao: `Retrabalho: ${observacao!.slice(0, 120)}`,
          centroId,
          custoHora: pd(custoHora!),
          setupOrcadoHoras: pd(0),
          cicloOrcadoHorasPorPeca: pd(0),
          retrabalho: true,
          orcada: false,
          justificativa: observacao
        }
      });
      await tx.ordemServico.update({ where: { id }, data: { status: 'EM_EXECUCAO' } });
      await this.registrar(tx, s.tenantId, id, 'EM_EXECUCAO', 'inspecao_reprovada', s.id, observacao);
    });
    return this.detalhe(s.tenantId, id);
  }

  async entregar(s: Sessao, id: string, dto: EntregarDto) {
    const os = await this.emStatus(s.tenantId, id, ['CONCLUIDA'], 'entregar');
    const r = custoRealDa(os);
    await this.prisma.$transaction(async (tx) => {
      await tx.ordemServico.update({
        where: { id },
        data: {
          status: 'ENTREGUE',
          entregueEm: new Date(),
          recebidoPor: dto.recebidoPor.trim(),
          documentoEntrega: dto.documento ?? null,
          observacaoEntrega: dto.observacao ?? null,
          custoRealFinal: pd(r.custoReal),
          desvioFinal: pd(r.desvioCusto)
        }
      });
      await this.registrar(tx, s.tenantId, id, 'ENTREGUE', 'entregue', s.id, `Recebido por ${dto.recebidoPor.trim()}`);
    });
    return this.detalhe(s.tenantId, id);
  }

  async cancelar(s: Sessao, id: string, motivo: string) {
    const os = await this.emStatus(s.tenantId, id, EM_ANDAMENTO, 'cancelar');
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.fecharApontamentos(tx, os, agora);
      await this.fecharOcorrencias(tx, os, agora);
      const atual = await tx.ordemServico.findUniqueOrThrow({ where: { id }, include: incluirOs });
      const r = custoRealDa(atual);
      await tx.ordemServico.update({
        where: { id },
        data: { status: 'CANCELADA', canceladaEm: agora, motivoCancelamento: motivo.trim(), custoRealFinal: pd(r.custoReal), desvioFinal: pd(r.desvioCusto) }
      });
      await tx.ocorrencia.create({ data: { tenantId: s.tenantId, osId: id, tipo: 'CANCELAMENTO', inicio: agora, fim: agora, horas: pd(0), observacao: motivo.trim() } });
      await this.registrar(tx, s.tenantId, id, 'CANCELADA', 'cancelada', s.id, `${motivo.trim()} (perda de R$ ${reais(r.custoReal).replace('.', ',')})`);
    });
    return this.detalhe(s.tenantId, id);
  }

  async apontamentosAbertos(tenantId: string, colaboradorId?: string) {
    const itens = await this.prisma.apontamento.findMany({
      where: { tenantId, fim: null, ...(colaboradorId ? { colaboradorId } : {}) },
      orderBy: { inicio: 'asc' },
      include: {
        colaborador: { select: { nome: true } },
        os: { select: { id: true, numero: true, titulo: true, status: true } },
        operacao: { select: { descricao: true, centro: { select: { id: true, nome: true } } } }
      }
    });
    return {
      itens: itens.map((a) => ({
        ...saidaApontamento(a),
        os: a.os,
        operacaoDescricao: a.operacao.descricao,
        centroId: a.operacao.centro.id,
        centroNome: a.operacao.centro.nome
      })),
      total: itens.length
    };
  }

  async fila(tenantId: string, colaboradorId?: string) {
    if (!colaboradorId) throw invalido('Informe o colaboradorId para montar a fila do operador.', [{ campo: 'colaboradorId', mensagem: 'colaboradorId é obrigatório' }]);
    const colaborador = await this.prisma.colaborador.findFirst({ where: { id: colaboradorId, tenantId }, include: { alocacoes: true } });
    if (!colaborador) throw naoEncontrado('esse colaborador');
    const ops = await this.prisma.osOperacao.findMany({
      where: {
        tenantId,
        centroId: { in: colaborador.alocacoes.map((a) => a.centroId) },
        status: { not: 'CONCLUIDA' },
        os: { status: { in: ['EM_FILA', 'EM_EXECUCAO', 'PAUSADA'] } }
      },
      include: {
        ...incluirOs.operacoes.include,
        os: { select: { id: true, numero: true, titulo: true, status: true, prioridade: true, prazo: true, lote: true, cliente: { select: { id: true, nome: true } } } }
      }
    });
    ops.sort(
      (a, b) =>
        ORDEM_PRIORIDADE[a.os.prioridade] - ORDEM_PRIORIDADE[b.os.prioridade] ||
        a.os.prazo.getTime() - b.os.prazo.getTime() ||
        a.os.numero.localeCompare(b.os.numero) ||
        a.sequencia - b.sequencia
    );
    const itens = ops.map((o) => {
      const aberto = o.apontamentos.find((a) => !a.fim && a.colaboradorId === colaboradorId);
      return {
        ...saidaOperacao(o),
        os: { ...o.os, prazo: dataIso(o.os.prazo), atrasada: atrasada(o.os) },
        apontamentoAberto: aberto ? saidaApontamento(aberto) : null
      };
    });
    return { itens, total: itens.length };
  }

  /** Bloco `ordens` do painel. */
  async resumoPainel(tenantId: string) {
    const abertas = await this.prisma.ordemServico.findMany({ where: { tenantId, status: { in: EM_ANDAMENTO } }, include: incluirOs });
    const margens = abertas.map((o) => dec(custoRealDa(o).margemProjetada));
    return {
      emExecucao: abertas.filter((o) => o.status === 'EM_EXECUCAO').length,
      pausadas: abertas.filter((o) => o.status === 'PAUSADA').length,
      atrasadas: abertas.filter(atrasada).length,
      emQualidade: abertas.filter((o) => o.status === 'CONTROLE_QUALIDADE').length,
      margemProjetadaMedia: margens.length ? arredondar(soma(margens).div(margens.length), 4) : null
    };
  }

  private item(o: OsCompleta) {
    const r = custoRealDa(o);
    const emCurso = o.operacoes.flatMap((op) => op.apontamentos.filter((a) => !a.fim).map((a) => ({ op, a })))[0];
    const proxima = o.operacoes.find((op) => op.status !== 'CONCLUIDA');
    return {
      id: o.id,
      numero: o.numero,
      titulo: o.titulo,
      segmento: o.segmento,
      cliente: o.cliente,
      status: o.status,
      prioridade: o.prioridade,
      prazo: dataIso(o.prazo),
      atrasada: atrasada(o),
      progresso: r.progresso,
      centroAtual: emCurso?.op.centro.nome ?? proxima?.centro.nome ?? null,
      operadorAtual: emCurso?.a.colaborador.nome ?? proxima?.colaborador?.nome ?? null,
      custoOrcado: r.custoOrcado,
      custoProjetado: r.custoProjetado,
      margemOrcada: r.margemOrcada,
      margemProjetada: r.margemProjetada,
      situacao: r.situacao,
      orcamento: o.orcamento
    };
  }

  private cabecalho(o: OsCompleta) {
    return {
      ...this.item(o),
      clienteId: o.clienteId,
      lote: o.lote,
      precoFinalLote: tt(o.precoFinalLote),
      impostos: tt(o.impostos),
      comissao: tt(o.comissao),
      margemMinima: tt(o.margemMinima),
      observacoes: o.observacoes,
      custoRealFinal: o.custoRealFinal === null ? null : tt(o.custoRealFinal),
      desvioFinal: o.desvioFinal === null ? null : tt(o.desvioFinal),
      recebidoPor: o.recebidoPor,
      documentoEntrega: o.documentoEntrega,
      observacaoEntrega: o.observacaoEntrega,
      entregueEm: o.entregueEm,
      motivoCancelamento: o.motivoCancelamento,
      canceladaEm: o.canceladaEm,
      criadoEm: o.criadoEm,
      atualizadoEm: o.atualizadoEm
    };
  }

  private alertas(os: OsCompleta, r: ReturnType<typeof custoRealDa>) {
    const alertas: { tipo: 'perigo' | 'atencao'; codigo: string; mensagem: string; operacaoId?: string }[] = [];
    for (const op of r.operacoes.filter((o) => o.estouro)) {
      alertas.push({
        tipo: 'perigo',
        codigo: 'ESTOURO_HORAS',
        operacaoId: op.id,
        mensagem: `${op.descricao} já tem ${arredondar(op.horasReais)} h apontadas contra ${arredondar(op.horasOrcadas)} h orçadas, acima da tolerância de 20%. Confira o processo ou registre o motivo.`
      });
    }
    const pausa = os.ocorrencias.find((o) => o.tipo === 'PAUSA' && !o.fim);
    if (os.status === 'PAUSADA' && pausa) {
      const horas = horasEntre(pausa.inicio, new Date());
      if (dec(horas).gt(HORAS_PAUSA_LONGA)) {
        alertas.push({
          tipo: 'atencao',
          codigo: 'PAUSADA_LONGA',
          mensagem: `A OS está parada há ${arredondar(horas, 1).replace('.', ',')} h por ${MOTIVO[pausa.motivo ?? 'OUTRO']}. Resolva a causa ou avise o cliente sobre o prazo.`
        });
      }
    }
    if (atrasada(os)) {
      alertas.push({
        tipo: 'perigo',
        codigo: 'PRAZO_VENCIDO',
        mensagem: `O prazo venceu em ${dataIso(os.prazo).split('-').reverse().join('/')}. Combine uma nova data com o cliente e atualize o prazo.`
      });
    }
    if (os.status !== 'CANCELADA' && dec(r.margemProjetada).lt(tt(os.margemMinima))) {
      alertas.push({
        tipo: 'atencao',
        codigo: 'MARGEM_ABAIXO_MINIMO',
        mensagem: `A margem projetada caiu para ${pct(r.margemProjetada)}, abaixo do mínimo de ${pct(tt(os.margemMinima))}. Veja onde o real está passando do orçado.`
      });
    }
    return alertas;
  }

  private async mudar(s: Sessao, os: OsCompleta, status: StatusOs, evento: string, detalhe?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.ordemServico.update({ where: { id: os.id }, data: { status } });
      await this.registrar(tx, s.tenantId, os.id, status, evento, s.id, detalhe);
    });
    return this.detalhe(s.tenantId, os.id);
  }

  private registrar(db: Db, tenantId: string, osId: string, status: StatusOs, evento: string, usuarioId?: string, detalhe?: string) {
    return db.osHistorico.create({ data: { tenantId, osId, status, evento, usuarioId, detalhe } });
  }

  private async fecharApontamentos(tx: Db, os: OsCompleta, agora: Date) {
    for (const a of os.operacoes.flatMap((o) => o.apontamentos).filter((a) => !a.fim)) {
      await tx.apontamento.update({ where: { id: a.id }, data: { fim: agora, horas: pd(horasEntre(a.inicio, agora)) } });
    }
  }

  private async fecharOcorrencias(tx: Db, os: OsCompleta, agora: Date) {
    for (const o of os.ocorrencias) {
      await tx.ocorrencia.update({ where: { id: o.id }, data: { fim: agora, horas: pd(horasEntre(o.inicio, agora)) } });
    }
  }

  private conferirJustificativa(descricao: string, orcado: string, real: string | null, justificativa?: string) {
    if (exigeJustificativa(orcado, real) && !justificativa?.trim()) {
      throw regra(
        'JUSTIFICATIVA_OBRIGATORIA',
        `O real de "${descricao}" (R$ ${reais(real!).replace('.', ',')}) passou do orçado (R$ ${reais(orcado).replace('.', ',')}) em mais de 20%. Escreva uma justificativa para registrar o desvio.`,
        { orcado, real }
      );
    }
  }

  private custoHora(tabela: ReturnType<typeof resultadoDe>, centroId: string, descricao: string) {
    const c = tabela.centros.find((c) => c.id === centroId);
    if (!c) {
      throw regra(
        'CENTRO_FORA_DA_TABELA',
        `O centro escolhido para "${descricao}" não está na Tabela de Custos desta OS, então não há custo-hora para ele. Escolha outro centro.`,
        { centroId }
      );
    }
    return c.cheioHora;
  }

  private async habilitado(tenantId: string, centroId: string, colaboradorId: string) {
    const alocacao = await this.prisma.centroOperador.findFirst({ where: { tenantId, centroId, colaboradorId, alocacao: { gt: 0 } } });
    if (!alocacao) {
      const [colaborador, centro] = await Promise.all([
        this.prisma.colaborador.findFirst({ where: { id: colaboradorId, tenantId } }),
        this.prisma.centroTrabalho.findFirst({ where: { id: centroId, tenantId } })
      ]);
      if (!colaborador) throw naoEncontrado('esse colaborador');
      if (!centro) throw naoEncontrado('esse centro de trabalho');
      throw regra(
        'NAO_HABILITADO',
        `${colaborador.nome} não está alocado em ${centro.nome}, então não pode apontar nessa operação. Aloque o colaborador no centro ou escolha outro operador.`,
        { colaboradorId, centroId }
      );
    }
  }

  private async clienteApto(tenantId: string, clienteId: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!c) throw naoEncontrado('esse cliente');
    if (c.status !== 'ATIVO') {
      throw conflito(
        c.status === 'BLOQUEADO' ? 'CLIENTE_BLOQUEADO' : 'CLIENTE_INATIVO',
        `${c.nome} está ${c.status === 'BLOQUEADO' ? 'bloqueado' : 'inativo'} e não pode receber nova OS. Regularize o cadastro antes.`
      );
    }
  }

  private async prazoPadrao() {
    const d = hoje();
    d.setUTCDate(d.getUTCDate() + 10);
    return d;
  }

  private operacao(os: OsCompleta, opId: string) {
    const op = os.operacoes.find((o) => o.id === opId);
    if (!op) throw naoEncontrado('essa operação nesta OS');
    return op;
  }

  private async operacaoNaoIniciada(tenantId: string, id: string, opId: string, acao: string) {
    const os = await this.naoEncerrada(tenantId, id, `${acao} operações de`);
    const op = this.operacao(os, opId);
    if (op.status !== 'PENDENTE' || op.apontamentos.length) {
      throw conflito('OPERACAO_INICIADA', `${op.descricao} já tem apontamentos, então não pode mais ser alterada ou removida. Inclua uma nova operação com justificativa.`);
    }
    return { os, op };
  }

  private async custo(tenantId: string, osId: string, custoId: string) {
    const c = await this.prisma.osCusto.findFirst({ where: { id: custoId, osId, tenantId } });
    if (!c) throw naoEncontrado('esse custo nesta OS');
    return c;
  }

  private async naoEncerrada(tenantId: string, id: string, acao: string) {
    const os = await this.buscar(tenantId, id);
    if (ENCERRADAS.includes(os.status)) {
      throw conflito('OS_ENCERRADA', `Não dá para ${acao} esta OS porque ela está ${ROTULO[os.status]}. Ordens entregues ou canceladas ficam como registro.`);
    }
    return os;
  }

  private async emStatus(tenantId: string, id: string, permitidos: StatusOs[], acao: string) {
    const os = await this.buscar(tenantId, id);
    if (!permitidos.includes(os.status)) {
      throw conflito(
        'STATUS_INVALIDO',
        `Não dá para ${acao} esta OS porque ela está ${ROTULO[os.status]}.${DICA[os.status] ?? ` Isso só é possível quando ela está ${permitidos.map((p) => ROTULO[p]).join(' ou ')}.`}`,
        { status: os.status, permitidos }
      );
    }
    return os;
  }

  private async buscar(tenantId: string, id: string) {
    const os = await this.prisma.ordemServico.findFirst({ where: { id, tenantId }, include: incluirOs });
    if (!os) throw naoEncontrado('essa ordem de serviço');
    return os;
  }
}
