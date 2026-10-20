import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, StatusPedido, StatusRequisicao } from '@prisma/client';
import { avaliarFornecedor, compararCotacoes, converterUnidade, dec, soma, sugestaoDeCompra, txt, variacaoDePreco, type LinhaOrcamento } from '@promec/motor';
import { pd, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { proximoNumero } from '../orcamentos/numeracao';
import { ParametrosService } from '../parametros/parametros.service';
import { dataBanco, hojeLocal, somarDias, textoData } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { Db, json } from '../tabelas-custos/entrada';
import { buscarItem, entrarComCusto } from './estoque-core';
import { tituloDoRecebimento } from '../financeiro/financeiro-core';
import { CotacaoDto, EscolherDto, PedidoDto, RecebimentoDto, RequisicaoDto, RespostaDto } from './compras.dto';
import { saldosDosItens } from './itens.service';

const D = (v: Prisma.Decimal | null | undefined) => dec(v ? tt(v) : 0);
const LIMITE_DIVERGENCIA_PRECO = '0.02';
const LIMITE_CUSTO_DESATUALIZADO = '0.05';
const STATUS_REQ: StatusRequisicao[] = ['ABERTA', 'EM_COTACAO', 'ATENDIDA', 'CANCELADA'];
const STATUS_PED: StatusPedido[] = ['AGUARDANDO_APROVACAO', 'APROVADO', 'PARCIAL', 'RECEBIDO', 'CANCELADO'];

const incluirPedido = {
  fornecedor: { select: { id: true, nome: true, condicaoPagamento: true } },
  itens: true,
  recebimentos: { orderBy: { data: 'asc' } }
} satisfies Prisma.PedidoInclude;
type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>;

type ItemCotado = { itemId: string; quantidade: string };
type PrecoCotado = { itemId: string; precoUnitario: string };

/** Dias do primeiro prazo da condição de pagamento ("28 dias", "28/56"). */
const diasDaCondicao = (c: string) => Number(/(\d+)/.exec(c)?.[1] ?? 0);

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService
  ) {}

  // Requisições

  async requisicoes(tenantId: string, status?: string) {
    const rs = await this.prisma.requisicao.findMany({
      where: { tenantId, ...(STATUS_REQ.includes(status as StatusRequisicao) ? { status: status as StatusRequisicao } : {}) },
      include: { itens: true },
      orderBy: { criadoEm: 'desc' }
    });
    const [itens, ordens] = await Promise.all([
      this.prisma.item.findMany({ where: { tenantId, id: { in: rs.flatMap((r) => r.itens.map((i) => i.itemId)) } } }),
      this.prisma.ordemServico.findMany({ where: { tenantId, id: { in: rs.map((r) => r.osId).filter(Boolean) as string[] } }, select: { id: true, numero: true } })
    ]);
    const lista = rs.map((r) => ({
      id: r.id,
      numero: r.numero,
      status: r.status,
      origem: r.origem,
      os: ordens.find((o) => o.id === r.osId) ?? null,
      cotacaoId: r.cotacaoId,
      pedidoId: r.pedidoId,
      observacao: r.observacao,
      criadoEm: r.criadoEm,
      itens: r.itens.map((i) => {
        const item = itens.find((x) => x.id === i.itemId)!;
        return { itemId: i.itemId, codigo: item.codigo, descricao: item.descricao, unidade: item.unidadeCompra, quantidade: tt(i.quantidade) };
      })
    }));
    return { itens: lista, total: lista.length };
  }

  async criarRequisicao(s: Sessao, dto: RequisicaoDto) {
    if (dto.osId && !(await this.prisma.ordemServico.findFirst({ where: { id: dto.osId, tenantId: s.tenantId } }))) throw naoEncontrado('essa ordem de serviço');
    for (const i of dto.itens) await buscarItem(this.prisma, s.tenantId, i.itemId);
    const r = await criarRequisicao(this.prisma, s.tenantId, { origem: dto.osId ? 'OS' : 'MANUAL', osId: dto.osId, observacao: dto.observacao, usuarioId: s.id, itens: dto.itens.map((i) => ({ itemId: i.itemId, quantidade: String(i.quantidade) })) });
    return (await this.requisicoes(s.tenantId)).itens.find((x) => x.id === r.id);
  }

  async gerarPontoPedido(s: Sessao) {
    const itens = await this.prisma.item.findMany({ where: { tenantId: s.tenantId, ativo: true, tipo: { not: 'SERVICO_EXTERNO' }, estoqueMinimo: { gt: 0 } } });
    const saldos = await saldosDosItens(this.prisma, s.tenantId, itens.map((i) => i.id));
    const abertas = await this.prisma.requisicaoItem.findMany({ where: { tenantId: s.tenantId, requisicao: { status: { in: ['ABERTA', 'EM_COTACAO'] } } } });
    const grupos = new Map<string, { itemId: string; quantidade: string }[]>();
    for (const i of itens) {
      if (abertas.some((a) => a.itemId === i.id)) continue;
      const q = sugestaoDeCompra({ disponivel: txt(saldos.get(i.id)!.disponivel), minimo: tt(i.estoqueMinimo), maximo: tt(i.estoqueMaximo) });
      if (dec(q).lte(0)) continue;
      const chave = i.fornecedorPreferidoId ?? '';
      grupos.set(chave, [...(grupos.get(chave) ?? []), { itemId: i.id, quantidade: txt(dec(q).div(D(i.fatorConversao).gt(0) ? D(i.fatorConversao) : 1)) }]);
    }
    const criadas: string[] = [];
    for (const itensGrupo of grupos.values()) {
      const r = await criarRequisicao(this.prisma, s.tenantId, { origem: 'PONTO_PEDIDO', observacao: 'Gerada pelo ponto de pedido', usuarioId: s.id, itens: itensGrupo });
      criadas.push(r.id);
    }
    const todas = await this.requisicoes(s.tenantId);
    const requisicoes = todas.itens.filter((r) => criadas.includes(r.id));
    return { requisicoes, total: requisicoes.length };
  }

  // Cotações

  async cotacoes(tenantId: string) {
    const cs = await this.prisma.cotacao.findMany({ where: { tenantId }, include: { respostas: true }, orderBy: { criadoEm: 'desc' } });
    return { itens: cs.map((c) => ({ id: c.id, numero: c.numero, status: c.status, fornecedores: c.fornecedorIds.length, respostas: c.respostas.length, pedidoId: c.pedidoId, criadoEm: c.criadoEm })), total: cs.length };
  }

  async criarCotacao(tenantId: string, dto: CotacaoDto) {
    const reqs = await this.prisma.requisicao.findMany({ where: { tenantId, id: { in: dto.requisicaoIds } }, include: { itens: true } });
    if (reqs.length !== new Set(dto.requisicaoIds).size) throw naoEncontrado('uma das requisições');
    const fechada = reqs.find((r) => r.status !== 'ABERTA');
    if (fechada) throw conflito('REQUISICAO_INDISPONIVEL', `${fechada.numero} já está em outra cotação ou foi atendida. Tire-a da seleção.`);
    const fornecedores = await this.prisma.fornecedor.count({ where: { tenantId, id: { in: dto.fornecedorIds } } });
    if (fornecedores !== new Set(dto.fornecedorIds).size) throw naoEncontrado('um dos fornecedores');
    const mapa = new Map<string, ReturnType<typeof dec>>();
    for (const i of reqs.flatMap((r) => r.itens)) mapa.set(i.itemId, (mapa.get(i.itemId) ?? dec(0)).plus(D(i.quantidade)));
    const itens: ItemCotado[] = [...mapa].map(([itemId, q]) => ({ itemId, quantidade: txt(q) }));
    const c = await this.prisma.$transaction(async (tx) => {
      const c = await tx.cotacao.create({
        data: { tenantId, numero: await proximoNumero(tx, tenantId, 'COT'), requisicaoIds: dto.requisicaoIds, fornecedorIds: [...new Set(dto.fornecedorIds)], itens: json(itens) }
      });
      await tx.requisicao.updateMany({ where: { id: { in: dto.requisicaoIds } }, data: { status: 'EM_COTACAO', cotacaoId: c.id } });
      return c;
    });
    return this.cotacao(tenantId, c.id);
  }

  async cotacao(tenantId: string, id: string) {
    const c = await this.prisma.cotacao.findFirst({ where: { id, tenantId }, include: { respostas: { orderBy: { criadoEm: 'asc' } } } });
    if (!c) throw naoEncontrado('essa cotação');
    const itensCotados = c.itens as ItemCotado[];
    const [itens, fornecedores, requisicoes] = await Promise.all([
      this.prisma.item.findMany({ where: { tenantId, id: { in: itensCotados.map((i) => i.itemId) } } }),
      this.prisma.fornecedor.findMany({ where: { tenantId, id: { in: c.fornecedorIds } } }),
      this.prisma.requisicao.findMany({ where: { tenantId, id: { in: c.requisicaoIds } }, select: { id: true, numero: true } })
    ]);
    const nome = (fid: string) => fornecedores.find((f) => f.id === fid)?.nome ?? '';
    const aval = (fid: string) => tt(fornecedores.find((f) => f.id === fid)?.avaliacao ?? pd(3));
    const comparativo = itensCotados.map((ic) => {
      const item = itens.find((i) => i.id === ic.itemId)!;
      const respostas = c.respostas
        .map((r) => ({ r, preco: (r.itens as PrecoCotado[]).find((p) => p.itemId === ic.itemId) }))
        .filter((x) => x.preco)
        .map((x) => ({ fornecedorId: x.r.fornecedorId, precoUnitario: x.preco!.precoUnitario, quantidade: ic.quantidade, prazoDias: x.r.prazoDias, avaliacao: aval(x.r.fornecedorId) }));
      return {
        itemId: ic.itemId,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: item.unidadeCompra,
        quantidade: ic.quantidade,
        resultado: compararCotacoes(respostas).map((x) => ({ ...x, fornecedorNome: nome(x.fornecedorId) }))
      };
    });
    return {
      id: c.id,
      numero: c.numero,
      status: c.status,
      criadoEm: c.criadoEm,
      requisicoes,
      fornecedores: fornecedores.map((f) => ({ id: f.id, nome: f.nome, avaliacao: tt(f.avaliacao.toDecimalPlaces(2)) })),
      itens: comparativo.map(({ resultado: _r, ...i }) => i),
      respostas: c.respostas.map((r) => ({
        fornecedorId: r.fornecedorId,
        fornecedorNome: nome(r.fornecedorId),
        itens: r.itens,
        frete: tt(r.frete),
        prazoDias: r.prazoDias,
        data: r.criadoEm
      })),
      comparativo,
      geral: this.geral(c.respostas, itensCotados, aval).map((x) => ({ ...x, fornecedorNome: nome(x.fornecedorId) })),
      fornecedorEscolhidoId: c.fornecedorEscolhidoId,
      justificativa: c.justificativa,
      pedidoId: c.pedidoId
    };
  }

  async responder(tenantId: string, id: string, dto: RespostaDto) {
    const c = await this.cotacaoAberta(tenantId, id);
    if (!c.fornecedorIds.includes(dto.fornecedorId)) {
      throw regra('FORNECEDOR_NAO_CONVIDADO', 'Esse fornecedor não foi convidado para esta cotação. Inclua-o numa nova cotação.');
    }
    const cotados = new Set((c.itens as ItemCotado[]).map((i) => i.itemId));
    const fora = dto.itens.find((i) => !cotados.has(i.itemId));
    if (fora) throw regra('ITEM_FORA_DA_COTACAO', 'A resposta tem um item que não está nesta cotação. Confira os itens e envie de novo.');
    const dados = { itens: json(dto.itens.map((i) => ({ itemId: i.itemId, precoUnitario: String(i.precoUnitario) }))), frete: pd(dto.frete ?? 0), prazoDias: dto.prazoDias };
    await this.prisma.cotacaoResposta.upsert({
      where: { cotacaoId_fornecedorId: { cotacaoId: id, fornecedorId: dto.fornecedorId } },
      create: { tenantId, cotacaoId: id, fornecedorId: dto.fornecedorId, ...dados },
      update: dados
    });
    return this.cotacao(tenantId, id);
  }

  async escolher(s: Sessao, id: string, dto: EscolherDto) {
    const c = await this.cotacaoAberta(s.tenantId, id);
    const detalhe = await this.cotacao(s.tenantId, id);
    const escolhido = detalhe.geral.find((g) => g.fornecedorId === dto.fornecedorId);
    if (!escolhido) {
      throw regra('RESPOSTA_INCOMPLETA', 'Esse fornecedor não respondeu todos os itens da cotação, então não dá para gerar o pedido com ele.');
    }
    if (escolhido.posicao !== 1 && !dto.justificativa?.trim()) {
      throw regra(
        'JUSTIFICATIVA_OBRIGATORIA',
        `${escolhido.fornecedorNome} ficou em ${escolhido.posicao}º no comparativo de preço, prazo e avaliação. Explique por que ele foi escolhido.`,
        { posicao: escolhido.posicao }
      );
    }
    const resposta = c.respostas.find((r) => r.fornecedorId === dto.fornecedorId)!;
    const precos = resposta.itens as PrecoCotado[];
    const pedidoId = await this.prisma.$transaction(async (tx) => {
      const p = await criarPedido(tx, s.tenantId, await this.parametros.carregar(s.tenantId), {
        fornecedorId: dto.fornecedorId,
        cotacaoId: id,
        frete: tt(resposta.frete),
        prazoDias: resposta.prazoDias,
        itens: (c.itens as ItemCotado[]).map((i) => ({ itemId: i.itemId, quantidade: i.quantidade, precoUnitario: precos.find((x) => x.itemId === i.itemId)!.precoUnitario })),
        observacao: dto.justificativa?.trim() ? `Escolha justificada: ${dto.justificativa.trim()}` : ''
      });
      await tx.cotacao.update({ where: { id }, data: { status: 'ENCERRADA', fornecedorEscolhidoId: dto.fornecedorId, justificativa: dto.justificativa?.trim() || null, pedidoId: p.id } });
      await tx.requisicao.updateMany({ where: { id: { in: c.requisicaoIds } }, data: { status: 'ATENDIDA', pedidoId: p.id } });
      return p.id;
    });
    return this.pedido(s.tenantId, pedidoId);
  }

  // Pedidos

  async pedidos(tenantId: string, status?: string) {
    const ps = await this.prisma.pedido.findMany({
      where: { tenantId, ...(STATUS_PED.includes(status as StatusPedido) ? { status: status as StatusPedido } : {}) },
      include: incluirPedido,
      orderBy: { criadoEm: 'desc' }
    });
    const itens = ps.map((p) => {
      const { itens: _i, recebimentos, ...cab } = this.cabecalho(p);
      return { ...cab, itens: p.itens.length, recebimentos: recebimentos.length };
    });
    return { itens, total: itens.length };
  }

  async criarPedido(s: Sessao, dto: PedidoDto) {
    const f = await this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, tenantId: s.tenantId } });
    if (!f) throw naoEncontrado('esse fornecedor');
    for (const i of dto.itens) await buscarItem(this.prisma, s.tenantId, i.itemId);
    const id = await this.prisma.$transaction(async (tx) => {
      const p = await criarPedido(tx, s.tenantId, await this.parametros.carregar(s.tenantId), {
        fornecedorId: f.id,
        frete: String(dto.frete ?? 0),
        prazoDias: dto.prazoDias ?? f.prazoMedioDias,
        itens: dto.itens.map((i) => ({ itemId: i.itemId, quantidade: String(i.quantidade), precoUnitario: String(i.precoUnitario) })),
        observacao: dto.observacao ?? ''
      });
      if (dto.requisicaoIds?.length) {
        await tx.requisicao.updateMany({ where: { tenantId: s.tenantId, id: { in: dto.requisicaoIds }, status: { in: ['ABERTA', 'EM_COTACAO'] } }, data: { status: 'ATENDIDA', pedidoId: p.id } });
      }
      return p.id;
    });
    return this.pedido(s.tenantId, id);
  }

  async pedido(tenantId: string, id: string) {
    const p = await this.buscarPedido(tenantId, id);
    const [itens, titulos] = await Promise.all([
      this.prisma.item.findMany({ where: { tenantId, id: { in: p.itens.map((i) => i.itemId) } } }),
      this.prisma.titulo.findMany({ where: { tenantId, origemTipo: 'RECEBIMENTO', origemId: { in: p.recebimentos.map((r) => r.id) } }, select: { id: true, numero: true, origemId: true, status: true } })
    ]);
    const cab = this.cabecalho(p, itens);
    return { ...cab, recebimentos: cab.recebimentos.map((r) => ({ ...r, titulo: titulos.find((t) => t.origemId === r.id) ?? null })) };
  }

  async aprovar(s: Sessao, id: string) {
    const p = await this.buscarPedido(s.tenantId, id);
    if (p.status !== 'AGUARDANDO_APROVACAO') throw conflito('STATUS_INVALIDO', `${p.numero} não está aguardando aprovação.`, { status: p.status });
    await this.prisma.pedido.update({ where: { id }, data: { status: 'APROVADO', aprovadoPorId: s.id, aprovadoEm: new Date() } });
    return this.pedido(s.tenantId, id);
  }

  async cancelar(tenantId: string, id: string) {
    const p = await this.buscarPedido(tenantId, id);
    if (!['AGUARDANDO_APROVACAO', 'APROVADO'].includes(p.status)) {
      throw conflito('STATUS_INVALIDO', `${p.numero} já tem recebimento ou foi encerrado; não dá para cancelar. Receba o restante ou registre a divergência.`, { status: p.status });
    }
    await this.prisma.pedido.update({ where: { id }, data: { status: 'CANCELADO', canceladoEm: new Date() } });
    return this.pedido(tenantId, id);
  }

  async receber(s: Sessao, id: string, dto: RecebimentoDto) {
    const p = await this.buscarPedido(s.tenantId, id);
    if (p.status !== 'APROVADO' && p.status !== 'PARCIAL') {
      throw conflito(
        'PEDIDO_NAO_APROVADO',
        p.status === 'AGUARDANDO_APROVACAO'
          ? `${p.numero} ainda aguarda aprovação de um gestor. Sem aprovação o material não entra no estoque.`
          : `${p.numero} está ${p.status === 'RECEBIDO' ? 'totalmente recebido' : 'cancelado'}; não há o que receber.`,
        { status: p.status }
      );
    }
    if (!(await this.prisma.localEstoque.findFirst({ where: { id: dto.localId, tenantId: s.tenantId } }))) throw naoEncontrado('esse local de estoque');
    const itens = await this.prisma.item.findMany({ where: { tenantId: s.tenantId, id: { in: dto.itens.map((i) => i.itemId) } } });
    for (const r of dto.itens) {
      const item = itens.find((i) => i.id === r.itemId);
      if (!item || !p.itens.some((pi) => pi.itemId === r.itemId)) throw regra('ITEM_FORA_DO_PEDIDO', 'Um dos itens recebidos não está no pedido. Confira a nota e o pedido.');
      const cert = r.lote?.certificado;
      if (item.rastreavel && !(r.lote?.codigo && (cert?.numero || cert?.corrida))) {
        throw regra('CERTIFICADO_OBRIGATORIO', `${item.descricao} é rastreável: informe o lote e o certificado do material (número ou corrida) para ele entrar no estoque.`);
      }
    }

    const hoje = hojeLocal();
    const noPrazo = hoje <= textoData(p.previsaoEntrega);
    const recebimentoId = randomUUID();
    const divergencias: { itemId: string; descricao: string; tipo: 'QUANTIDADE' | 'PRECO'; esperado: string; recebido: string; variacao?: string }[] = [];
    const alertas: string[] = [];
    const linhas: unknown[] = [];
    let valor = dec(0);

    await this.prisma.$transaction(async (tx) => {
      for (const r of dto.itens) {
        const item = itens.find((i) => i.id === r.itemId)!;
        const pi = p.itens.find((x) => x.itemId === r.itemId)!;
        const pendente = D(pi.quantidade).minus(D(pi.recebido));
        if (!dec(r.quantidade).eq(pendente)) {
          divergencias.push({ itemId: item.id, descricao: item.descricao, tipo: 'QUANTIDADE', esperado: txt(pendente), recebido: String(r.quantidade) });
        }
        const variacao = variacaoDePreco(String(r.precoUnitario), tt(pi.precoUnitario));
        if (dec(variacao).abs().gt(LIMITE_DIVERGENCIA_PRECO)) {
          divergencias.push({ itemId: item.id, descricao: item.descricao, tipo: 'PRECO', esperado: tt(pi.precoUnitario), recebido: String(r.precoUnitario), variacao });
        }
        valor = valor.plus(dec(r.quantidade).times(dec(r.precoUnitario)));

        const fator = D(item.fatorConversao).gt(0) ? D(item.fatorConversao) : dec(1);
        const qConsumo = dec(converterUnidade(String(r.quantidade), txt(fator)));
        const custoConsumo = txt(dec(r.precoUnitario).div(fator));
        const variacaoCusto = variacaoDePreco(custoConsumo, tt(item.custoMedio));
        let loteId: string | null = null;
        if (r.lote) {
          const lote = await tx.lote.create({
            data: {
              tenantId: s.tenantId,
              itemId: item.id,
              codigo: r.lote.codigo.trim(),
              fornecedorId: p.fornecedorId,
              recebimentoId,
              localId: dto.localId,
              quantidadeInicial: pd(txt(qConsumo)),
              saldo: pd(0),
              certificado: r.lote.certificado ? json(r.lote.certificado) : undefined
            }
          });
          loteId = lote.id;
        }
        await entrarComCusto(tx, {
          tenantId: s.tenantId,
          tipo: 'ENTRADA_RECEBIMENTO',
          item,
          localId: dto.localId,
          quantidade: qConsumo,
          custoUnitario: custoConsumo,
          loteId,
          recebimentoId,
          usuarioId: s.id,
          observacao: `${p.numero}${dto.notaFiscal ? ` · NF ${dto.notaFiscal}` : ''}`
        });
        await tx.pedidoItem.update({ where: { id: pi.id }, data: { recebido: { increment: pd(String(r.quantidade)) } } });
        await tx.fornecedorItem.upsert({
          where: { fornecedorId_itemId: { fornecedorId: p.fornecedorId, itemId: item.id } },
          create: { tenantId: s.tenantId, fornecedorId: p.fornecedorId, itemId: item.id, ultimoPreco: pd(String(r.precoUnitario)) },
          update: { ultimoPreco: pd(String(r.precoUnitario)), data: new Date() }
        });
        if (D(item.custoMedio).gt(0) && dec(variacaoCusto).abs().gt(LIMITE_CUSTO_DESATUALIZADO)) {
          const n = await marcarOrcamentosDesatualizados(tx, s.tenantId, item.id);
          alertas.push(
            `O custo de ${item.descricao} variou ${dec(variacaoCusto).times(100).toDecimalPlaces(1).toFixed()}% contra o custo médio${n ? `; ${n} orçamento(s) em rascunho ficaram com custo desatualizado` : ''}.`
          );
        }
        linhas.push({ itemId: item.id, descricao: item.descricao, quantidade: String(r.quantidade), precoUnitario: String(r.precoUnitario), loteId });
      }

      const primeiro = p.recebimentos.length === 0;
      if (primeiro) valor = valor.plus(D(p.frete));
      const categoria = itens.find((i) => i.categoriaDespesa)?.categoriaDespesa || 'materiaPrima';
      await tx.recebimento.create({
        data: {
          id: recebimentoId,
          tenantId: s.tenantId,
          pedidoId: p.id,
          localId: dto.localId,
          notaFiscal: dto.notaFiscal ?? null,
          itens: json(linhas),
          divergencias: json({ itens: divergencias, alertas }),
          noPrazo,
          contaPagar: json({ valor: txt(valor), vencimento: somarDias(hoje, diasDaCondicao(p.condicaoPagamento || p.fornecedor.condicaoPagamento)), categoria }),
          observacao: dto.observacao ?? null,
          usuarioId: s.id
        }
      });
      await tituloDoRecebimento(tx, s.tenantId, recebimentoId, s.id);
      const atualizados = await tx.pedidoItem.findMany({ where: { pedidoId: p.id } });
      const completo = atualizados.every((i) => D(i.recebido).gte(D(i.quantidade)));
      await tx.pedido.update({ where: { id: p.id }, data: { status: completo ? 'RECEBIDO' : 'PARCIAL' } });
      const f = await tx.fornecedor.findUniqueOrThrow({ where: { id: p.fornecedorId } });
      await tx.fornecedor.update({
        where: { id: f.id },
        data: {
          avaliacao: pd(
            avaliarFornecedor({
              notaAtual: tt(f.avaliacao),
              entregas: f.entregas,
              noPrazo,
              divergenciaQuantidade: divergencias.some((d) => d.tipo === 'QUANTIDADE'),
              divergenciaPreco: divergencias.some((d) => d.tipo === 'PRECO')
            })
          ),
          entregas: { increment: 1 }
        }
      });
    });
    return this.pedido(s.tenantId, id);
  }

  private cabecalho(p: PedidoCompleto, itens: { id: string; codigo: string; descricao: string; unidadeCompra: string }[] = []) {
    const atrasado = ['APROVADO', 'PARCIAL'].includes(p.status) && textoData(p.previsaoEntrega) < hojeLocal();
    return {
      id: p.id,
      numero: p.numero,
      status: p.status,
      fornecedor: { id: p.fornecedor.id, nome: p.fornecedor.nome },
      cotacaoId: p.cotacaoId,
      frete: tt(p.frete),
      total: tt(p.total),
      previsaoEntrega: textoData(p.previsaoEntrega),
      atrasado,
      condicaoPagamento: p.condicaoPagamento,
      observacao: p.observacao,
      aprovadoPorId: p.aprovadoPorId,
      aprovadoEm: p.aprovadoEm,
      criadoEm: p.criadoEm,
      itens: p.itens.map((i) => {
        const item = itens.find((x) => x.id === i.itemId);
        return {
          id: i.id,
          itemId: i.itemId,
          codigo: item?.codigo,
          descricao: item?.descricao,
          unidade: item?.unidadeCompra,
          quantidade: tt(i.quantidade),
          precoUnitario: tt(i.precoUnitario),
          recebido: tt(i.recebido),
          pendente: txt(D(i.quantidade).minus(D(i.recebido)).gt(0) ? D(i.quantidade).minus(D(i.recebido)) : dec(0))
        };
      }),
      recebimentos: p.recebimentos.map((r) => {
        const div = r.divergencias as { itens: unknown[]; alertas: string[] };
        return { id: r.id, data: r.data, localId: r.localId, notaFiscal: r.notaFiscal, itens: r.itens, divergencias: div.itens, alertas: div.alertas, noPrazo: r.noPrazo, contaPagar: r.contaPagar, observacao: r.observacao };
      })
    };
  }

  private geral(respostas: { fornecedorId: string; itens: Prisma.JsonValue; frete: Prisma.Decimal; prazoDias: number }[], itens: ItemCotado[], aval: (id: string) => string) {
    const completas = respostas.filter((r) => itens.every((i) => (r.itens as PrecoCotado[]).some((p) => p.itemId === i.itemId)));
    return compararCotacoes(
      completas.map((r) => ({
        fornecedorId: r.fornecedorId,
        quantidade: '1',
        precoUnitario: txt(soma(itens.map((i) => dec(i.quantidade).times(dec((r.itens as PrecoCotado[]).find((p) => p.itemId === i.itemId)!.precoUnitario))))),
        frete: tt(r.frete),
        prazoDias: r.prazoDias,
        avaliacao: aval(r.fornecedorId)
      }))
    );
  }

  private async cotacaoAberta(tenantId: string, id: string) {
    const c = await this.prisma.cotacao.findFirst({ where: { id, tenantId }, include: { respostas: true } });
    if (!c) throw naoEncontrado('essa cotação');
    if (c.status !== 'ABERTA') throw conflito('COTACAO_ENCERRADA', `${c.numero} já foi encerrada com a escolha do fornecedor.`);
    return c;
  }

  private async buscarPedido(tenantId: string, id: string) {
    const p = await this.prisma.pedido.findFirst({ where: { id, tenantId }, include: incluirPedido });
    if (!p) throw naoEncontrado('esse pedido de compra');
    return p;
  }
}

