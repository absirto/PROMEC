import { Injectable } from '@nestjs/common';
import { Movimento, Prisma, TipoMovimento } from '@prisma/client';
import { curvaABC, dec, soma, txt, type Dec } from '@promec/motor';
import { pd, RE_COMPETENCIA, tt } from '../comum/decimal';
import { invalido, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { PrismaService } from '../prisma/prisma.service';
import { json } from '../tabelas-custos/entrada';
import { buscarItem, conferirSaida, entrarComCusto, movimentar } from './estoque-core';
import { AtualizarLocalDto, InventarioDto, LocalDto, MovimentoDto } from './estoque.dto';
import { consumoPorItem, saldosDosItens } from './itens.service';

const D = (v: Prisma.Decimal | null | undefined) => dec(v ? tt(v) : 0);
const TIPOS: TipoMovimento[] = ['ENTRADA_RECEBIMENTO', 'ENTRADA_AVULSA', 'SAIDA_OS', 'ESTORNO_OS', 'SAIDA_CENTRO', 'AJUSTE', 'TRANSFERENCIA', 'PERDA', 'DEVOLUCAO'];

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  async locais(tenantId: string) {
    const ls = await this.prisma.localEstoque.findMany({ where: { tenantId }, orderBy: { criadoEm: 'asc' } });
    return ls.map((l) => ({ id: l.id, nome: l.nome, tipo: l.tipo, ativo: l.ativo }));
  }

  async criarLocal(tenantId: string, dto: LocalDto) {
    const l = await this.prisma.localEstoque.create({ data: { tenantId, nome: dto.nome.trim(), tipo: dto.tipo, ativo: dto.ativo } });
    return { id: l.id, nome: l.nome, tipo: l.tipo, ativo: l.ativo };
  }

  async atualizarLocal(tenantId: string, id: string, dto: AtualizarLocalDto) {
    await this.local(tenantId, id);
    const l = await this.prisma.localEstoque.update({ where: { id }, data: { nome: dto.nome?.trim(), tipo: dto.tipo, ativo: dto.ativo } });
    return { id: l.id, nome: l.nome, tipo: l.tipo, ativo: l.ativo };
  }

  async saldos(tenantId: string, f: { localId?: string; q?: string; abaixoDoMinimo?: string }) {
    const termo = f.q?.trim();
    const itens = await this.prisma.item.findMany({
      where: {
        tenantId,
        ativo: true,
        tipo: { not: 'SERVICO_EXTERNO' },
        ...(termo ? { OR: [{ codigo: { contains: termo, mode: 'insensitive' } }, { descricao: { contains: termo, mode: 'insensitive' } }] } : {})
      },
      include: { saldos: { include: { local: true } } },
      orderBy: { codigo: 'asc' }
    });
    const [totais, reservas] = await Promise.all([
      saldosDosItens(this.prisma, tenantId, itens.map((i) => i.id)),
      this.prisma.reserva.findMany({ where: { tenantId, status: 'ATIVA' } })
    ]);
    const linhas = itens.flatMap((i) => {
      const tot = totais.get(i.id)!;
      const minimo = D(i.estoqueMinimo);
      const situacao = tot.disponivel.lte(0) ? 'zerado' : minimo.gt(0) && tot.disponivel.lt(minimo) ? 'baixo' : 'ok';
      const item = { id: i.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidadeConsumo, tipo: i.tipo };
      const porLocal = i.saldos.filter((s) => !f.localId || s.localId === f.localId);
      const base = (localId: string | null, localNome: string | null, fisico: Dec) => {
        const reservado = soma(reservas.filter((r) => r.itemId === i.id && r.localId === localId).map((r) => D(r.quantidade).minus(D(r.consumida))));
        return {
          item,
          localId,
          localNome,
          fisico: txt(fisico),
          reservado: txt(reservado),
          disponivel: txt(fisico.minus(reservado)),
          custoMedio: tt(i.custoMedio),
          valor: txt(fisico.times(D(i.custoMedio))),
          minimo: tt(i.estoqueMinimo),
          situacao
        };
      };
      const rows = porLocal.map((s) => base(s.localId, s.local.nome, D(s.fisico)));
      return rows.length || f.localId ? rows : [base(null, null, dec(0))];
    });
    const filtradas = f.abaixoDoMinimo === 'true' ? linhas.filter((l) => l.situacao !== 'ok') : linhas;
    const abaixo = itens.filter((i) => D(i.estoqueMinimo).gt(0) && totais.get(i.id)!.disponivel.lt(D(i.estoqueMinimo))).length;
    return {
      itens: filtradas,
      total: filtradas.length,
      totais: { valor: txt(soma(linhas.map((l) => dec(l.valor)))), itensAbaixoMinimo: abaixo }
    };
  }

  async movimentos(tenantId: string, f: { itemId?: string; osId?: string; tipo?: string; de?: string; ate?: string }) {
    const ms = await this.prisma.movimento.findMany({
      where: {
        tenantId,
        ...(f.itemId ? { itemId: f.itemId } : {}),
        ...(f.osId ? { osId: f.osId } : {}),
        ...(TIPOS.includes(f.tipo as TipoMovimento) ? { tipo: f.tipo as TipoMovimento } : {}),
        ...(f.de || f.ate
          ? { data: { ...(f.de ? { gte: new Date(`${f.de.slice(0, 10)}T00:00:00-03:00`) } : {}), ...(f.ate ? { lt: new Date(new Date(`${f.ate.slice(0, 10)}T00:00:00-03:00`).getTime() + 86_400_000) } : {}) } }
          : {})
      },
      orderBy: { data: 'desc' },
      take: 500
    });
    const itens = await this.saidaMovimentos(tenantId, ms);
    return { itens, total: itens.length };
  }

  async saidaMovimentos(tenantId: string, ms: Movimento[]) {
    const ids = <K extends keyof Movimento>(k: K) => [...new Set(ms.map((m) => m[k]).filter(Boolean) as string[])];
    const [itens, locais, lotes, ordens, centros, recebimentos, usuarios] = await Promise.all([
      this.prisma.item.findMany({ where: { tenantId, id: { in: ids('itemId') } } }),
      this.prisma.localEstoque.findMany({ where: { tenantId, id: { in: ids('localId') } } }),
      this.prisma.lote.findMany({ where: { tenantId, id: { in: ids('loteId') } } }),
      this.prisma.ordemServico.findMany({ where: { tenantId, id: { in: ids('osId') } }, select: { id: true, numero: true } }),
      this.prisma.centroTrabalho.findMany({ where: { tenantId, id: { in: ids('centroId') } }, select: { id: true, codigo: true, nome: true } }),
      this.prisma.recebimento.findMany({ where: { tenantId, id: { in: ids('recebimentoId') } }, include: { pedido: { select: { numero: true } } } }),
      this.prisma.usuario.findMany({ where: { tenantId, id: { in: ids('usuarioId') } }, select: { id: true, nome: true } })
    ]);
    const achar = <T extends { id: string }>(xs: T[], id: string | null) => (id ? xs.find((x) => x.id === id) : undefined);
    return ms.map((m) => {
      const item = achar(itens, m.itemId)!;
      const os = achar(ordens, m.osId);
      const centro = achar(centros, m.centroId);
      const rec = achar(recebimentos, m.recebimentoId);
      const origem = os
        ? { tipo: 'OS', id: os.id, numero: os.numero }
        : centro
          ? { tipo: 'CENTRO', id: centro.id, numero: centro.codigo }
          : rec
            ? { tipo: 'RECEBIMENTO', id: rec.id, numero: rec.notaFiscal ? `NF ${rec.notaFiscal}` : rec.pedido.numero }
            : m.inventarioId
              ? { tipo: 'INVENTARIO', id: m.inventarioId, numero: null }
              : { tipo: 'AJUSTE', id: null, numero: null };
      const lote = achar(lotes, m.loteId);
      const local = achar(locais, m.localId);
      return {
        id: m.id,
        data: m.data,
        tipo: m.tipo,
        item: { id: item.id, codigo: item.codigo, descricao: item.descricao, unidade: item.unidadeConsumo },
        local: local ? { id: local.id, nome: local.nome } : null,
        quantidade: tt(m.quantidade),
        custoUnitario: tt(m.custoUnitario),
        valor: tt(m.valor),
        lote: lote ? { id: lote.id, codigo: lote.codigo } : null,
        origem,
        usuario: achar(usuarios, m.usuarioId) ?? null,
        observacao: m.observacao,
        estornado: m.estornado
      };
    });
  }

  async registrar(s: Sessao, dto: MovimentoDto) {
    const item = await buscarItem(this.prisma, s.tenantId, dto.itemId);
    await this.local(s.tenantId, dto.localId);
    const q = dec(dto.quantidade);
    if (dto.tipo !== 'AJUSTE' && q.lte(0)) throw invalido('A quantidade precisa ser maior que zero.', [{ campo: 'quantidade', mensagem: 'quantidade precisa ser maior que zero' }]);
    if (q.isZero()) throw invalido('O ajuste precisa de uma quantidade diferente de zero.');
    const exige = (campo: 'justificativa' | 'motivo', valor?: string) => {
      if (!valor?.trim()) throw regra('JUSTIFICATIVA_OBRIGATORIA', `Esse movimento precisa de ${campo === 'motivo' ? 'um motivo' : 'uma justificativa'} para ficar auditável. Explique o que aconteceu.`);
      return valor.trim();
    };
    const base = { tenantId: s.tenantId, item, localId: dto.localId, usuarioId: s.id };
    const custo = tt(item.custoMedio);

    const mov = await this.prisma.$transaction(async (tx) => {
      switch (dto.tipo) {
        case 'ENTRADA_AVULSA': {
          const obs = exige('justificativa', dto.justificativa);
          const loteId = await this.loteDeEntrada(tx, s.tenantId, item, dto, q);
          return entrarComCusto(tx, { ...base, tipo: 'ENTRADA_AVULSA', quantidade: q, custoUnitario: String(dto.custoUnitario ?? custo), loteId, observacao: obs });
        }
        case 'SAIDA_CENTRO': {
          if (item.tipo !== 'INSUMO' && item.tipo !== 'FERRAMENTA_GERAL') {
            throw regra('ITEM_NAO_E_DE_CENTRO', `${item.descricao} não é insumo nem ferramenta geral; material de peça sai pela OS, não contra o centro.`);
          }
          if (!dto.centroId || !(await tx.centroTrabalho.findFirst({ where: { id: dto.centroId, tenantId: s.tenantId } }))) throw naoEncontrado('esse centro de trabalho');
          await conferirSaida(tx, { ...base, quantidade: q, loteId: dto.loteId });
          return movimentar(tx, { ...base, tipo: 'SAIDA_CENTRO', quantidade: q.neg(), custoUnitario: custo, loteId: dto.loteId, centroId: dto.centroId, observacao: dto.observacao });
        }
        case 'AJUSTE': {
          const obs = exige('justificativa', dto.justificativa);
          if (q.lt(0)) await conferirSaida(tx, { ...base, quantidade: q.neg(), loteId: dto.loteId });
          else if (item.rastreavel && !dto.loteId) await conferirSaida(tx, { ...base, quantidade: dec(0), loteId: null });
          return movimentar(tx, { ...base, tipo: 'AJUSTE', quantidade: q, custoUnitario: custo, loteId: dto.loteId, observacao: obs });
        }
        case 'PERDA': {
          const obs = exige('motivo', dto.motivo);
          await conferirSaida(tx, { ...base, quantidade: q, loteId: dto.loteId });
          return movimentar(tx, { ...base, tipo: 'PERDA', quantidade: q.neg(), custoUnitario: custo, loteId: dto.loteId, observacao: obs });
        }
        case 'TRANSFERENCIA': {
          if (!dto.localDestinoId || dto.localDestinoId === dto.localId) throw invalido('Informe um local de destino diferente do de origem.', [{ campo: 'localDestinoId', mensagem: 'localDestinoId é obrigatório' }]);
          await this.local(s.tenantId, dto.localDestinoId);
          await conferirSaida(tx, { ...base, quantidade: q, loteId: dto.loteId });
          const saida = await movimentar(tx, { ...base, tipo: 'TRANSFERENCIA', quantidade: q.neg(), custoUnitario: custo, loteId: dto.loteId, observacao: dto.observacao });
          await movimentar(tx, { ...base, localId: dto.localDestinoId, tipo: 'TRANSFERENCIA', quantidade: q, custoUnitario: custo, loteId: dto.loteId, observacao: dto.observacao });
          if (dto.loteId) await tx.lote.update({ where: { id: dto.loteId }, data: { localId: dto.localDestinoId } });
          return saida;
        }
        case 'DEVOLUCAO': {
          if (!dto.osId) throw invalido('A devolução de sobra precisa da OS de origem.', [{ campo: 'osId', mensagem: 'osId é obrigatório' }]);
          const os = await tx.ordemServico.findFirst({ where: { id: dto.osId, tenantId: s.tenantId }, include: { custos: true } });
          if (!os) throw naoEncontrado('essa ordem de serviço');
          if (item.rastreavel && !dto.loteId) await conferirSaida(tx, { ...base, quantidade: dec(0), loteId: null });
          const custoOs = os.custos.find((c) => c.itemId === item.id && c.real !== null);
          if (custoOs) {
            const real = D(custoOs.real).minus(q.times(dec(custo)));
            await tx.osCusto.update({ where: { id: custoOs.id }, data: { real: pd(txt(real.gt(0) ? real : dec(0))) } });
          }
          return movimentar(tx, { ...base, tipo: 'DEVOLUCAO', quantidade: q, custoUnitario: custo, loteId: dto.loteId, osId: os.id, osCustoId: custoOs?.id, observacao: dto.observacao });
        }
      }
    });
    return (await this.saidaMovimentos(s.tenantId, [mov]))[0];
  }

  async lotes(tenantId: string, itemId?: string) {
    const ls = await this.prisma.lote.findMany({ where: { tenantId, ...(itemId ? { itemId } : {}) }, orderBy: { data: 'desc' } });
    const fornecedores = await this.prisma.fornecedor.findMany({ where: { tenantId, id: { in: ls.map((l) => l.fornecedorId).filter(Boolean) as string[] } }, select: { id: true, nome: true } });
    return ls.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      itemId: l.itemId,
      localId: l.localId,
      fornecedor: fornecedores.find((f) => f.id === l.fornecedorId) ?? null,
      recebimentoId: l.recebimentoId,
      data: l.data,
      quantidadeInicial: tt(l.quantidadeInicial),
      saldo: tt(l.saldo),
      certificado: l.certificado ?? null
    }));
  }

  async consumoCentros(tenantId: string, competencia: string) {
    if (!RE_COMPETENCIA.test(competencia)) throw invalido('A competência precisa estar no formato AAAA-MM, por exemplo 2026-10.');
    const [ano, mes] = competencia.split('-').map(Number);
    const de = new Date(`${competencia}-01T00:00:00-03:00`);
    const ate = new Date(`${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01T00:00:00-03:00`);
    const [centros, g] = await Promise.all([
      this.prisma.centroTrabalho.findMany({ where: { tenantId, status: { not: 'desativado' } }, orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }] }),
      this.prisma.movimento.groupBy({ by: ['centroId'], where: { tenantId, tipo: 'SAIDA_CENTRO', data: { gte: de, lt: ate } }, _sum: { valor: true } })
    ]);
    return centros.map((c) => {
      const consumido = D(g.find((x) => x.centroId === c.id)?._sum.valor).neg();
      return { centroId: c.id, nome: c.nome, consumido: txt(consumido), insumosCadastro: tt(c.insumos), diferenca: txt(consumido.minus(D(c.insumos))) };
    });
  }

  async curvaAbc(tenantId: string, meses: number) {
    const desde = new Date();
    desde.setMonth(desde.getMonth() - meses);
    const consumo = await consumoPorItem(this.prisma, tenantId, desde);
    const curva = curvaABC([...consumo].filter(([, v]) => dec(v).gt(0)).map(([id, valor]) => ({ id, valor })));
    const itens = await this.prisma.item.findMany({ where: { tenantId, id: { in: curva.map((c) => c.id) } } });
    return curva.map((c) => {
      const i = itens.find((x) => x.id === c.id)!;
      return { ...c, codigo: i.codigo, descricao: i.descricao };
    });
  }

  async inventario(s: Sessao, dto: InventarioDto) {
    await this.local(s.tenantId, dto.localId);
    const r = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.inventario.create({ data: { tenantId: s.tenantId, localId: dto.localId, itens: json([]), usuarioId: s.id } });
      const linhas = [];
      for (const c of dto.itens) {
        const item = await buscarItem(tx, s.tenantId, c.itemId);
        let sistema: Dec;
        if (c.loteId) {
          const lote = await tx.lote.findFirst({ where: { id: c.loteId, tenantId: s.tenantId, itemId: item.id } });
          if (!lote) throw naoEncontrado('esse lote do item');
          sistema = D(lote.saldo);
        } else {
          sistema = D((await tx.saldo.findUnique({ where: { itemId_localId: { itemId: item.id, localId: dto.localId } } }))?.fisico);
        }
        const diferenca = dec(c.contado).minus(sistema);
        if (!diferenca.isZero()) {
          await movimentar(tx, {
            tenantId: s.tenantId,
            tipo: 'AJUSTE',
            item,
            localId: dto.localId,
            quantidade: diferenca,
            custoUnitario: tt(item.custoMedio),
            loteId: c.loteId,
            inventarioId: inv.id,
            usuarioId: s.id,
            observacao: `Inventário: contado ${c.contado}, sistema ${txt(sistema)}`
          });
        }
        linhas.push({ itemId: item.id, descricao: item.descricao, loteId: c.loteId ?? null, sistema: txt(sistema), contado: String(c.contado), diferenca: txt(diferenca) });
      }
      await tx.inventario.update({ where: { id: inv.id }, data: { itens: json(linhas) } });
      return { id: inv.id, localId: dto.localId, data: inv.data, itens: linhas, ajustes: linhas.filter((l) => !dec(l.diferenca).isZero()).length };
    });
    return r;
  }

  private async loteDeEntrada(tx: Prisma.TransactionClient, tenantId: string, item: { id: string; rastreavel: boolean; descricao: string }, dto: MovimentoDto, q: Dec) {
    if (dto.loteId) {
      if (!(await tx.lote.findFirst({ where: { id: dto.loteId, tenantId, itemId: item.id } }))) throw naoEncontrado('esse lote do item');
      return dto.loteId;
    }
    if (!dto.lote) {
      if (item.rastreavel) throw regra('LOTE_OBRIGATORIO', `${item.descricao} é rastreável: informe o lote e o certificado da entrada.`);
      return null;
    }
    const lote = await tx.lote.create({
      data: { tenantId, itemId: item.id, codigo: dto.lote.codigo.trim(), localId: dto.localId, quantidadeInicial: pd(txt(q)), saldo: pd(0), certificado: dto.lote.certificado ? json(dto.lote.certificado) : undefined }
    });
    return lote.id;
  }

  private async local(tenantId: string, id: string) {
    const l = await this.prisma.localEstoque.findFirst({ where: { id, tenantId } });
    if (!l) throw naoEncontrado('esse local de estoque');
    return l;
  }
}
