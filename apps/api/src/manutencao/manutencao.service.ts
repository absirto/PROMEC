import { Injectable } from '@nestjs/common';
import { CustoManutencao, OrdemManutencao, PlanoManutencao, Prisma } from '@prisma/client';
import { compararSubstituicao, dec, indicadoresManutencao, mediaMovel, soma, txt } from '@promec/motor';
import { pd, RE_COMPETENCIA, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { criarTitulos, prazosDe } from '../financeiro/financeiro-core';
import { notificar } from '../notificacoes/notificacoes-core';
import { horasEntre } from '../ordens/custo';
import { OrdensService } from '../ordens/ordens.service';
import { dataBanco, hojeLocal, inicioDoDia, lerHorario, local, somarDias, textoData } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { custoDoColaborador } from '../rh/rh-core';
import { horasReaisDoCentro, ultimasCompetencias } from '../rh/rh.service';
import { buscarItem, conferirSaida, localPreferido, movimentar } from '../suprimentos/estoque-core';
import { buscarVigente, Db, json, marcarDesatualizada, resultadoDe } from '../tabelas-custos/entrada';
import { ABERTAS, criarOrdem, custoManutencaoPorMes, situacaoDoPlano } from './manutencao-core';
import { AceitarPropostaDto, AtualizarOrdemDto, AtualizarPlanoDto, ConcluirOrdemDto, CustoOrdemDto, OrdemDto, PlanoDto, QuebraDto } from './manutencao.dto';

const LIMITE_CATEGORIA = '1.3';

@Injectable()
export class ManutencaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordens: OrdensService
  ) {}

  // Planos

  async planos(tenantId: string, centroId?: string) {
    const ps = await this.prisma.planoManutencao.findMany({ where: { tenantId, ...(centroId ? { centroId } : {}) }, orderBy: { criadoEm: 'asc' } });
    const itens = await Promise.all(ps.map((p) => this.saidaPlano(tenantId, p)));
    return { itens, total: itens.length };
  }

  async criarPlano(tenantId: string, dto: PlanoDto) {
    await this.centro(tenantId, dto.centroId);
    this.conferirPlano(dto.tipo, dto.intervaloHoras, dto.intervaloDias);
    const p = await this.prisma.planoManutencao.create({
      data: {
        tenantId,
        centroId: dto.centroId,
        nome: dto.nome.trim(),
        tipo: dto.tipo,
        intervaloHoras: dto.intervaloHoras !== undefined ? pd(dto.intervaloHoras) : null,
        intervaloDias: dto.intervaloDias ?? null,
        duracaoHoras: pd(dto.duracaoHoras ?? 4),
        checklist: dto.checklist ?? [],
        ultimaExecucao: dto.ultimaExecucao ? dataBanco(dto.ultimaExecucao) : null,
        contadorDesde: dto.ultimaExecucao ? inicioDoDia(dto.ultimaExecucao.slice(0, 10)) : new Date(),
        ativo: dto.ativo ?? true
      }
    });
    return this.saidaPlano(tenantId, p);
  }

  async atualizarPlano(tenantId: string, id: string, dto: AtualizarPlanoDto) {
    const p = await this.plano(tenantId, id);
    this.conferirPlano(dto.tipo ?? (p.tipo as 'HORAS'), dto.intervaloHoras ?? (p.intervaloHoras ? tt(p.intervaloHoras) : undefined), dto.intervaloDias ?? p.intervaloDias ?? undefined);
    const novo = await this.prisma.planoManutencao.update({
      where: { id },
      data: {
        nome: dto.nome?.trim(),
        tipo: dto.tipo,
        intervaloHoras: dto.intervaloHoras !== undefined ? pd(dto.intervaloHoras) : undefined,
        intervaloDias: dto.intervaloDias,
        duracaoHoras: dto.duracaoHoras !== undefined ? pd(dto.duracaoHoras) : undefined,
        checklist: dto.checklist,
        ultimaExecucao: dto.ultimaExecucao ? dataBanco(dto.ultimaExecucao) : undefined,
        ...(dto.ultimaExecucao ? { contadorDesde: inicioDoDia(dto.ultimaExecucao.slice(0, 10)), horasAjuste: pd(0) } : {}),
        ativo: dto.ativo
      }
    });
    return this.saidaPlano(tenantId, novo);
  }

  // Ordens

  async listarOrdens(tenantId: string, f: { status?: string; centroId?: string; tipo?: string }) {
    const os = await this.prisma.ordemManutencao.findMany({
      where: { tenantId, ...(f.status ? { status: f.status } : {}), ...(f.centroId ? { centroId: f.centroId } : {}), ...(f.tipo ? { tipo: f.tipo } : {}) },
      include: { custos: { orderBy: { data: 'asc' } } },
      orderBy: [{ criadoEm: 'desc' }]
    });
    const itens = await this.saidaOrdens(tenantId, os);
    return { itens, total: itens.length };
  }

  async ordem(tenantId: string, id: string) {
    return (await this.saidaOrdens(tenantId, [await this.buscarOrdem(tenantId, id)]))[0];
  }

  async criarOrdem(tenantId: string, dto: OrdemDto) {
    await this.centro(tenantId, dto.centroId);
    if (dto.planoId) await this.plano(tenantId, dto.planoId);
    if (dto.fornecedorId && !(await this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, tenantId } }))) throw naoEncontrado('esse fornecedor');
    if (dto.bloqueiaAgenda && !dto.prevista) throw invalido('Para bloquear a agenda, informe a data prevista da manutenção.', [{ campo: 'prevista', mensagem: 'prevista é obrigatória com bloqueiaAgenda' }]);
    const o = await this.prisma.$transaction((tx) =>
      criarOrdem(tx, tenantId, {
        centroId: dto.centroId,
        tipo: dto.tipo,
        origem: dto.planoId ? 'PLANO' : 'MANUAL',
        planoId: dto.planoId,
        execucao: dto.execucao,
        fornecedorId: dto.fornecedorId,
        descricao: dto.descricao.trim(),
        prevista: dto.prevista?.slice(0, 10),
        bloqueiaAgenda: dto.bloqueiaAgenda
      })
    );
    return this.ordem(tenantId, o.id);
  }

  async atualizarOrdem(tenantId: string, id: string, dto: AtualizarOrdemDto) {
    const o = await this.ordemAberta(tenantId, id, 'alterar');
    if (dto.fornecedorId && !(await this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, tenantId } }))) throw naoEncontrado('esse fornecedor');
    const prevista = dto.prevista?.slice(0, 10) ?? (o.prevista ? textoData(o.prevista) : null);
    const bloqueia = dto.bloqueiaAgenda ?? o.bloqueiaAgenda;
    await this.prisma.$transaction(async (tx) => {
      let paradaId = o.paradaId;
      if (paradaId && (!bloqueia || !prevista)) {
        await tx.paradaCentro.deleteMany({ where: { id: paradaId } });
        paradaId = null;
      } else if (bloqueia && prevista) {
        if (paradaId) await tx.paradaCentro.update({ where: { id: paradaId }, data: { inicio: dataBanco(prevista), fim: dataBanco(prevista) } });
        else paradaId = (await tx.paradaCentro.create({ data: { tenantId, centroId: o.centroId, inicio: dataBanco(prevista), fim: dataBanco(prevista), motivo: `${o.numero} · ${dto.descricao ?? o.descricao}`, ordemManutencaoId: o.id } })).id;
      }
      await tx.ordemManutencao.update({
        where: { id },
        data: { descricao: dto.descricao?.trim(), prevista: prevista ? dataBanco(prevista) : null, execucao: dto.execucao, fornecedorId: dto.fornecedorId, bloqueiaAgenda: bloqueia, paradaId }
      });
    });
    return this.ordem(tenantId, id);
  }

  async iniciar(tenantId: string, id: string) {
    const o = await this.buscarOrdem(tenantId, id);
    if (o.status !== 'ABERTA') throw conflito('STATUS_INVALIDO', `${o.numero} não está aberta; ela está ${o.status.toLowerCase().replace('_', ' ')}.`);
    await this.prisma.ordemManutencao.update({ where: { id }, data: { status: 'EM_EXECUCAO', inicio: new Date() } });
    return this.ordem(tenantId, id);
  }

  async concluir(tenantId: string, id: string, dto: ConcluirOrdemDto) {
    const o = await this.ordemAberta(tenantId, id, 'concluir');
    const fim = new Date();
    const horasParado = dto.horasParado !== undefined ? String(dto.horasParado) : o.tipo === 'CORRETIVA' && o.inicio ? horasEntre(o.inicio, fim) : null;
    const hoje = hojeLocal();
    await this.prisma.$transaction(async (tx) => {
      await tx.ordemManutencao.update({
        where: { id },
        data: { status: 'CONCLUIDA', inicio: o.inicio ?? fim, fim, horasParado: horasParado !== null ? pd(horasParado) : null, checklist: json(dto.checklist ?? []), observacao: dto.observacao ?? null }
      });
      if (o.paradaId) await tx.paradaCentro.updateMany({ where: { id: o.paradaId, fim: null }, data: { fim: dataBanco(hoje) } });
      if (o.planoId) await tx.planoManutencao.update({ where: { id: o.planoId }, data: { ultimaExecucao: dataBanco(hoje), contadorDesde: fim, horasAjuste: pd(0) } });
    });
    return this.ordem(tenantId, id);
  }

  async cancelar(tenantId: string, id: string, motivo: string) {
    const o = await this.ordemAberta(tenantId, id, 'cancelar');
    if (o.custos.some((c) => c.tituloId || c.movimentoId)) {
      throw conflito('ORDEM_COM_CUSTOS', `${o.numero} já tem peças baixadas ou serviço de terceiro lançado. Remova os custos antes de cancelar.`);
    }
    const hoje = hojeLocal();
    await this.prisma.$transaction(async (tx) => {
      if (o.paradaId) {
        await tx.paradaCentro.deleteMany({ where: { id: o.paradaId, inicio: { gt: dataBanco(hoje) } } });
        await tx.paradaCentro.updateMany({ where: { id: o.paradaId, OR: [{ fim: null }, { fim: { gt: dataBanco(hoje) } }] }, data: { fim: dataBanco(hoje) } });
      }
      await tx.ordemManutencao.update({ where: { id }, data: { status: 'CANCELADA', motivoCancelamento: motivo.trim(), fim: new Date() } });
    });
    return this.ordem(tenantId, id);
  }

  async incluirCusto(s: Sessao, id: string, dto: CustoOrdemDto) {
    const o = await this.buscarOrdem(s.tenantId, id);
    if (o.status === 'CANCELADA') throw conflito('STATUS_INVALIDO', `${o.numero} foi cancelada; não recebe custos.`);
    await this.prisma.$transaction(async (tx) => {
      if (dto.tipo === 'PECA') {
        if (!dto.itemId || dto.quantidade === undefined) throw invalido('Para peça, informe o item e a quantidade.', [{ campo: 'itemId', mensagem: 'itemId e quantidade são obrigatórios' }]);
        const item = await buscarItem(tx, s.tenantId, dto.itemId);
        const q = dec(dto.quantidade);
        if (q.lte(0)) throw invalido('A quantidade precisa ser maior que zero.');
        const localId = dto.localId ?? (await localPreferido(tx, s.tenantId, item.id));
        if (!localId) throw regra('SALDO_INSUFICIENTE', `Não há saldo de ${item.descricao} em nenhum local.`);
        await conferirSaida(tx, { tenantId: s.tenantId, item, localId, quantidade: q, loteId: dto.loteId });
        const mov = await movimentar(tx, {
          tenantId: s.tenantId,
          tipo: 'SAIDA_CENTRO',
          item,
          localId,
          quantidade: q.neg(),
          custoUnitario: tt(item.custoMedio),
          loteId: dto.loteId,
          centroId: o.centroId,
          usuarioId: s.id,
          observacao: `${o.numero} · manutenção`
        });
        await tx.movimento.update({ where: { id: mov.id }, data: { ordemManutencaoId: o.id } });
        await tx.custoManutencao.create({
          data: { tenantId: s.tenantId, ordemId: o.id, tipo: 'PECA', descricao: dto.descricao?.trim() || item.descricao, itemId: item.id, quantidade: pd(txt(q)), valor: pd(q.times(tt(item.custoMedio)).toFixed(2)), movimentoId: mov.id }
        });
      } else if (dto.tipo === 'MAO_DE_OBRA') {
        if (!dto.colaboradorId || dto.horas === undefined) throw invalido('Para mão de obra, informe o colaborador e as horas.', [{ campo: 'colaboradorId', mensagem: 'colaboradorId e horas são obrigatórios' }]);
        const c = await tx.colaborador.findFirst({ where: { id: dto.colaboradorId, tenantId: s.tenantId } });
        if (!c) throw naoEncontrado('esse colaborador');
        const custo = await custoDoColaborador(tx, s.tenantId, c);
        if (!custo.custoHora) throw regra('SEM_HORAS_DISPONIVEIS', `${c.nome} não tem horas disponíveis neste mês para calcular o custo-hora.`);
        await tx.custoManutencao.create({
          data: { tenantId: s.tenantId, ordemId: o.id, tipo: 'MAO_DE_OBRA', descricao: dto.descricao?.trim() || `Mão de obra — ${c.nome}`, colaboradorId: c.id, horas: pd(dto.horas), valor: pd(dec(custo.custoHora).times(dto.horas).toFixed(2)) }
        });
      } else {
        if (dto.valor === undefined) throw invalido('Para serviço de terceiro, informe o valor.', [{ campo: 'valor', mensagem: 'valor é obrigatório' }]);
        const fornecedorId = dto.fornecedorId ?? o.fornecedorId;
        const f = fornecedorId ? await tx.fornecedor.findFirst({ where: { id: fornecedorId, tenantId: s.tenantId } }) : null;
        if (fornecedorId && !f) throw naoEncontrado('esse fornecedor');
        let tituloId: string | null = null;
        if (f) {
          const centro = await this.centroCustoManutencao(tx, s.tenantId, o.centroId);
          const hoje = hojeLocal();
          let prazo = 0;
          try {
            prazo = prazosDe(f.condicaoPagamento || 'à vista')[0];
          } catch {
            prazo = 0;
          }
          const [t] = await criarTitulos(
            tx,
            s.tenantId,
            {
              tipo: 'PAGAR',
              pessoaTipo: 'FORNECEDOR',
              fornecedorId: f.id,
              pessoaNome: f.fantasia || f.nome,
              descricao: `${o.numero} · ${dto.descricao?.trim() || 'Serviço de manutenção'}`,
              centroCustoId: centro.id,
              competencia: hoje.slice(0, 7),
              origemTipo: 'MANUTENCAO',
              origemId: o.id,
              origemNumero: o.numero
            },
            [{ vencimento: dto.vencimento?.slice(0, 10) ?? somarDias(hoje, prazo), valor: dec(dto.valor).toFixed(2) }],
            s.id
          );
          tituloId = t.id;
        }
        await tx.custoManutencao.create({
          data: { tenantId: s.tenantId, ordemId: o.id, tipo: 'TERCEIRO', descricao: dto.descricao?.trim() || 'Serviço de terceiro', fornecedorId: f?.id ?? null, valor: pd(dec(dto.valor).toFixed(2)), tituloId }
        });
      }
    });
    return this.ordem(s.tenantId, id);
  }

  async removerCusto(s: Sessao, id: string, custoId: string) {
    const o = await this.buscarOrdem(s.tenantId, id);
    const c = o.custos.find((x) => x.id === custoId);
    if (!c) throw naoEncontrado('esse custo nesta ordem');
    await this.prisma.$transaction(async (tx) => {
      if (c.movimentoId) {
        const m = await tx.movimento.findUniqueOrThrow({ where: { id: c.movimentoId } });
        const item = await buscarItem(tx, s.tenantId, m.itemId);
        await movimentar(tx, { tenantId: s.tenantId, tipo: 'DEVOLUCAO', item, localId: m.localId, quantidade: dec(tt(m.quantidade)).neg(), custoUnitario: tt(m.custoUnitario), loteId: m.loteId, usuarioId: s.id, observacao: `Estorno de peça da ${o.numero}` });
        await tx.movimento.update({ where: { id: m.id }, data: { estornado: true } });
      }
      if (c.tituloId) {
        const t = await tx.titulo.findUniqueOrThrow({ where: { id: c.tituloId }, include: { baixas: { where: { estornada: false } } } });
        if (t.baixas.length) throw conflito('TITULO_COM_BAIXA', `O título ${t.numero} desse serviço já foi pago. Estorne a baixa no Financeiro antes de remover o custo.`);
        await tx.titulo.update({ where: { id: t.id }, data: { status: 'CANCELADO', motivoCancelamento: `Custo removido da ${o.numero}` } });
      }
      await tx.custoManutencao.delete({ where: { id: c.id } });
    });
    return this.ordem(s.tenantId, id);
  }

  async quebra(s: Sessao, dto: QuebraDto) {
    const centro = await this.centro(s.tenantId, dto.centroId);
    const inicio = dto.inicio ? lerHorario(dto.inicio) : new Date();
    if (Number.isNaN(inicio.getTime())) throw invalido('O início da quebra precisa ser data e hora.');
    const o = await this.prisma.$transaction(async (tx) => {
      const ordem = await criarOrdem(tx, s.tenantId, { centroId: centro.id, tipo: 'CORRETIVA', origem: 'QUEBRA', descricao: dto.descricao.trim(), status: 'EM_EXECUCAO', inicio });
      const parada = await tx.paradaCentro.create({
        data: { tenantId: s.tenantId, centroId: centro.id, inicio: dataBanco(local(inicio).data), fim: null, motivo: `Quebra · ${ordem.numero} · ${dto.descricao.trim()}`, ordemManutencaoId: ordem.id }
      });
      return tx.ordemManutencao.update({ where: { id: ordem.id }, data: { paradaId: parada.id } });
    });
    const afetadas = await this.prisma.ordemServico.findMany({
      where: { tenantId: s.tenantId, status: 'EM_EXECUCAO', operacoes: { some: { centroId: centro.id, OR: [{ status: 'EM_ANDAMENTO' }, { apontamentos: { some: { fim: null } } }] } } },
      select: { id: true, numero: true }
    });
    for (const os of afetadas) await this.ordens.pausar(s, os.id, { motivo: 'QUEBRA', observacao: `${centro.nome}: ${dto.descricao.trim()} (${o.numero})` });
    await this.prisma.ordemManutencao.update({ where: { id: o.id }, data: { osAfetadas: json(afetadas) } });
    await notificar(this.prisma, s.tenantId, {
      permissoes: ['manutencao.visualizar', 'os.visualizar'],
      tipo: 'ERRO',
      titulo: `Quebra no ${centro.nome}`,
      mensagem: `${dto.descricao.trim()}. ${afetadas.length ? `${afetadas.map((a) => a.numero).join(', ')} pausada(s) por quebra.` : 'Nenhuma OS estava rodando no centro.'} Corretiva ${o.numero} aberta.`,
      link: `/manutencao/ordens/${o.id}`,
      chave: `quebra-${o.id}`
    });
    return this.ordem(s.tenantId, o.id);
  }

  // Indicadores e proposta

  async indicadores(tenantId: string, centroId: string | undefined, meses: number) {
    const centros = await this.prisma.centroTrabalho.findMany({ where: { tenantId, status: { not: 'desativado' } }, orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }] });
    const competencias = ultimasCompetencias(meses);
    const doze = ultimasCompetencias(12);
    const desde = inicioDoDia(`${competencias[0]}-01`);
    const vigente = await buscarVigente(this.prisma, tenantId);
    const tabela = vigente ? resultadoDe(vigente) : null;
    const base = await Promise.all(
      centros.map(async (c) => {
        const serie = await custoManutencaoPorMes(this.prisma, tenantId, c.id, doze);
        const valores = doze.map((x) => serie.get(x)!.toFixed(2));
        return { c, serie, media6: mediaMovel(valores, 6), media12: mediaMovel(valores, 12) };
      })
    );
    const alvo = base.filter((b) => !centroId || b.c.id === centroId);
    if (centroId && !alvo.length) throw naoEncontrado('esse centro de trabalho');
    const itens = await Promise.all(
      alvo.map(async ({ c, serie, media6, media12 }) => {
        const [horas, quebras] = await Promise.all([
          this.prisma.apontamento.aggregate({ where: { tenantId, fim: { gte: desde }, operacao: { centroId: c.id } }, _sum: { horas: true } }),
          this.prisma.ordemManutencao.findMany({ where: { tenantId, centroId: c.id, tipo: 'CORRETIVA', status: 'CONCLUIDA', fim: { gte: desde } } })
        ]);
        const custoPeriodo = soma(competencias.map((x) => serie.get(x)!));
        const ind = indicadoresManutencao({
          horasOperacao: horas._sum.horas ? tt(horas._sum.horas) : '0',
          quebras: quebras.map((q) => ({ horasParado: q.horasParado ? tt(q.horasParado) : '0' })),
          custoManutencao: custoPeriodo.toFixed(2)
        });
        const pares = base.filter((b) => b.c.tipo === c.tipo);
        const mediaCategoria = soma(pares.map((p) => dec(p.media6))).div(pares.length);
        const acima = pares.length > 1 && dec(media6).gt(mediaCategoria.times(LIMITE_CATEGORIA));
        const depreciacao = tabela?.centros.find((x) => x.id === c.id)?.composicao.depreciacao ?? '0';
        return {
          centro: { id: c.id, codigo: c.codigo, nome: c.nome, tipo: c.tipo },
          indicadores: ind,
          custoPorMes: competencias.map((x) => ({ competencia: x, valor: serie.get(x)!.toFixed(2) })),
          media6,
          media12,
          cadastro: tt(c.manutencao),
          diferenca: txt(dec(media6).minus(tt(c.manutencao))),
          mediaCategoria: txt(mediaCategoria),
          alerta: acima
            ? {
                mensagem: `${c.nome} gasta em média ${dec(media6).toFixed(2)} por mês em manutenção, mais de 30% acima da média dos centros do mesmo tipo (${mediaCategoria.toFixed(2)}). Revise o custo-hora ou avalie a substituição.`,
                substituicao: compararSubstituicao({
                  manutencaoAtualMes: media6,
                  depreciacaoAtualMes: depreciacao,
                  valorNovo: tt(c.valorAquisicao),
                  vidaUtilNovoMeses: String(c.vidaUtilMeses || 60),
                  residualNovo: tt(c.valorResidual),
                  manutencaoNovoMes: txt(mediaCategoria)
                })
              }
            : null
        };
      })
    );
    return { meses, competencias, centros: itens };
  }

  async proposta(tenantId: string, competencia: string) {
    if (!RE_COMPETENCIA.test(competencia)) throw invalido('A competência precisa estar no formato AAAA-MM.');
    const centros = await this.prisma.centroTrabalho.findMany({ where: { tenantId, status: { not: 'desativado' } }, orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }] });
    const comps = ultimasCompetencias(6, competencia);
    const itens = await Promise.all(
      centros.map(async (c) => {
        const serie = await custoManutencaoPorMes(this.prisma, tenantId, c.id, comps);
        const proposta = mediaMovel(comps.map((x) => serie.get(x)!.toFixed(2)), 6);
        const horasReais = await horasReaisDoCentro(this.prisma, tenantId, c, competencia);
        return {
          centroId: c.id,
          nome: c.nome,
          manutencaoCadastro: tt(c.manutencao),
          manutencaoProposta: dec(proposta).toFixed(2),
          diferencaManutencao: dec(proposta).minus(tt(c.manutencao)).toFixed(2),
          horasExpedienteCadastro: tt(c.horasExpediente),
          horasDisponiveisReais: horasReais,
          diferencaHoras: txt(dec(horasReais).minus(tt(c.horasExpediente)))
        };
      })
    );
    return { competencia, centros: itens };
  }

  async aceitarProposta(tenantId: string, dto: AceitarPropostaDto) {
    const ids = dto.centros.map((c) => c.centroId);
    if ((await this.prisma.centroTrabalho.count({ where: { tenantId, id: { in: ids } } })) !== new Set(ids).size) throw naoEncontrado('um dos centros de trabalho');
    await this.prisma.$transaction(async (tx) => {
      for (const c of dto.centros) {
        await tx.centroTrabalho.update({
          where: { id: c.centroId },
          data: { manutencao: c.manutencao !== undefined ? pd(dec(c.manutencao).toFixed(2)) : undefined, horasExpediente: c.horasExpediente !== undefined ? pd(dec(c.horasExpediente).toFixed(2)) : undefined }
        });
      }
      await marcarDesatualizada(tx, tenantId);
    });
    const vigente = await buscarVigente(this.prisma, tenantId);
    return { centros: (await this.proposta(tenantId, hojeLocal().slice(0, 7))).centros.filter((c) => ids.includes(c.centroId)), tabelaDesatualizada: !!vigente?.desatualizada };
  }

  /** Bloco `manutencao` do painel. */
  async resumoPainel(tenantId: string) {
    const hoje = dataBanco(hojeLocal());
    const [planos, ordensAbertas, parados, ind] = await Promise.all([
      this.prisma.planoManutencao.findMany({ where: { tenantId, ativo: true } }),
      this.prisma.ordemManutencao.count({ where: { tenantId, status: { in: ABERTAS } } }),
      this.prisma.paradaCentro.findMany({ where: { tenantId, inicio: { lte: hoje }, OR: [{ fim: null }, { fim: { gte: hoje } }] }, distinct: ['centroId'], select: { centroId: true } }),
      this.indicadores(tenantId, undefined, 6)
    ]);
    const situacoes = await Promise.all(planos.map(async (p) => ({ p, s: (await situacaoDoPlano(this.prisma, p)).situacao })));
    const proximas = situacoes.filter((x) => x.s.situacao !== 'ok');
    const disp = ind.centros.map((c) => dec(c.indicadores.disponibilidade));
    return {
      resumo: {
        preventivasProximas: proximas.length,
        ordensAbertas,
        centrosParados: parados.length,
        disponibilidadeMedia: disp.length ? soma(disp).div(disp.length).toDecimalPlaces(4).toFixed() : null
      },
      alertas: [
        ...proximas
          .filter((x) => x.s.situacao === 'vencida')
          .map((x) => ({ tipo: 'atencao' as const, mensagem: `A preventiva "${x.p.nome}" está vencida. Programe a parada.`, link: '/manutencao/planos' })),
        ...(parados.length ? [{ tipo: 'perigo' as const, mensagem: `${parados.length} centro(s) parado(s) hoje por manutenção.`, link: '/manutencao/ordens?status=EM_EXECUCAO' }] : [])
      ]
    };
  }

  private async centroCustoManutencao(db: Db, tenantId: string, centroId: string) {
    const ccs = await db.centroCusto.findMany({ where: { tenantId, custoDiretoCentro: { not: Prisma.DbNull } } });
    const existente = ccs.find((c) => {
      const d = c.custoDiretoCentro as { centroTrabalhoId: string; componente: string };
      return d.centroTrabalhoId === centroId && d.componente === 'manutencao';
    });
    if (existente) return existente;
    const centro = await db.centroTrabalho.findUniqueOrThrow({ where: { id: centroId } });
    return db.centroCusto.create({ data: { tenantId, nome: `Manutenção — ${centro.nome}`, tipo: 'VARIAVEL', custoDiretoCentro: json({ centroTrabalhoId: centroId, componente: 'manutencao' }) } });
  }

  private async saidaPlano(tenantId: string, p: PlanoManutencao) {
    const [centro, s] = await Promise.all([this.prisma.centroTrabalho.findUnique({ where: { id: p.centroId }, select: { nome: true } }), situacaoDoPlano(this.prisma, p)]);
    return {
      id: p.id,
      centroId: p.centroId,
      centroNome: centro?.nome ?? null,
      nome: p.nome,
      tipo: p.tipo,
      intervaloHoras: p.intervaloHoras ? tt(p.intervaloHoras) : null,
      intervaloDias: p.intervaloDias,
      duracaoHoras: tt(p.duracaoHoras),
      checklist: p.checklist,
      ultimaExecucao: p.ultimaExecucao ? textoData(p.ultimaExecucao) : null,
      horasDesdeUltima: dec(s.horasDesdeUltima).toDecimalPlaces(2).toFixed(),
      ativo: p.ativo,
      situacao: s.situacao,
      ordemAberta: (await this.prisma.ordemManutencao.findFirst({ where: { tenantId, planoId: p.id, status: { in: ABERTAS } }, select: { id: true, numero: true } })) ?? null
    };
  }

  private async saidaOrdens(tenantId: string, os: (OrdemManutencao & { custos: CustoManutencao[] })[]) {
    const [centros, fornecedores] = await Promise.all([
      this.prisma.centroTrabalho.findMany({ where: { tenantId, id: { in: os.map((o) => o.centroId) } }, select: { id: true, nome: true } }),
      this.prisma.fornecedor.findMany({ where: { tenantId, id: { in: os.map((o) => o.fornecedorId).filter(Boolean) as string[] } }, select: { id: true, nome: true } })
    ]);
    return os.map((o) => ({
      id: o.id,
      numero: o.numero,
      centroId: o.centroId,
      centroNome: centros.find((c) => c.id === o.centroId)?.nome ?? null,
      tipo: o.tipo,
      origem: o.origem,
      planoId: o.planoId,
      execucao: o.execucao,
      fornecedorId: o.fornecedorId,
      fornecedorNome: fornecedores.find((f) => f.id === o.fornecedorId)?.nome ?? null,
      descricao: o.descricao,
      prevista: o.prevista ? textoData(o.prevista) : null,
      inicio: o.inicio,
      fim: o.fim,
      status: o.status,
      bloqueiaAgenda: o.bloqueiaAgenda,
      paradaId: o.paradaId,
      custos: o.custos.map((c) => ({
        id: c.id,
        tipo: c.tipo,
        descricao: c.descricao,
        itemId: c.itemId,
        quantidade: c.quantidade ? tt(c.quantidade) : null,
        colaboradorId: c.colaboradorId,
        horas: c.horas ? tt(c.horas) : null,
        fornecedorId: c.fornecedorId,
        valor: dec(tt(c.valor)).toFixed(2),
        tituloId: c.tituloId,
        data: c.data
      })),
      custoTotal: soma(o.custos.map((c) => dec(tt(c.valor)))).toFixed(2),
      horasParado: o.horasParado ? tt(o.horasParado) : null,
      checklist: o.checklist,
      observacao: o.observacao,
      motivoCancelamento: o.motivoCancelamento,
      osAfetadas: o.osAfetadas,
      criadoEm: o.criadoEm
    }));
  }

  private conferirPlano(tipo: string, horas?: string, dias?: number) {
    if (tipo === 'HORAS' && (horas === undefined || dec(horas).lte(0))) throw invalido('Plano por horas precisa do intervalo em horas.', [{ campo: 'intervaloHoras', mensagem: 'intervaloHoras é obrigatório' }]);
    if (tipo === 'CALENDARIO' && !(Number(dias) > 0)) throw invalido('Plano por calendário precisa do intervalo em dias.', [{ campo: 'intervaloDias', mensagem: 'intervaloDias é obrigatório' }]);
  }

  private async ordemAberta(tenantId: string, id: string, acao: string) {
    const o = await this.buscarOrdem(tenantId, id);
    if (!ABERTAS.includes(o.status)) throw conflito('STATUS_INVALIDO', `Não dá para ${acao} ${o.numero}: ela está ${o.status.toLowerCase()}.`, { status: o.status });
    return o;
  }

  private async buscarOrdem(tenantId: string, id: string) {
    const o = await this.prisma.ordemManutencao.findFirst({ where: { id, tenantId }, include: { custos: { orderBy: { data: 'asc' } } } });
    if (!o) throw naoEncontrado('essa ordem de manutenção');
    return o;
  }

  private async plano(tenantId: string, id: string) {
    const p = await this.prisma.planoManutencao.findFirst({ where: { id, tenantId } });
    if (!p) throw naoEncontrado('esse plano de manutenção');
    return p;
  }

  private async centro(tenantId: string, id: string) {
    const c = await this.prisma.centroTrabalho.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('esse centro de trabalho');
    return c;
  }
}