export async function criarRequisicao(
  db: Db,
  tenantId: string,
  r: { origem: 'OS' | 'PONTO_PEDIDO' | 'MANUAL'; osId?: string | null; observacao?: string; usuarioId?: string; itens: { itemId: string; quantidade: string }[] }
) {
  const numero = await proximoNumero(db, tenantId, 'REQ');
  return db.requisicao.create({
    data: {
      tenantId,
      numero,
      origem: r.origem,
      osId: r.osId ?? null,
      observacao: r.observacao ?? '',
      usuarioId: r.usuarioId,
      itens: { create: r.itens.map((i) => ({ tenantId, itemId: i.itemId, quantidade: pd(i.quantidade) })) }
    }
  });
}

export async function criarPedido(
  tx: Db,
  tenantId: string,
  parametros: { limiteAprovacaoCompra: Prisma.Decimal },
  p: { fornecedorId: string; cotacaoId?: string; frete: string; prazoDias: number; itens: { itemId: string; quantidade: string; precoUnitario: string }[]; observacao: string }
) {
  const f = await tx.fornecedor.findUniqueOrThrow({ where: { id: p.fornecedorId } });
  const total = soma(p.itens.map((i) => dec(i.quantidade).times(dec(i.precoUnitario)))).plus(dec(p.frete));
  if (!p.itens.length) throw invalido('O pedido precisa de pelo menos um item.');
  return tx.pedido.create({
    data: {
      tenantId,
      numero: await proximoNumero(tx, tenantId, 'PC'),
      fornecedorId: p.fornecedorId,
      cotacaoId: p.cotacaoId ?? null,
      status: total.gt(tt(parametros.limiteAprovacaoCompra)) ? 'AGUARDANDO_APROVACAO' : 'APROVADO',
      frete: pd(p.frete),
      total: pd(txt(total)),
      previsaoEntrega: dataBanco(somarDias(hojeLocal(), p.prazoDias)),
      condicaoPagamento: f.condicaoPagamento,
      observacao: p.observacao,
      itens: { create: p.itens.map((i) => ({ tenantId, itemId: i.itemId, quantidade: pd(i.quantidade), precoUnitario: pd(i.precoUnitario) })) }
    }
  });
}

/** Orçamentos em rascunho que usam o item passam a avisar custo de material desatualizado. */
export async function marcarOrcamentosDesatualizados(db: Db, tenantId: string, itemId: string) {
  const rascunhos = await db.orcamento.findMany({ where: { tenantId, status: 'RASCUNHO' }, select: { id: true, linhas: true } });
  const ids = rascunhos.filter((o) => (o.linhas as unknown as LinhaOrcamento[]).some((l) => (l as { itemId?: string }).itemId === itemId)).map((o) => o.id);
  if (ids.length) await db.orcamento.updateMany({ where: { id: { in: ids } }, data: { custoDesatualizado: true } });
  return ids.length;
}
