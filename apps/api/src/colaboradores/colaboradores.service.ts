import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { custoColaborador } from '@promec/motor';
import { pd, pdOpc, tt } from '../comum/decimal';
import { ErroApi, invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { Db, marcarDesatualizada } from '../tabelas-custos/entrada';
import { conferirAlocacao, semRepetidos } from './alocacao';
import { temPermissao } from '../acesso/permissoes';
import { Sessao } from '../comum/sessao';

/** Campos que só quem tem `rh.ver_salario` pode gravar. */
const CAMPOS_SALARIO = ['salario', 'encargos', 'encargosPercentual', 'beneficios'] as const;
import { conferirHabilitacao, custoDoColaborador, encargosDoVinculo } from '../rh/rh-core';
import { AlocacaoColaboradorDto, AtualizarColaboradorDto, CriarColaboradorDto } from './colaboradores.dto';

const incluir = { alocacoes: { include: { centro: true }, orderBy: { centro: { codigo: 'asc' } } } } satisfies Prisma.ColaboradorInclude;
type ColaboradorCompleto = Prisma.ColaboradorGetPayload<{ include: typeof incluir }>;

@Injectable()
export class ColaboradoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, q?: string, ativo?: string) {
    const itens = await this.prisma.colaborador.findMany({
      where: {
        tenantId,
        ...(q ? { OR: [{ nome: { contains: q, mode: 'insensitive' } }, { funcao: { contains: q, mode: 'insensitive' } }] } : {}),
        ...(ativo === 'true' || ativo === 'false' ? { ativo: ativo === 'true' } : {})
      },
      include: incluir,
      orderBy: { nome: 'asc' }
    });
    return { itens: await Promise.all(itens.map((c) => this.saida(tenantId, c))), total: itens.length };
  }

  async detalhe(tenantId: string, id: string) {
    const c = await this.buscar(tenantId, id);
    const usuario = await this.prisma.usuario.findFirst({ where: { tenantId, colaboradorId: id }, select: { id: true, nome: true } });
    const comissoes = usuario
      ? await this.prisma.comissao.groupBy({ by: ['competencia'], where: { tenantId, vendedorId: usuario.id, estornada: false }, _sum: { valor: true }, orderBy: { competencia: 'desc' } })
      : [];
    return {
      ...(await this.saida(tenantId, c)),
      usuario,
      comissoes: comissoes.map((g) => ({ competencia: g.competencia, valor: g._sum.valor ? g._sum.valor.toFixed(2) : '0.00' }))
    };
  }

  private async saida(tenantId: string, c: ColaboradorCompleto) {
    const custo = await custoDoColaborador(this.prisma, tenantId, c);
    return {
      id: c.id,
      nome: c.nome,
      funcao: c.funcao,
      vinculo: c.vinculo,
      salario: tt(c.salario),
      encargos: tt(c.encargos),
      encargosPercentual: c.encargosPercentual === null ? null : tt(c.encargosPercentual),
      beneficios: tt(c.beneficios),
      jornadaHoras: tt(c.jornadaHoras),
      turno: c.turno,
      diasSemana: c.diasSemana,
      ativo: c.ativo,
      horasDisponiveisMes: custo.disponibilidade.horasDisponiveis,
      custoMensal: custo.custoMensal,
      custoHora: custo.custoHora ?? '0',
      alocacoes: c.alocacoes.map((a) => ({ centroId: a.centroId, centroNome: a.centro.nome, alocacao: tt(a.alocacao) }))
    };
  }

  async criar(s: Sessao, entrada: CriarColaboradorDto) {
    const tenantId = s.tenantId;
    const salarial = CAMPOS_SALARIO.filter((k) => entrada[k] !== undefined && entrada[k] !== null);
    if (salarial.length && !temPermissao(s.permissoes, 'rh.ver_salario')) {
      throw new ErroApi(403, 'SEM_PERMISSAO', 'Seu perfil não permite informar salário, encargos ou benefícios. Cadastre o colaborador sem esses campos e peça ao RH ou Financeiro para completá-los.', {
        permissao: 'rh.ver_salario',
        campos: salarial
      });
    }
    const dto = { ...entrada, salario: entrada.salario ?? '0' };
    const vinculo = dto.vinculo ?? 'CLT';
    const percentual = dto.encargos !== undefined && dto.encargosPercentual === undefined ? null : (dto.encargosPercentual ?? (await encargosDoVinculo(this.prisma, tenantId, vinculo)));
    const id = await this.prisma.$transaction(async (tx) => {
      const c = await tx.colaborador.create({
        data: {
          tenantId,
          nome: dto.nome.trim(),
          funcao: dto.funcao ?? '',
          vinculo,
          salario: pd(dto.salario),
          encargos: percentual === null ? pdOpc(dto.encargos) : pd(encargosPelo(dto.salario, percentual)),
          encargosPercentual: percentual === null ? null : pd(percentual),
          beneficios: pdOpc(dto.beneficios),
          jornadaHoras: pdOpc(dto.jornadaHoras),
          turno: dto.turno ?? null,
          diasSemana: dto.diasSemana,
          ativo: dto.ativo
        }
      });
      if (dto.alocacoes?.length) {
        await this.alocar(tx, tenantId, c.id, c.nome, dto.alocacoes);
        await marcarDesatualizada(tx, tenantId);
      }
      return c.id;
    });
    return this.detalhe(tenantId, id);
  }

  async atualizar(s: Sessao, id: string, entrada: AtualizarColaboradorDto) {
    const tenantId = s.tenantId;
    const dto: AtualizarColaboradorDto = temPermissao(s.permissoes, 'rh.ver_salario') ? entrada : Object.fromEntries(Object.entries(entrada).filter(([k]) => !(CAMPOS_SALARIO as readonly string[]).includes(k)));
    const atual = await this.buscar(tenantId, id);
    const salario = dto.salario !== undefined ? String(dto.salario) : tt(atual.salario);
    const percentual =
      dto.encargosPercentual !== undefined
        ? dto.encargosPercentual
        : dto.encargos !== undefined
          ? null
          : dto.vinculo && dto.vinculo !== atual.vinculo && atual.encargosPercentual !== null
            ? await encargosDoVinculo(this.prisma, tenantId, dto.vinculo)
            : atual.encargosPercentual === null
              ? null
              : tt(atual.encargosPercentual);
    const custoMudou = ['salario', 'encargos', 'encargosPercentual', 'beneficios', 'jornadaHoras', 'vinculo'].some((k) => (dto as Record<string, unknown>)[k] !== undefined);
    await this.prisma.$transaction(async (tx) => {
      const c = await tx.colaborador.update({
        where: { id },
        data: {
          nome: dto.nome?.trim(),
          funcao: dto.funcao,
          vinculo: dto.vinculo,
          salario: pdOpc(dto.salario),
          encargos: percentual === null ? pdOpc(dto.encargos) : pd(encargosPelo(salario, percentual)),
          encargosPercentual: percentual === null ? null : pd(percentual),
          beneficios: pdOpc(dto.beneficios),
          jornadaHoras: pdOpc(dto.jornadaHoras),
          turno: dto.turno,
          diasSemana: dto.diasSemana,
          ativo: dto.ativo
        }
      });
      if (dto.alocacoes) await this.alocar(tx, tenantId, id, c.nome, dto.alocacoes);
      if (dto.alocacoes || (atual.alocacoes.length && (custoMudou || dto.ativo !== undefined))) await marcarDesatualizada(tx, tenantId);
    });
    return this.detalhe(tenantId, id);
  }

  async inativar(tenantId: string, id: string) {
    const atual = await this.buscar(tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.colaborador.update({ where: { id }, data: { ativo: false } });
      if (atual.alocacoes.length) await marcarDesatualizada(tx, tenantId);
    });
    return this.detalhe(tenantId, id);
  }

  private async alocar(tx: Db, tenantId: string, colaboradorId: string, nome: string, alocacoes: AlocacaoColaboradorDto[]) {
    semRepetidos(alocacoes.map((a) => a.centroId), 'alocacoes');
    const centros = await tx.centroTrabalho.count({ where: { tenantId, id: { in: alocacoes.map((a) => a.centroId) } } });
    if (centros !== alocacoes.length) throw invalido('Algum centro de trabalho das alocações não existe nesta empresa. Escolha os centros pela lista e tente de novo.');
    await tx.centroOperador.deleteMany({ where: { tenantId, colaboradorId } });
    await conferirAlocacao(tx, tenantId, colaboradorId, nome, alocacoes.reduce((acc, a) => acc.plus(pd(a.alocacao)), new Prisma.Decimal(0)));
    for (const a of alocacoes.filter((x) => pd(x.alocacao).gt(0))) await conferirHabilitacao(tx, tenantId, { id: colaboradorId, nome }, a.centroId);
    await tx.centroOperador.createMany({
      data: alocacoes.filter((a) => pd(a.alocacao).gt(0)).map((a) => ({ tenantId, colaboradorId, centroId: a.centroId, alocacao: pd(a.alocacao) }))
    });
  }

  private async buscar(tenantId: string, id: string) {
    const c = await this.prisma.colaborador.findFirst({ where: { id, tenantId }, include: incluir });
    if (!c) throw naoEncontrado('esse colaborador');
    return c;
  }
}

const encargosPelo = (salario: string, percentual: string) => custoColaborador({ salario, encargosPercentual: percentual, horasDisponiveis: '1' }).encargos;
