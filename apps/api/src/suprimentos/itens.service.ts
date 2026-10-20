import { Injectable } from '@nestjs/common';
import { Item, Prisma, TipoItem } from '@prisma/client';
import { curvaABC, dec, txt } from '@promec/motor';
import { pd, pdOpc, t, tt } from '../comum/decimal';
import { conflito, naoEncontrado, regra } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { Db } from '../tabelas-custos/entrada';
import { AtualizarItemDto, ItemDto, TIPOS_ITEM } from './cadastros.dto';

const D = (v: Prisma.Decimal | null | undefined) => dec(v ? tt(v) : 0);
export const TIPOS_DE_CONSUMO = ['SAIDA_OS', 'ESTORNO_OS', 'SAIDA_CENTRO', 'PERDA'] as const;

/** Valor consumido por item desde a data (saídas menos estornos). */
export async function consumoPorItem(db: Db, tenantId: string, desde: Date) {
  const g = await db.movimento.groupBy({ by: ['itemId'], where: { tenantId, data: { gte: desde }, tipo: { in: [...TIPOS_DE_CONSUMO] } }, _sum: { valor: true } });
  return new Map(g.map((x) => [x.itemId, txt(D(x._sum.valor).neg())]));
}

/** Saldos físico, reservado e disponível de vários itens de uma vez. */
export async function saldosDosItens(db: Db, tenantId: string, ids: string[]) {
  const [fis, res] = await Promise.all([
    db.saldo.groupBy({ by: ['itemId'], where: { tenantId, itemId: { in: ids } }, _sum: { fisico: true } }),
    db.reserva.findMany({ where: { tenantId, itemId: { in: ids }, status: 'ATIVA' } })
  ]);
  return new Map(
    ids.map((id) => {
      const fisico = D(fis.find((f) => f.itemId === id)?._sum.fisico);
      const reservado = res.filter((r) => r.itemId === id).reduce((a, r) => a.plus(D(r.quantidade).minus(D(r.consumida))), dec(0));
      return [id, { fisico, reservado, disponivel: fisico.minus(reservado) }];
    })
  );
}

export async function classesABC(db: Db, tenantId: string, meses = 3) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);
  const consumo = await consumoPorItem(db, tenantId, desde);
  const itens = [...consumo].filter(([, v]) => dec(v).gt(0)).map(([id, valor]) => ({ id, valor }));
  return { curva: curvaABC(itens), consumo };
}

