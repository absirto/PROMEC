import { Item, Prisma, TipoMovimento } from '@prisma/client';
import { custoMedioAposEntrada, dec, soma, txt, type Dec, type LinhaOrcamento } from '@promec/motor';
import { pd, tt } from '../comum/decimal';
import { naoEncontrado, regra } from '../comum/erros';
import { Db } from '../tabelas-custos/entrada';

const D = (v: Prisma.Decimal | null | undefined) => dec(v ? tt(v) : 0);

export async function buscarItem(db: Db, tenantId: string, itemId: string) {
  const item = await db.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw naoEncontrado('esse item');
  return item;
}

/** Reserva ainda pendente (quantidade − consumida) das reservas ativas. */
export async function reservado(db: Db, tenantId: string, itemId: string, filtro: { localId?: string; excetoOsId?: string } = {}) {
  const rs = await db.reserva.findMany({
    where: { tenantId, itemId, status: 'ATIVA', ...(filtro.localId ? { localId: filtro.localId } : {}), ...(filtro.excetoOsId ? { osId: { not: filtro.excetoOsId } } : {}) }
  });
  return soma(rs.map((r) => D(r.quantidade).minus(D(r.consumida))));
}

export async function saldoDoItem(db: Db, tenantId: string, itemId: string) {
  const [s, r] = await Promise.all([db.saldo.aggregate({ where: { tenantId, itemId }, _sum: { fisico: true } }), reservado(db, tenantId, itemId)]);
  const fisico = D(s._sum.fisico);
  return { fisico, reservado: r, disponivel: fisico.minus(r) };
}

/** Local com mais saldo do item; sem saldo, o primeiro local cadastrado. */
export async function localPreferido(db: Db, tenantId: string, itemId: string) {
  const s = await db.saldo.findFirst({ where: { tenantId, itemId }, orderBy: { fisico: 'desc' } });
  if (s) return s.localId;
  const l = await db.localEstoque.findFirst({ where: { tenantId, ativo: true }, orderBy: { criadoEm: 'asc' } });
  return l?.id ?? null;
}

interface Mov {
  tenantId: string;
  tipo: TipoMovimento;
  item: Item;
  localId: string;
  /** Positiva entra, negativa sai. */
  quantidade: Dec;
  custoUnitario: string;
  loteId?: string | null;
  osId?: string | null;
  osCustoId?: string | null;
  centroId?: string | null;
  recebimentoId?: string | null;
  inventarioId?: string | null;
  estornoDeId?: string | null;
  usuarioId?: string | null;
  observacao?: string | null;
}

/** Grava o movimento e atualiza saldo do local e do lote. */
export async function movimentar(tx: Db, m: Mov) {
  const q = pd(txt(m.quantidade));
  await tx.saldo.upsert({
    where: { itemId_localId: { itemId: m.item.id, localId: m.localId } },
    create: { tenantId: m.tenantId, itemId: m.item.id, localId: m.localId, fisico: q },
    update: { fisico: { increment: q } }
  });
  if (m.loteId) await tx.lote.update({ where: { id: m.loteId }, data: { saldo: { increment: q } } });
  return tx.movimento.create({
    data: {
      tenantId: m.tenantId,
      tipo: m.tipo,
      itemId: m.item.id,
      localId: m.localId,
      quantidade: q,
      custoUnitario: pd(m.custoUnitario),
      valor: pd(txt(m.quantidade.times(dec(m.custoUnitario)))),
      loteId: m.loteId ?? null,
      osId: m.osId ?? null,
      osCustoId: m.osCustoId ?? null,
      centroId: m.centroId ?? null,
      recebimentoId: m.recebimentoId ?? null,
      inventarioId: m.inventarioId ?? null,
      estornoDeId: m.estornoDeId ?? null,
      usuarioId: m.usuarioId ?? null,
      observacao: m.observacao ?? null
    }
  });
}

/** Entrada que recalcula o custo médio do item (recebimento ou entrada avulsa). */
export async function entrarComCusto(tx: Db, m: Omit<Mov, 'custoUnitario'> & { custoUnitario: string; atualizarUltimo?: boolean }) {
  const { fisico } = await saldoDoItem(tx, m.tenantId, m.item.id);
  const r = custoMedioAposEntrada({ saldo: txt(fisico), custoMedio: tt(m.item.custoMedio), quantidade: txt(m.quantidade), custoUnitario: m.custoUnitario });
  await tx.item.update({
    where: { id: m.item.id },
    data: { custoMedio: pd(r.custoMedio), ...(m.atualizarUltimo !== false ? { ultimoCusto: pd(m.custoUnitario) } : {}) }
  });
  return movimentar(tx, m);
}

