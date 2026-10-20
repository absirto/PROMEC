import { Injectable } from '@nestjs/common';
import { Ausencia, CentroTrabalho, Habilitacao } from '@prisma/client';
import { dec, produtividade, soma, txt } from '@promec/motor';
import { RE_COMPETENCIA, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { notificar } from '../notificacoes/notificacoes-core';
import { dataBanco, hojeLocal, inicioDoDia, local, somarDias, textoData } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { Db } from '../tabelas-custos/entrada';
import { disponibilidadeDo, situacaoHabilitacao } from './rh-core';
import { AtualizarAusenciaDto, AtualizarHabilitacaoDto, AusenciaDto, HabilitacaoDto } from './rh.dto';

const ROTULO_TIPO: Record<string, string> = { FERIAS: 'férias', AFASTAMENTO: 'afastamento', TREINAMENTO: 'treinamento', FALTA: 'falta', FOLGA: 'folga' };

const anterior = (c: string) => {
  const [a, m] = c.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};
const proxima = (c: string) => {
  const [a, m] = c.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};
export const ultimasCompetencias = (n: number, ate = hojeLocal().slice(0, 7)) => {
  const cs: string[] = [];
  for (let c = ate, i = 0; i < n; c = anterior(c), i++) cs.unshift(c);
  return cs;
};

/** Horas reais do centro no mês: soma das horas disponíveis dos operadores × alocação; sem operador, o cadastro. */
export async function horasReaisDoCentro(db: Db, tenantId: string, centro: CentroTrabalho, competencia: string) {
  const ops = await db.centroOperador.findMany({ where: { tenantId, centroId: centro.id, colaborador: { ativo: true } }, include: { colaborador: true } });
  if (!ops.length) return tt(centro.horasExpediente);
  const horas = await Promise.all(ops.map(async (o) => dec((await disponibilidadeDo(db, tenantId, o.colaborador, competencia)).horasDisponiveis).times(tt(o.alocacao))));
  return txt(soma(horas));
}

@Injectable()
export class RhService {
  constructor(private readonly prisma: PrismaService) {}

  async ausencias(tenantId: string, f: { colaboradorId?: string; de?: string; ate?: string }) {
    const as = await this.prisma.ausencia.findMany({
      where: {
        tenantId,
        ...(f.colaboradorId ? { colaboradorId: f.colaboradorId } : {}),
        ...(f.ate ? { inicio: { lte: dataBanco(f.ate) } } : {}),
        ...(f.de ? { fim: { gte: dataBanco(f.de) } } : {})
      },
      orderBy: { inicio: 'asc' }
    });
    const itens = await this.saidaAusencias(tenantId, as);
    return { itens, total: itens.length };
  }

  async criarAusencia(tenantId: string, dto: AusenciaDto) {
    await this.colaborador(tenantId, dto.colaboradorId);
    await this.semSobreposicao(tenantId, dto.colaboradorId, dto.inicio, dto.fim);
    const a = await this.prisma.ausencia.create({
      data: { tenantId, colaboradorId: dto.colaboradorId, tipo: dto.tipo, inicio: dataBanco(dto.inicio), fim: dataBanco(dto.fim), observacao: dto.observacao ?? null }
    });
    return (await this.saidaAusencias(tenantId, [a]))[0];
  }

  async atualizarAusencia(tenantId: string, id: string, dto: AtualizarAusenciaDto) {
    const atual = await this.ausencia(tenantId, id);
    const inicio = dto.inicio ?? textoData(atual.inicio);
    const fim = dto.fim ?? textoData(atual.fim);
    await this.semSobreposicao(tenantId, atual.colaboradorId, inicio, fim, id);
    const a = await this.prisma.ausencia.update({ where: { id }, data: { tipo: dto.tipo, inicio: dataBanco(inicio), fim: dataBanco(fim), observacao: dto.observacao } });
    return (await this.saidaAusencias(tenantId, [a]))[0];
  }

  async removerAusencia(tenantId: string, id: string) {
    await this.ausencia(tenantId, id);
    await this.prisma.ausencia.delete({ where: { id } });
    return { id, removida: true };
  }

  async habilitacoes(tenantId: string, vencendo?: string) {
    const dias = Number(vencendo);
    const hs = await this.prisma.habilitacao.findMany({
      where: { tenantId, ...(vencendo && dias >= 0 ? { validade: { lte: dataBanco(somarDias(hojeLocal(), dias)) } } : {}) },
      orderBy: { validade: 'asc' }
    });
    const itens = await this.saidaHabilitacoes(tenantId, hs);
    return { itens, total: itens.length };
  }

  async criarHabilitacao(tenantId: string, dto: HabilitacaoDto) {
    await this.colaborador(tenantId, dto.colaboradorId);
    if (!(await this.prisma.centroTrabalho.findFirst({ where: { id: dto.centroId, tenantId } }))) throw naoEncontrado('esse centro de trabalho');
    if (dto.validade.slice(0, 10) < dto.emissao.slice(0, 10)) throw invalido('A validade precisa ser depois da emissão.');
    const h = await this.prisma.habilitacao.create({
      data: { tenantId, colaboradorId: dto.colaboradorId, centroId: dto.centroId, descricao: dto.descricao.trim(), emissao: dataBanco(dto.emissao), validade: dataBanco(dto.validade), documento: dto.documento ?? null }
    });
    return (await this.saidaHabilitacoes(tenantId, [h]))[0];
  }

  async atualizarHabilitacao(tenantId: string, id: string, dto: AtualizarHabilitacaoDto) {
    await this.habilitacao(tenantId, id);
    const h = await this.prisma.habilitacao.update({
      where: { id },
      data: { descricao: dto.descricao?.trim(), emissao: dto.emissao ? dataBanco(dto.emissao) : undefined, validade: dto.validade ? dataBanco(dto.validade) : undefined, documento: dto.documento }
    });
    return (await this.saidaHabilitacoes(tenantId, [h]))[0];
  }

  async removerHabilitacao(tenantId: string, id: string) {
    await this.habilitacao(tenantId, id);
    await this.prisma.habilitacao.delete({ where: { id } });
    return { id, removida: true };
  }

  async matriz(tenantId: string) {
    const [colaboradores, centros, alocacoes, habs] = await Promise.all([
      this.prisma.colaborador.findMany({ where: { tenantId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, funcao: true } }),
      this.prisma.centroTrabalho.findMany({ where: { tenantId, status: { not: 'desativado' } }, orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }], select: { id: true, codigo: true, nome: true } }),
      this.prisma.centroOperador.findMany({ where: { tenantId } }),
      this.prisma.habilitacao.findMany({ where: { tenantId }, orderBy: { validade: 'desc' } })
    ]);
    const celulas = colaboradores.flatMap((c) =>
      centros
        .map((ct) => {
          const al = alocacoes.find((a) => a.colaboradorId === c.id && a.centroId === ct.id);
          const h = habs.find((x) => x.colaboradorId === c.id && x.centroId === ct.id);
          return { colaboradorId: c.id, centroId: ct.id, alocacao: al ? tt(al.alocacao) : null, habilitacao: h ? { id: h.id, descricao: h.descricao, validade: textoData(h.validade), situacao: situacaoHabilitacao(h.validade) } : null };
        })
        .filter((x) => x.alocacao !== null || x.habilitacao !== null)
    );
    return { colaboradores, centros, celulas };
  }

  async disponibilidade(tenantId: string, competencia: string) {
    if (!RE_COMPETENCIA.test(competencia)) throw invalido('A competência precisa estar no formato AAAA-MM, por exemplo 2026-11.');
    const [colaboradores, centros] = await Promise.all([
      this.prisma.colaborador.findMany({ where: { tenantId, ativo: true }, orderBy: { nome: 'asc' } }),
      this.prisma.centroTrabalho.findMany({ where: { tenantId, status: { not: 'desativado' } }, orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }] })
    ]);
    const porColaborador = await Promise.all(
      colaboradores.map(async (c) => {
        const d = await disponibilidadeDo(this.prisma, tenantId, c, competencia);
        return {
          colaborador: { id: c.id, nome: c.nome, funcao: c.funcao },
          jornada: tt(c.jornadaHoras),
          diasUteis: d.diasUteis,
          diasAusente: d.diasAusente,
          horasDisponiveis: d.horasDisponiveis,
          ausencias: d.ausencias.map((a) => ({ id: a.id, tipo: a.tipo, inicio: textoData(a.inicio), fim: textoData(a.fim) }))
        };
      })
    );
    const porCentro = await Promise.all(
      centros.map(async (c) => ({ centroId: c.id, nome: c.nome, horasExpedienteCadastro: tt(c.horasExpediente), horasDisponiveisReais: await horasReaisDoCentro(this.prisma, tenantId, c, competencia) }))
    );
    return { competencia, colaboradores: porColaborador, centros: porCentro };
  }

  async produtividade(tenantId: string, meses: number) {
    const competencias = ultimasCompetencias(meses);
    const desde = inicioDoDia(`${competencias[0]}-01`);
    const ate = inicioDoDia(`${proxima(competencias[competencias.length - 1])}-01`);
    const [colaboradores, centros, aps] = await Promise.all([
      this.prisma.colaborador.findMany({ where: { tenantId, ativo: true }, include: { alocacoes: { include: { centro: true } } }, orderBy: { nome: 'asc' } }),
      this.prisma.centroTrabalho.findMany({ where: { tenantId, status: { not: 'desativado' } }, orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }] }),
      this.prisma.apontamento.findMany({ where: { tenantId, fim: { not: null }, inicio: { gte: desde, lt: ate } }, include: { operacao: { select: { centroId: true, retrabalho: true } } } })
    ]);
    const mes = (d: Date) => local(d).data.slice(0, 7);
    const somaHoras = (xs: typeof aps) => txt(soma(xs.map((a) => dec(a.horas ? tt(a.horas) : 0))));
    const porColaborador = await Promise.all(
      colaboradores.map(async (c) => {
        const meus = aps.filter((a) => a.colaboradorId === c.id);
        const linhas = await Promise.all(
          competencias.map(async (comp) => ({ competencia: comp, horasApontadas: somaHoras(meus.filter((a) => mes(a.inicio) === comp)), horasDisponiveis: (await disponibilidadeDo(this.prisma, tenantId, c, comp)).horasDisponiveis }))
        );
        const principal = [...c.alocacoes].sort((a, b) => b.alocacao.comparedTo(a.alocacao))[0]?.centro;
        const p = produtividade({ meses: linhas, eficienciaTabela: principal ? tt(principal.eficiencia) : '0.75' });
        return {
          colaborador: { id: c.id, nome: c.nome },
          meses: linhas.map((l, i) => ({ ...l, produtividade: p.meses[i] })),
          atual: p.atual,
          recalibrar: p.recalibrar,
          refugo: meus.reduce((n, a) => n + a.refugo, 0),
          retrabalhoHoras: somaHoras(meus.filter((a) => a.operacao.retrabalho))
        };
      })
    );
    const porCentro = await Promise.all(
      centros.map(async (c) => {
        const deles = aps.filter((a) => a.operacao.centroId === c.id);
        const linhas = await Promise.all(
          competencias.map(async (comp) => ({ competencia: comp, horasApontadas: somaHoras(deles.filter((a) => mes(a.inicio) === comp)), horasDisponiveis: await horasReaisDoCentro(this.prisma, tenantId, c, comp) }))
        );
        const p = produtividade({ meses: linhas, eficienciaTabela: tt(c.eficiencia) });
        if (p.recalibrar) {
          await notificar(this.prisma, tenantId, {
            permissoes: ['custos.gerenciar'],
            tipo: 'ATENCAO',
            titulo: `Recalibrar a eficiência do ${c.nome}`,
            mensagem: `A produtividade ficou abaixo da eficiência da Tabela de Custos (${dec(tt(c.eficiencia)).times(100).toFixed(0)}%) por 2 meses seguidos. Revise a eficiência do centro e gere uma nova versão da tabela.`,
            link: `/centros-trabalho/${c.id}`,
            chave: `recalibrar-${c.id}-${competencias[competencias.length - 1]}`
          });
        }
        return {
          centro: { id: c.id, codigo: c.codigo, nome: c.nome },
          eficienciaTabela: tt(c.eficiencia),
          meses: linhas.map((l, i) => ({ ...l, produtividade: p.meses[i] })),
          atual: p.atual,
          recalibrar: p.recalibrar,
          refugo: deles.reduce((n, a) => n + a.refugo, 0),
          retrabalhoHoras: somaHoras(deles.filter((a) => a.operacao.retrabalho))
        };
      })
    );
    return { competencias, colaboradores: porColaborador, centros: porCentro };
  }

  private async semSobreposicao(tenantId: string, colaboradorId: string, inicio: string, fim: string, excetoId?: string) {
    if (fim.slice(0, 10) < inicio.slice(0, 10)) throw invalido('O fim da ausência precisa ser no mesmo dia ou depois do início.');
    const outra = await this.prisma.ausencia.findFirst({
      where: { tenantId, colaboradorId, ...(excetoId ? { id: { not: excetoId } } : {}), inicio: { lte: dataBanco(fim) }, fim: { gte: dataBanco(inicio) } }
    });
    if (outra) {
      throw conflito(
        'AUSENCIA_SOBREPOSTA',
        `Já existe uma ausência (${ROTULO_TIPO[outra.tipo] ?? outra.tipo.toLowerCase()}) de ${textoData(outra.inicio).split('-').reverse().join('/')} a ${textoData(outra.fim).split('-').reverse().join('/')} nesse período. Ajuste as datas ou edite a ausência existente.`,
        { ausenciaId: outra.id }
      );
    }
  }

  private async saidaAusencias(tenantId: string, as: Ausencia[]) {
    const cs = await this.prisma.colaborador.findMany({ where: { tenantId, id: { in: as.map((a) => a.colaboradorId) } }, select: { id: true, nome: true } });
    return as.map((a) => ({ id: a.id, colaboradorId: a.colaboradorId, colaborador: cs.find((c) => c.id === a.colaboradorId) ?? null, tipo: a.tipo, inicio: textoData(a.inicio), fim: textoData(a.fim), observacao: a.observacao }));
  }

  private async saidaHabilitacoes(tenantId: string, hs: Habilitacao[]) {
    const [cs, centros] = await Promise.all([
      this.prisma.colaborador.findMany({ where: { tenantId, id: { in: hs.map((h) => h.colaboradorId) } }, select: { id: true, nome: true } }),
      this.prisma.centroTrabalho.findMany({ where: { tenantId, id: { in: hs.map((h) => h.centroId) } }, select: { id: true, nome: true } })
    ]);
    return hs.map((h) => ({
      id: h.id,
      colaboradorId: h.colaboradorId,
      colaborador: cs.find((c) => c.id === h.colaboradorId) ?? null,
      centroId: h.centroId,
      centroNome: centros.find((c) => c.id === h.centroId)?.nome ?? null,
      descricao: h.descricao,
      emissao: textoData(h.emissao),
      validade: textoData(h.validade),
      documento: h.documento,
      situacao: situacaoHabilitacao(h.validade)
    }));
  }

  private async colaborador(tenantId: string, id: string) {
    const c = await this.prisma.colaborador.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('esse colaborador');
    return c;
  }

  private async ausencia(tenantId: string, id: string) {
    const a = await this.prisma.ausencia.findFirst({ where: { id, tenantId } });
    if (!a) throw naoEncontrado('essa ausência');
    return a;
  }

  private async habilitacao(tenantId: string, id: string) {
    const h = await this.prisma.habilitacao.findFirst({ where: { id, tenantId } });
    if (!h) throw naoEncontrado('essa habilitação');
    return h;
  }
}