@Injectable()
export class ItensService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, f: { q?: string; tipo?: string; abaixoDoMinimo?: string }) {
    const termo = f.q?.trim();
    const itens = await this.prisma.item.findMany({
      where: {
        tenantId,
        ...(TIPOS_ITEM.includes(f.tipo as TipoItem) ? { tipo: f.tipo as TipoItem } : {}),
        ...(termo ? { OR: [{ codigo: { contains: termo, mode: 'insensitive' } }, { descricao: { contains: termo, mode: 'insensitive' } }] } : {})
      },
      orderBy: { codigo: 'asc' }
    });
    const [saldos, { curva }] = await Promise.all([saldosDosItens(this.prisma, tenantId, itens.map((i) => i.id)), classesABC(this.prisma, tenantId)]);
    const saida = itens
      .map((i) => this.saida(i, saldos.get(i.id)!, curva.find((c) => c.id === i.id)?.classe ?? null))
      .filter((i) => f.abaixoDoMinimo !== 'true' || i.abaixoDoMinimo);
    return { itens: saida, total: saida.length };
  }

  async detalhe(tenantId: string, id: string) {
    const i = await this.buscar(tenantId, id);
    const [saldos, { curva }, fornecedores] = await Promise.all([
      saldosDosItens(this.prisma, tenantId, [id]),
      classesABC(this.prisma, tenantId),
      this.prisma.fornecedorItem.findMany({ where: { tenantId, itemId: id }, include: { fornecedor: { select: { nome: true } } }, orderBy: { data: 'desc' } })
    ]);
    return {
      ...this.saida(i, saldos.get(id)!, curva.find((c) => c.id === id)?.classe ?? null),
      fornecedores: fornecedores.map((f) => ({ fornecedorId: f.fornecedorId, nome: f.fornecedor.nome, ultimoPreco: tt(f.ultimoPreco), data: f.data }))
    };
  }

  async criar(tenantId: string, dto: ItemDto) {
    await this.codigoLivre(tenantId, dto.codigo);
    this.conferirUnidades(dto.unidadeCompra, dto.unidadeConsumo, dto.fatorConversao);
    if (dto.fornecedorPreferidoId) await this.fornecedor(tenantId, dto.fornecedorPreferidoId);
    const i = await this.prisma.item.create({
      data: { tenantId, ...this.dados(dto), codigo: dto.codigo.trim(), descricao: dto.descricao.trim(), tipo: dto.tipo, unidadeCompra: dto.unidadeCompra, unidadeConsumo: dto.unidadeConsumo, ultimoCusto: pd(dto.custoMedio ?? 0) }
    });
    return this.detalhe(tenantId, i.id);
  }

  async atualizar(tenantId: string, id: string, dto: AtualizarItemDto) {
    const atual = await this.buscar(tenantId, id);
    if (dto.codigo && dto.codigo.trim() !== atual.codigo) await this.codigoLivre(tenantId, dto.codigo);
    this.conferirUnidades(dto.unidadeCompra ?? atual.unidadeCompra, dto.unidadeConsumo ?? atual.unidadeConsumo, dto.fatorConversao ?? (dto.unidadeCompra || dto.unidadeConsumo ? undefined : tt(atual.fatorConversao)));
    if (dto.fornecedorPreferidoId) await this.fornecedor(tenantId, dto.fornecedorPreferidoId);
    await this.prisma.item.update({
      where: { id },
      data: { ...this.dados(dto), codigo: dto.codigo?.trim(), descricao: dto.descricao?.trim(), tipo: dto.tipo, unidadeCompra: dto.unidadeCompra, unidadeConsumo: dto.unidadeConsumo }
    });
    return this.detalhe(tenantId, id);
  }

  async inativar(tenantId: string, id: string) {
    await this.buscar(tenantId, id);
    await this.prisma.item.update({ where: { id }, data: { ativo: false } });
    return this.detalhe(tenantId, id);
  }

  private dados(dto: AtualizarItemDto) {
    return {
      fatorConversao: pdOpc(dto.fatorConversao),
      pesoPorMetroKg: pdOpc(dto.pesoPorMetroKg),
      custoMedio: pdOpc(dto.custoMedio),
      precoVenda: pdOpc(dto.precoVenda),
      margemPeca: pdOpc(dto.margemPeca),
      estoqueMinimo: pdOpc(dto.estoqueMinimo),
      estoqueMaximo: pdOpc(dto.estoqueMaximo),
      fornecedorPreferidoId: dto.fornecedorPreferidoId,
      rastreavel: dto.rastreavel,
      categoriaDespesa: dto.categoriaDespesa,
      ativo: dto.ativo
    };
  }

  private conferirUnidades(compra: string, consumo: string, fator?: string) {
    if (compra.trim().toLowerCase() !== consumo.trim().toLowerCase() && (fator === undefined || dec(fator).lte(0))) {
      throw regra(
        'FATOR_OBRIGATORIO',
        `O item é comprado em ${compra} e consumido em ${consumo}. Informe o fator de conversão (quantos ${consumo} há em 1 ${compra}).`
      );
    }
  }

  private saida(i: Item, s: { fisico: ReturnType<typeof dec>; reservado: ReturnType<typeof dec>; disponivel: ReturnType<typeof dec> }, classeABC: string | null) {
    return {
      id: i.id,
      codigo: i.codigo,
      descricao: i.descricao,
      tipo: i.tipo,
      unidadeCompra: i.unidadeCompra,
      unidadeConsumo: i.unidadeConsumo,
      fatorConversao: tt(i.fatorConversao),
      pesoPorMetroKg: t(i.pesoPorMetroKg),
      custoMedio: tt(i.custoMedio),
      ultimoCusto: tt(i.ultimoCusto),
      precoVenda: t(i.precoVenda),
      margemPeca: t(i.margemPeca),
      estoqueMinimo: tt(i.estoqueMinimo),
      estoqueMaximo: tt(i.estoqueMaximo),
      fornecedorPreferidoId: i.fornecedorPreferidoId,
      rastreavel: i.rastreavel,
      categoriaDespesa: i.categoriaDespesa,
      ativo: i.ativo,
      saldo: { fisico: txt(s.fisico), reservado: txt(s.reservado), disponivel: txt(s.disponivel) },
      abaixoDoMinimo: i.ativo && D(i.estoqueMinimo).gt(0) && s.disponivel.lt(D(i.estoqueMinimo)),
      classeABC
    };
  }

  private async codigoLivre(tenantId: string, codigo: string) {
    const existe = await this.prisma.item.findFirst({ where: { tenantId, codigo: codigo.trim() } });
    if (existe) throw conflito('CODIGO_DUPLICADO', `O código ${codigo.trim()} já é usado por ${existe.descricao}. Escolha outro código para o item.`);
  }

  private async fornecedor(tenantId: string, id: string) {
    if (!(await this.prisma.fornecedor.findFirst({ where: { id, tenantId } }))) throw naoEncontrado('esse fornecedor');
  }

  private async buscar(tenantId: string, id: string) {
    const i = await this.prisma.item.findFirst({ where: { id, tenantId } });
    if (!i) throw naoEncontrado('esse item');
    return i;
  }
}