/** Confere lote e disponível antes de uma saída. */
export async function conferirSaida(db: Db, p: { tenantId: string; item: Item; localId: string; quantidade: Dec; loteId?: string | null; osId?: string }) {
  if (p.item.rastreavel && !p.loteId) {
    throw regra('LOTE_OBRIGATORIO', `${p.item.descricao} é rastreável: informe de qual lote saiu o material para o certificado acompanhar a peça.`);
  }
  if (p.loteId) {
    const lote = await db.lote.findFirst({ where: { id: p.loteId, tenantId: p.tenantId, itemId: p.item.id } });
    if (!lote) throw naoEncontrado('esse lote do item');
    if (D(lote.saldo).lt(p.quantidade)) {
      throw regra('SALDO_INSUFICIENTE', `O lote ${lote.codigo} só tem ${txt(D(lote.saldo))} ${p.item.unidadeConsumo}. Escolha outro lote ou reduza a quantidade.`, {
        disponivel: txt(D(lote.saldo))
      });
    }
  }
  const s = await db.saldo.findUnique({ where: { itemId_localId: { itemId: p.item.id, localId: p.localId } } });
  const disponivel = D(s?.fisico).minus(await reservado(db, p.tenantId, p.item.id, { localId: p.localId, excetoOsId: p.osId }));
  if (disponivel.lt(p.quantidade)) {
    throw regra(
      'SALDO_INSUFICIENTE',
      `Só há ${txt(disponivel.gt(0) ? disponivel : dec(0))} ${p.item.unidadeConsumo} de ${p.item.descricao} disponíveis nesse local. Confira o saldo, transfira de outro local ou peça a compra.`,
      { disponivel: txt(disponivel) }
    );
  }
}

/** Quantidade a reservar de uma linha do orçamento com itemId (unidade de consumo do item). */
export function quantidadeDaLinha(l: LinhaOrcamento, lote: number): string | null {
  if (l.tipo === 'material') return txt((l.base ?? 'peca') === 'peca' ? dec(l.quantidade).times(lote) : dec(l.quantidade));
  if (l.tipo === 'materialCorte') return txt(dec(l.comprimentoMm).plus(dec(l.sobraMm)).div(1000).times(dec(l.pesoPorMetroKg)).times(lote));
  if (l.tipo === 'ferramental') return '1';
  return null;
}

export async function reservarDoOrcamento(tx: Db, tenantId: string, osId: string, linhas: LinhaOrcamento[], lote: number) {
  for (const l of linhas) {
    const itemId = (l as { itemId?: string }).itemId;
    const q = itemId ? quantidadeDaLinha(l, lote) : null;
    if (!itemId || !q || dec(q).lte(0)) continue;
    const localId = await localPreferido(tx, tenantId, itemId);
    if (!localId) continue;
    await tx.reserva.create({ data: { tenantId, itemId, localId, osId, quantidade: pd(q) } });
  }
}

export const liberarReservas = (tx: Db, tenantId: string, osId: string) =>
  tx.reserva.updateMany({ where: { tenantId, osId, status: 'ATIVA' }, data: { status: 'LIBERADA' } });

/** Consumo da OS baixa primeiro a reserva do item (estorno devolve). */
export async function baixarReserva(tx: Db, tenantId: string, osId: string, itemId: string, quantidade: Dec) {
  const rs = await tx.reserva.findMany({ where: { tenantId, osId, itemId, status: { in: ['ATIVA', 'ATENDIDA'] } }, orderBy: { criadoEm: 'asc' } });
  let resto = quantidade;
  for (const r of rs) {
    if (resto.isZero()) break;
    const pendente = D(r.quantidade).minus(D(r.consumida));
    const delta = resto.gt(0) ? (resto.lt(pendente) ? resto : pendente) : resto.abs().lt(D(r.consumida)) ? resto : D(r.consumida).neg();
    if (delta.isZero()) continue;
    const consumida = D(r.consumida).plus(delta);
    await tx.reserva.update({
      where: { id: r.id },
      data: { consumida: pd(txt(consumida)), status: consumida.gte(D(r.quantidade)) ? 'ATENDIDA' : 'ATIVA' }
    });
    resto = resto.minus(delta);
  }
}
