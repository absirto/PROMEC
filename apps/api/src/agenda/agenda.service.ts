import { Injectable } from '@nestjs/common';
import { Prisma, StatusAgendamento } from '@prisma/client';
import { calcularTabelaCustos } from '@promec/motor';
import { pd, tt } from '../comum/decimal';
import { somenteDigitos } from '../comum/documento';
import { conflito, invalido, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { proximoNumero } from '../orcamentos/numeracao';
import { mesclarObjeto } from '../ordens/custo';
import { conferirColaboradorNoDia } from '../rh/rh-core';
import { planoDoSegmento } from '../qualidade/qualidade-core';
import { ParametrosService } from '../parametros/parametros.service';
import { dataBanco, diaDaSemana, hojeLocal, inicioDoDia, lerHorario, local, somarDias } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { buscarVigente, json, montarEntrada, resultadoDe } from '../tabelas-custos/entrada';
import { semVigente } from '../tabelas-custos/tabelas.service';
import { AgendamentoDto, AtualizarAgendamentoDto } from './agenda.dto';

const HORA = 3_600_000;
const ABRE = 8 * 60;
const FECHA = 18 * 60;
const OCUPAM: StatusAgendamento[] = ['MARCADO', 'CONFIRMADO', 'CHEGOU'];
const PENDENTES: StatusAgendamento[] = ['MARCADO', 'CONFIRMADO'];
const ROTULO: Record<StatusAgendamento, string> = {
  MARCADO: 'marcado',
  CONFIRMADO: 'confirmado',
  CHEGOU: 'com o cliente já atendido',
  NAO_VEIO: 'marcado como não compareceu',
  CANCELADO: 'cancelado'
};

const incluir = {
  cliente: { select: { id: true, nome: true } },
  centro: { select: { nome: true } },
  colaborador: { select: { nome: true } }
} satisfies Prisma.AgendamentoInclude;
type AgendamentoCompleto = Prisma.AgendamentoGetPayload<{ include: typeof incluir }>;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const dataBr = (s: string) => s.split('-').reverse().join('/');

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService
  ) {}

  async listar(tenantId: string, filtro: { de?: string; ate?: string; centroId?: string }) {
    const de = filtro.de?.slice(0, 10) ?? hojeLocal();
    const ate = filtro.ate?.slice(0, 10) ?? somarDias(de, 6);
    const itens = await this.prisma.agendamento.findMany({
      where: {
        tenantId,
        inicio: { gte: inicioDoDia(de), lt: inicioDoDia(somarDias(ate, 1)) },
        ...(filtro.centroId ? { centroId: filtro.centroId } : {})
      },
      include: incluir,
      orderBy: { inicio: 'asc' }
    });
    return { itens: itens.map(saida), total: itens.length };
  }

  async criar(tenantId: string, dto: AgendamentoDto) {
    if (!dto.clienteId && !dto.nomeCliente?.trim()) {
      throw invalido('Informe o cliente cadastrado ou ao menos o nome de quem vai trazer o veículo.', [{ campo: 'nomeCliente', mensagem: 'nomeCliente é obrigatório sem clienteId' }]);
    }
    if (dto.clienteId) await this.cliente(tenantId, dto.clienteId);
    const inicio = this.horario(dto.inicio);
    await this.validar(tenantId, { centroId: dto.centroId, colaboradorId: dto.colaboradorId ?? null, inicio, duracaoHoras: String(dto.duracaoHoras) });
    const a = await this.prisma.agendamento.create({
      data: {
        tenantId,
        clienteId: dto.clienteId ?? null,
        nomeCliente: dto.nomeCliente?.trim() || null,
        telefone: dto.telefone ? somenteDigitos(dto.telefone) : null,
        placa: placa(dto.placa),
        veiculo: dto.veiculo?.trim() || null,
        servico: dto.servico.trim(),
        centroId: dto.centroId,
        colaboradorId: dto.colaboradorId ?? null,
        inicio,
        duracaoHoras: pd(dto.duracaoHoras),
        observacao: dto.observacao?.trim() || null
      }
    });
    return this.detalhe(tenantId, a.id);
  }

  async atualizar(tenantId: string, id: string, dto: AtualizarAgendamentoDto) {
    const a = await this.emStatus(tenantId, id, PENDENTES, 'reagendar');
    if (dto.clienteId) await this.cliente(tenantId, dto.clienteId);
    const inicio = dto.inicio ? this.horario(dto.inicio) : a.inicio;
    const centroId = dto.centroId ?? a.centroId;
    const colaboradorId = dto.colaboradorId === undefined ? a.colaboradorId : dto.colaboradorId;
    const duracaoHoras = dto.duracaoHoras !== undefined ? String(dto.duracaoHoras) : tt(a.duracaoHoras);
    await this.validar(tenantId, { centroId, colaboradorId, inicio, duracaoHoras }, id);
    await this.prisma.agendamento.update({
      where: { id },
      data: {
        clienteId: dto.clienteId,
        nomeCliente: dto.nomeCliente?.trim(),
        telefone: dto.telefone !== undefined ? somenteDigitos(dto.telefone) : undefined,
        placa: dto.placa !== undefined ? placa(dto.placa) : undefined,
        veiculo: dto.veiculo?.trim(),
        servico: dto.servico?.trim(),
        centroId,
        colaboradorId,
        inicio,
        duracaoHoras: pd(duracaoHoras),
        observacao: dto.observacao?.trim()
      }
    });
    return this.detalhe(tenantId, id);
  }

  async mudar(tenantId: string, id: string, status: StatusAgendamento) {
    const acao = { CONFIRMADO: 'confirmar', NAO_VEIO: 'marcar falta em', CANCELADO: 'cancelar' }[status as 'CONFIRMADO'] ?? 'alterar';
    await this.emStatus(tenantId, id, status === 'CONFIRMADO' ? ['MARCADO'] : PENDENTES, acao);
    await this.prisma.agendamento.update({ where: { id }, data: { status } });
    return this.detalhe(tenantId, id);
  }

  async chegou(s: Sessao, id: string, abrirOs?: boolean) {
    const a = await this.emStatus(s.tenantId, id, PENDENTES, 'registrar a chegada de');
    if (!abrirOs) {
      await this.prisma.agendamento.update({ where: { id }, data: { status: 'CHEGOU' } });
      return this.detalhe(s.tenantId, id);
    }
    if (!a.clienteId) {
      throw regra('CLIENTE_OBRIGATORIO', `Para abrir a OS, ${a.nomeCliente ?? 'o cliente'} precisa estar cadastrado. Cadastre o cliente, vincule ao agendamento e registre a chegada de novo.`);
    }
    const [vigente, p] = await Promise.all([buscarVigente(this.prisma, s.tenantId), this.parametros.carregar(s.tenantId)]);
    if (!vigente) throw semVigente(422);
    const custoHora =
      resultadoDe(vigente).centros.find((c) => c.id === a.centroId)?.cheioHora ??
      calcularTabelaCustos(await montarEntrada(this.prisma, s.tenantId, vigente.competencia)).centros.find((c) => c.id === a.centroId)?.cheioHora ??
      '0';
    await this.prisma.$transaction(async (tx) => {
      const os = await tx.ordemServico.create({
        data: {
          tenantId: s.tenantId,
          numero: await proximoNumero(tx, s.tenantId, 'OS'),
          ...(await planoDoSegmento(tx, s.tenantId, 'OFICINA')),
          clienteId: a.clienteId!,
          tabelaCustosId: vigente.id,
          titulo: a.servico,
          segmento: 'OFICINA',
          lote: 1,
          prazo: dataBanco(local(new Date(a.inicio.getTime() + Number(tt(a.duracaoHoras)) * HORA)).data),
          objeto: json(mesclarObjeto({}, { placa: a.placa, veiculo: a.veiculo })),
          observacoes: a.observacao ?? '',
          precoFinalLote: pd(0),
          impostos: p.impostosPadrao,
          comissao: p.comissaoPadrao,
          margemMinima: p.margemMinima,
          operacoes: {
            create: [
              {
                tenantId: s.tenantId,
                sequencia: 10,
                descricao: a.servico,
                centroId: a.centroId,
                colaboradorId: a.colaboradorId,
                custoHora: pd(custoHora),
                setupOrcadoHoras: a.duracaoHoras,
                cicloOrcadoHorasPorPeca: pd(0)
              }
            ]
          }
        }
      });
      await tx.osHistorico.create({
        data: { tenantId: s.tenantId, osId: os.id, status: 'ABERTA', evento: 'criada', usuarioId: s.id, detalhe: `Aberta na chegada do agendamento${a.placa ? ` (${a.placa})` : ''}` }
      });
      await tx.agendamento.update({ where: { id }, data: { status: 'CHEGOU', osId: os.id } });
    });
    return this.detalhe(s.tenantId, id);
  }

  async detalhe(tenantId: string, id: string) {
    return saida(await this.buscar(tenantId, id));
  }

  private horario(s: string) {
    const d = lerHorario(s);
    if (Number.isNaN(d.getTime())) throw invalido('O início precisa ser data e hora, por exemplo 2026-10-21T09:00.', [{ campo: 'inicio', mensagem: 'inicio inválido' }]);
    return d;
  }

  private async validar(tenantId: string, a: { centroId: string; colaboradorId: string | null; inicio: Date; duracaoHoras: string }, excetoId?: string) {
    const centro = await this.prisma.centroTrabalho.findFirst({ where: { id: a.centroId, tenantId } });
    if (!centro) throw naoEncontrado('esse box ou centro de trabalho');
    if (a.colaboradorId) {
      const colaborador = await this.prisma.colaborador.findFirst({ where: { id: a.colaboradorId, tenantId } });
      if (!colaborador) throw naoEncontrado('esse mecânico');
      const alocado = await this.prisma.centroOperador.findFirst({ where: { tenantId, centroId: centro.id, colaboradorId: colaborador.id, alocacao: { gt: 0 } } });
      if (!alocado) {
        throw regra('NAO_HABILITADO', `${colaborador.nome} não está alocado em ${centro.nome}. Escolha um mecânico do box ou aloque-o no centro antes de agendar.`, {
          colaboradorId: colaborador.id,
          centroId: centro.id
        });
      }
    }
    const horas = Number(a.duracaoHoras);
    if (!(horas > 0)) throw invalido('A duração precisa ser maior que zero.', [{ campo: 'duracaoHoras', mensagem: 'duracaoHoras precisa ser maior que zero' }]);
    const fim = new Date(a.inicio.getTime() + horas * HORA);
    const ini = local(a.inicio);
    const fl = local(fim);
    const fora = (motivo: string) =>
      regra('FORA_DO_EXPEDIENTE', `${motivo} Escolha outro horário entre 08:00 e 18:00 num dia de trabalho do ${centro.nome}.`, { data: ini.data });
    if (ini.minutos < ABRE || fl.data !== ini.data || fl.minutos > FECHA) {
      throw fora(`O horário das ${hhmm(ini.minutos)} às ${hhmm(fl.data === ini.data ? fl.minutos : 24 * 60)} sai do expediente da agenda.`);
    }
    if (!centro.diasSemana.includes(diaDaSemana(ini.data))) throw fora(`${centro.nome} não trabalha em ${dataBr(ini.data)}.`);
    const [feriado, parada] = await Promise.all([
      this.prisma.feriado.findFirst({ where: { tenantId, data: dataBanco(ini.data) } }),
      this.prisma.paradaCentro.findFirst({ where: { tenantId, centroId: centro.id, inicio: { lte: dataBanco(ini.data) }, OR: [{ fim: null }, { fim: { gte: dataBanco(ini.data) } }] } })
    ]);
    if (feriado) throw fora(`${dataBr(ini.data)} é feriado (${feriado.descricao}).`);
    if (parada) throw fora(`${centro.nome} está parado em ${dataBr(ini.data)} (${parada.motivo}).`);
    if (a.colaboradorId) await conferirColaboradorNoDia(this.prisma, tenantId, a.colaboradorId, centro.id, ini.data);

    const candidatos = await this.prisma.agendamento.findMany({
      where: {
        tenantId,
        status: { in: OCUPAM },
        ...(excetoId ? { id: { not: excetoId } } : {}),
        OR: [{ centroId: centro.id }, ...(a.colaboradorId ? [{ colaboradorId: a.colaboradorId }] : [])],
        inicio: { lt: fim, gte: new Date(a.inicio.getTime() - 24 * HORA) }
      },
      include: incluir
    });
    const choque = candidatos.find((c) => c.inicio.getTime() + Number(tt(c.duracaoHoras)) * HORA > a.inicio.getTime());
    if (choque) {
      const quem = choque.centroId === centro.id ? choque.centro.nome : (choque.colaborador?.nome ?? 'o mecânico');
      const li = local(choque.inicio).minutos;
      throw conflito(
        'HORARIO_OCUPADO',
        `${quem} já tem ${choque.servico} das ${hhmm(li)} às ${hhmm(li + Math.round(Number(tt(choque.duracaoHoras)) * 60))}. Escolha outro horário ou outro box.`,
        { agendamentoId: choque.id }
      );
    }
  }

  private async cliente(tenantId: string, id: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('esse cliente');
    return c;
  }

  private async emStatus(tenantId: string, id: string, permitidos: StatusAgendamento[], acao: string) {
    const a = await this.buscar(tenantId, id);
    if (!permitidos.includes(a.status)) {
      throw conflito('STATUS_INVALIDO', `Não dá para ${acao} este agendamento porque ele está ${ROTULO[a.status]}.`, { status: a.status, permitidos });
    }
    return a;
  }

  private async buscar(tenantId: string, id: string) {
    const a = await this.prisma.agendamento.findFirst({ where: { id, tenantId }, include: incluir });
    if (!a) throw naoEncontrado('esse agendamento');
    return a;
  }
}

const placa = (p?: string) => (p ? p.toUpperCase().replace(/[^A-Z0-9]/g, '') || null : null);

function saida(a: AgendamentoCompleto) {
  return {
    id: a.id,
    cliente: { id: a.cliente?.id ?? null, nome: a.cliente?.nome ?? a.nomeCliente ?? '' },
    telefone: a.telefone,
    placa: a.placa,
    veiculo: a.veiculo,
    servico: a.servico,
    centroId: a.centroId,
    centroNome: a.centro.nome,
    colaboradorId: a.colaboradorId,
    colaboradorNome: a.colaborador?.nome ?? null,
    inicio: a.inicio,
    duracaoHoras: tt(a.duracaoHoras),
    status: a.status,
    osId: a.osId,
    observacao: a.observacao
  };
}
