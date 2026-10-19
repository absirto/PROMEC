import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularTabelaCustos } from '@promec/motor';
import { competenciaAtual, pd, pdOpc, t, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { conferirAlocacao, semRepetidos } from '../colaboradores/alocacao';
import { buscarVigente, Db, marcarDesatualizada, montarEntrada, resultadoDe } from '../tabelas-custos/entrada';
import { AtualizarCentroDto, CriarCentroDto, OperadorCentroDto } from './centros.dto';

const incluir = { operadores: { include: { colaborador: true }, orderBy: { colaborador: { nome: 'asc' } } } } satisfies Prisma.CentroTrabalhoInclude;
type CentroCompleto = Prisma.CentroTrabalhoGetPayload<{ include: typeof incluir }>;

@Injectable()
export class CentrosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, q?: string, status?: string) {
    const [itens, custos] = await Promise.all([
      this.prisma.centroTrabalho.findMany({
        where: {
          tenantId,
          ...(status ? { status } : {}),
          ...(q ? { OR: [{ nome: { contains: q, mode: 'insensitive' } }, { codigo: { contains: q, mode: 'insensitive' } }] } : {})
        },
        include: incluir,
        orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }]
      }),
      this.custosVigentes(tenantId)
    ]);
    return { itens: itens.map((c) => saida(c, custos)), total: itens.length };
  }

  async detalhe(tenantId: string, id: string) {
    const [c, custos] = await Promise.all([this.buscar(tenantId, id), this.custosVigentes(tenantId)]);
    return saida(c, custos);
  }

  async previa(tenantId: string, competencia?: string) {
    const comp = competencia ?? (await buscarVigente(this.prisma, tenantId))?.competencia ?? competenciaAtual();
    return calcularTabelaCustos(await montarEntrada(this.prisma, tenantId, comp));
  }

  async criar(tenantId: string, dto: CriarCentroDto) {
    await this.codigoLivre(tenantId, dto.codigo);
    const id = await this.prisma.$transaction(async (tx) => {
      const c = await tx.centroTrabalho.create({ data: { tenantId, ...dados(dto), codigo: dto.codigo.trim(), nome: dto.nome.trim(), tipo: dto.tipo } });
      if (dto.operadores?.length) await this.alocar(tx, tenantId, c.id, dto.operadores);
      await marcarDesatualizada(tx, tenantId);
      return c.id;
    });
    return this.detalhe(tenantId, id);
  }

  async atualizar(tenantId: string, id: string, dto: AtualizarCentroDto) {
    const atual = await this.buscar(tenantId, id);
    if (dto.codigo && dto.codigo.trim() !== atual.codigo) await this.codigoLivre(tenantId, dto.codigo);
    await this.prisma.$transaction(async (tx) => {
      await tx.centroTrabalho.update({ where: { id }, data: { ...dados(dto), codigo: dto.codigo?.trim(), nome: dto.nome?.trim(), tipo: dto.tipo } });
      if (dto.operadores) await this.alocar(tx, tenantId, id, dto.operadores);
      await marcarDesatualizada(tx, tenantId);
    });
    return this.detalhe(tenantId, id);
  }

  async desativar(tenantId: string, id: string) {
    await this.buscar(tenantId, id);
    await this.prisma.$transaction([
      this.prisma.centroTrabalho.update({ where: { id }, data: { status: 'desativado' } }),
      this.prisma.tabelaCustos.updateMany({ where: { tenantId, status: 'VIGENTE' }, data: { desatualizada: true } })
    ]);
    return this.detalhe(tenantId, id);
  }

  private async alocar(tx: Db, tenantId: string, centroId: string, operadores: OperadorCentroDto[]) {
    semRepetidos(operadores.map((o) => o.colaboradorId), 'operadores');
    const colaboradores = await tx.colaborador.findMany({ where: { tenantId, id: { in: operadores.map((o) => o.colaboradorId) } } });
    if (colaboradores.length !== operadores.length) {
      throw invalido('Algum operador informado não existe nesta empresa. Escolha os colaboradores pela lista e tente de novo.');
    }
    for (const o of operadores) {
      const nome = colaboradores.find((c) => c.id === o.colaboradorId)!.nome;
      await conferirAlocacao(tx, tenantId, o.colaboradorId, nome, pd(o.alocacao), centroId);
    }
    await tx.centroOperador.deleteMany({ where: { tenantId, centroId } });
    await tx.centroOperador.createMany({
      data: operadores.filter((o) => pd(o.alocacao).gt(0)).map((o) => ({ tenantId, centroId, colaboradorId: o.colaboradorId, alocacao: pd(o.alocacao) }))
    });
  }

  private async codigoLivre(tenantId: string, codigo: string) {
    const existe = await this.prisma.centroTrabalho.findFirst({ where: { tenantId, codigo: codigo.trim() } });
    if (existe) throw conflito('CODIGO_DUPLICADO', `O código ${codigo.trim()} já é usado por ${existe.nome}. Escolha outro código para o centro.`);
  }

  private async custosVigentes(tenantId: string) {
    const v = await buscarVigente(this.prisma, tenantId);
    return new Map(v ? resultadoDe(v).centros.map((c) => [c.id, c.cheioHora]) : []);
  }

  private async buscar(tenantId: string, id: string) {
    const c = await this.prisma.centroTrabalho.findFirst({ where: { id, tenantId }, include: incluir });
    if (!c) throw naoEncontrado('esse centro de trabalho');
    return c;
  }
}

function dados(dto: AtualizarCentroDto) {
  return {
    status: dto.status,
    horasExpediente: pdOpc(dto.horasExpediente),
    eficiencia: pdOpc(dto.eficiencia),
    manutencao: pdOpc(dto.manutencao),
    insumos: pdOpc(dto.insumos),
    outros: pdOpc(dto.outros),
    valorAquisicao: pdOpc(dto.valorAquisicao),
    valorResidual: pdOpc(dto.valorResidual),
    vidaUtilMeses: dto.vidaUtilMeses,
    potenciaKw: pdOpc(dto.potenciaKw),
    fatorCarga: pdOpc(dto.fatorCarga),
    tarifaKwh: pdOpc(dto.tarifaKwh),
    pesoManual: pdOpc(dto.pesoManual),
    areaM2: pdOpc(dto.areaM2)
  };
}

function saida(c: CentroCompleto, custos: Map<string, string>) {
  return {
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    tipo: c.tipo,
    status: c.status,
    horasExpediente: tt(c.horasExpediente),
    eficiencia: tt(c.eficiencia),
    manutencao: tt(c.manutencao),
    insumos: tt(c.insumos),
    outros: tt(c.outros),
    valorAquisicao: tt(c.valorAquisicao),
    valorResidual: tt(c.valorResidual),
    vidaUtilMeses: c.vidaUtilMeses,
    potenciaKw: tt(c.potenciaKw),
    fatorCarga: tt(c.fatorCarga),
    tarifaKwh: tt(c.tarifaKwh),
    pesoManual: t(c.pesoManual),
    areaM2: t(c.areaM2),
    operadores: c.operadores.map((o) => ({ colaboradorId: o.colaboradorId, nome: o.colaborador.nome, alocacao: tt(o.alocacao) })),
    custoHoraVigente: custos.get(c.id) ?? null
  };
}
