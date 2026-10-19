import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dec, soma, txt } from '@promec/motor';
import { pd, pdOpc, tt } from '../comum/decimal';
import { invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { Db, marcarDesatualizada } from '../tabelas-custos/entrada';
import { conferirAlocacao, semRepetidos } from './alocacao';
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
    return { itens: itens.map(saida), total: itens.length };
  }

  async detalhe(tenantId: string, id: string) {
    return saida(await this.buscar(tenantId, id));
  }

  async criar(tenantId: string, dto: CriarColaboradorDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const c = await tx.colaborador.create({
        data: {
          tenantId,
          nome: dto.nome.trim(),
          funcao: dto.funcao ?? '',
          vinculo: dto.vinculo,
          salario: pd(dto.salario),
          encargos: pdOpc(dto.encargos),
          beneficios: pdOpc(dto.beneficios),
          jornadaHoras: pdOpc(dto.jornadaHoras),
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

  async atualizar(tenantId: string, id: string, dto: AtualizarColaboradorDto) {
    const atual = await this.buscar(tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      const c = await tx.colaborador.update({
        where: { id },
        data: {
          nome: dto.nome?.trim(),
          funcao: dto.funcao,
          vinculo: dto.vinculo,
          salario: pdOpc(dto.salario),
          encargos: pdOpc(dto.encargos),
          beneficios: pdOpc(dto.beneficios),
          jornadaHoras: pdOpc(dto.jornadaHoras),
          ativo: dto.ativo
        }
      });
      if (dto.alocacoes) await this.alocar(tx, tenantId, id, c.nome, dto.alocacoes);
      if (dto.alocacoes || atual.alocacoes.length) await marcarDesatualizada(tx, tenantId);
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

function saida(c: ColaboradorCompleto) {
  const custoMensal = soma([dec(tt(c.salario)), dec(tt(c.encargos)), dec(tt(c.beneficios))]);
  const jornada = dec(tt(c.jornadaHoras));
  return {
    id: c.id,
    nome: c.nome,
    funcao: c.funcao,
    vinculo: c.vinculo,
    salario: tt(c.salario),
    encargos: tt(c.encargos),
    beneficios: tt(c.beneficios),
    jornadaHoras: tt(c.jornadaHoras),
    ativo: c.ativo,
    custoMensal: txt(custoMensal),
    custoHora: jornada.gt(0) ? txt(custoMensal.div(jornada)) : '0',
    alocacoes: c.alocacoes.map((a) => ({ centroId: a.centroId, centroNome: a.centro.nome, alocacao: tt(a.alocacao) }))
  };
}
