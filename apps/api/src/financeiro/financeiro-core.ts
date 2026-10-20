import { randomUUID } from 'node:crypto';
import { CentroCusto, Parametros, Prisma, Titulo, TipoTitulo } from '@prisma/client';
import { comissaoSobre, dec, distribuirBaixa, encargosDeAtraso, gerarParcelas, interpretarCondicao, soma, type Dec, type LinhaOrcamento } from '@promec/motor';
import { pd, tt } from '../comum/decimal';
import { regra } from '../comum/erros';
import { proximoNumero } from '../orcamentos/numeracao';
import { dataBanco, hojeLocal, local, somarDias, textoData } from '../planejamento/calendario';
import { Db } from '../tabelas-custos/entrada';
import { criarFollowUps } from '../crm/crm-core';
import { notificacoesDaRotina, notificar } from '../notificacoes/notificacoes-core';
import { gerarPreventivas } from '../manutencao/manutencao-core';

export const ABERTOS = ['ABERTO', 'PARCIAL'] as const;
export const reaisTxt = (v: Prisma.Decimal | string | number) => dec(typeof v === 'object' ? tt(v) : v).toFixed(2);
export const saldoDo = (t: Pick<Titulo, 'valor' | 'valorPago'>) => dec(tt(t.valor)).minus(tt(t.valorPago));
export const diasEntre = (a: string, b: string) => Math.round((dataBanco(b).getTime() - dataBanco(a).getTime()) / 86_400_000);
export const diasAtraso = (t: Pick<Titulo, 'valor' | 'valorPago' | 'status' | 'vencimento'>, hoje = hojeLocal()) =>
  (ABERTOS as readonly string[]).includes(t.status) && saldoDo(t).gt(0) ? Math.max(0, diasEntre(textoData(t.vencimento), hoje)) : 0;

/** Prazos da condição de pagamento; texto que o motor não entende vira 422 CONDICAO_INVALIDA. */
export function prazosDe(condicao: string) {
  try {
    return interpretarCondicao(condicao);
  } catch (e) {
    throw regra('CONDICAO_INVALIDA', e instanceof Error ? `${e.message}` : 'Condição de pagamento inválida.', { condicao });
  }
}

export const NOMES_PAPEL: Record<string, [string, 'FIXO' | 'VARIAVEL']> = {
  RECEITA_SERVICOS: ['Receita de serviços', 'VARIAVEL'],
  COMISSOES: ['Comissões', 'VARIAVEL'],
  'CATEGORIA:materiaPrima': ['Matéria-prima', 'VARIAVEL'],
  'CATEGORIA:pecas': ['Peças de reposição', 'VARIAVEL'],
  'CATEGORIA:insumos': ['Insumos', 'VARIAVEL'],
  'CATEGORIA:ferramentaria': ['Ferramentaria', 'VARIAVEL']
};

/** Centro de custo de sistema (receita, comissões, categoria de compra), criado na primeira vez. */
export async function centroPorPapel(db: Db, tenantId: string, papel: string): Promise<CentroCusto> {
  const existe = await db.centroCusto.findFirst({ where: { tenantId, papel } });
  if (existe) return existe;
  const [nome, tipo] = NOMES_PAPEL[papel] ?? [papel.replace('CATEGORIA:', ''), 'VARIAVEL'];
  return db.centroCusto.create({ data: { tenantId, nome, tipo, papel } });
}

export interface NovoTitulo {
  tipo: TipoTitulo;
  pessoaTipo: 'CLIENTE' | 'FORNECEDOR' | 'VENDEDOR' | 'OUTRO';
  clienteId?: string | null;
  fornecedorId?: string | null;
  usuarioId?: string | null;
  pessoaNome: string;
  descricao: string;
  centroCustoId: string;
  competencia: string;
  emissao?: string;
  documentoFiscal?: string | null;
  observacao?: string | null;
  origemTipo?: string;
  origemId?: string | null;
  origemNumero?: string | null;
  recorrenciaId?: string | null;
  renegociadoDeId?: string | null;
}

/** Um título por parcela, com centavos exatos do motor e grupo comum quando há mais de uma. */
export async function criarTitulos(db: Db, tenantId: string, t: NovoTitulo, parcelas: { vencimento: string; valor: string }[], usuarioId?: string) {
  const grupoId = parcelas.length > 1 ? randomUUID() : null;
  const criados: Titulo[] = [];
  for (const [i, p] of parcelas.entries()) {
    const parcela = parcelas.length > 1 ? `${i + 1}/${parcelas.length}` : null;
    const titulo = await db.titulo.create({
      data: {
        tenantId,
        numero: await proximoNumero(db, tenantId, t.tipo === 'RECEBER' ? 'CR' : 'CP'),
        tipo: t.tipo,
        pessoaTipo: t.pessoaTipo,
        clienteId: t.clienteId ?? null,
        fornecedorId: t.fornecedorId ?? null,
        usuarioId: t.usuarioId ?? null,
        pessoaNome: t.pessoaNome,
        descricao: parcela ? `${t.descricao} · parcela ${parcela}` : t.descricao,
        parcela,
        grupoId,
        centroCustoId: t.centroCustoId,
        competencia: t.competencia,
        emissao: dataBanco(t.emissao ?? hojeLocal()),
        vencimento: dataBanco(p.vencimento),
        valor: pd(p.valor),
        documentoFiscal: t.documentoFiscal ?? null,
        observacao: t.observacao ?? null,
        origemTipo: t.origemTipo ?? 'MANUAL',
        origemId: t.origemId ?? null,
        origemNumero: t.origemNumero ?? null,
        recorrenciaId: t.recorrenciaId ?? null,
        renegociadoDeId: t.renegociadoDeId ?? null
      }
    });
    await historico(db, tenantId, titulo.id, 'criado', t.origemNumero ? `Origem ${t.origemNumero}` : undefined, usuarioId);
    criados.push(titulo);
  }
  return criados;
}

export const historico = (db: Db, tenantId: string, tituloId: string, evento: string, detalhe?: string, usuarioId?: string) =>
  db.tituloHistorico.create({ data: { tenantId, tituloId, evento, detalhe, usuarioId } });

/** Entrega da OS: títulos a receber pela condição do orçamento, do cliente ou a padrão. Garantia sem preço não gera. */
export async function gerarTitulosDaOs(db: Db, tenantId: string, osId: string, usuarioId?: string) {
  const os = await db.ordemServico.findUniqueOrThrow({ where: { id: osId }, include: { cliente: true, orcamento: true } });
  if (dec(tt(os.precoFinalLote)).toDecimalPlaces(2).lte(0)) return [];
  if (await db.titulo.findFirst({ where: { tenantId, origemTipo: 'OS', origemId: os.id } })) return [];
  const p = await db.parametros.findUniqueOrThrow({ where: { tenantId } });
  const condicao = os.orcamento?.condicaoPagamento || os.cliente.condicaoPagamento || p.condicaoPadrao;
  const base = local(os.entregueEm ?? new Date()).data;
  const parcelas = gerarParcelas({ valor: tt(os.precoFinalLote), dataBase: base, prazos: prazosDe(condicao) });
  const receita = await centroPorPapel(db, tenantId, 'RECEITA_SERVICOS');
  return criarTitulos(
    db,
    tenantId,
    {
      tipo: 'RECEBER',
      pessoaTipo: 'CLIENTE',
      clienteId: os.clienteId,
      pessoaNome: os.cliente.fantasia || os.cliente.nome,
      descricao: os.numero,
      centroCustoId: receita.id,
      competencia: base.slice(0, 7),
      emissao: base,
      origemTipo: 'OS',
      origemId: os.id,
      origemNumero: os.numero
    },
    parcelas,
    usuarioId
  );
}

type ContaPagar = { valor: string; vencimento: string; categoria: string };

/** Recebimento de compra vira título a pagar (uma vez só por recebimento). */
export async function tituloDoRecebimento(db: Db, tenantId: string, recebimentoId: string, usuarioId?: string) {
  if (await db.titulo.findFirst({ where: { tenantId, origemTipo: 'RECEBIMENTO', origemId: recebimentoId } })) return null;
  const r = await db.recebimento.findUniqueOrThrow({ where: { id: recebimentoId }, include: { pedido: { include: { fornecedor: true } } } });
  const cp = r.contaPagar as ContaPagar;
  if (!cp?.valor || dec(cp.valor).lte(0)) return null;
  const centro = await centroPorPapel(db, tenantId, `CATEGORIA:${cp.categoria || 'materiaPrima'}`);
  const [t] = await criarTitulos(
    db,
    tenantId,
    {
      tipo: 'PAGAR',
      pessoaTipo: 'FORNECEDOR',
      fornecedorId: r.pedido.fornecedorId,
      pessoaNome: r.pedido.fornecedor.fantasia || r.pedido.fornecedor.nome,
      descricao: `${r.pedido.numero}${r.notaFiscal ? ` · NF ${r.notaFiscal}` : ''}`,
      centroCustoId: centro.id,
      competencia: local(r.data).data.slice(0, 7),
      emissao: local(r.data).data,
      documentoFiscal: r.notaFiscal,
      origemTipo: 'RECEBIMENTO',
      origemId: r.id,
      origemNumero: r.pedido.numero
    },
    [{ vencimento: cp.vencimento, valor: dec(cp.valor).toFixed(2) }],
    usuarioId
  );
  return t;
}

export async function converterContasPagar(db: Db, tenantId: string) {
  const rs = await db.recebimento.findMany({ where: { tenantId }, select: { id: true } });
  let n = 0;
  for (const r of rs) if (await tituloDoRecebimento(db, tenantId, r.id)) n++;
  return n;
}

const ultimoDia = (competencia: string) => {
  const [a, m] = competencia.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};
export const vencimentoNaCompetencia = (competencia: string, dia: number) => `${competencia}-${String(Math.min(dia, ultimoDia(competencia))).padStart(2, '0')}`;

/** Títulos do mês das recorrências ativas, sem duplicar. */
export async function gerarRecorrencias(db: Db, tenantId: string, competencia: string, usuarioId?: string) {
  const inicioMes = dataBanco(`${competencia}-01`);
  const fimMes = dataBanco(vencimentoNaCompetencia(competencia, 31));
  const rs = await db.recorrencia.findMany({ where: { tenantId, ativa: true, inicio: { lte: fimMes }, OR: [{ fim: null }, { fim: { gte: inicioMes } }] } });
  const fornecedores = await db.fornecedor.findMany({ where: { tenantId, id: { in: rs.map((r) => r.fornecedorId).filter(Boolean) as string[] } } });
  let geradas = 0;
  for (const r of rs) {
    if (await db.titulo.findFirst({ where: { recorrenciaId: r.id, competencia } })) continue;
    const f = fornecedores.find((x) => x.id === r.fornecedorId);
    await criarTitulos(
      db,
      tenantId,
      {
        tipo: 'PAGAR',
        pessoaTipo: f ? 'FORNECEDOR' : 'OUTRO',
        fornecedorId: f?.id ?? null,
        pessoaNome: f ? f.fantasia || f.nome : r.descricao,
        descricao: `${r.descricao} · ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`,
        centroCustoId: r.centroCustoId,
        competencia,
        emissao: `${competencia}-01`,
        origemTipo: 'RECORRENCIA',
        origemId: r.id,
        recorrenciaId: r.id
      },
      [{ vencimento: vencimentoNaCompetencia(competencia, r.diaVencimento), valor: reaisTxt(r.valor) }],
      usuarioId
    );
    geradas++;
  }
  return geradas;
}

export interface DadosBaixa {
  data: string;
  valor?: string;
  contaId: string;
  multa?: string;
  juros?: string;
  desconto?: string;
  observacao?: string;
  usuarioId?: string;
}

/** Encargos e valor devido se baixar o saldo na data. */
export const devidoEm = (t: Titulo, data: string, p: Pick<Parametros, 'multaAtraso' | 'jurosMes'>) =>
  encargosDeAtraso({ valor: saldoDo(t).toFixed(2), vencimento: textoData(t.vencimento), dataPagamento: data, multa: tt(p.multaAtraso), jurosMes: tt(p.jurosMes) });

/** Baixa total ou parcial; gera comissão quando o título vem de OS com comissão no orçamento. */
export async function registrarBaixa(db: Db, tenantId: string, t: Titulo, b: DadosBaixa, p: Pick<Parametros, 'multaAtraso' | 'jurosMes'>) {
  if (!(ABERTOS as readonly string[]).includes(t.status)) {
    throw regra('TITULO_FECHADO', `${t.numero} está ${t.status.toLowerCase()}; não há saldo para baixar.`);
  }
  const saldo = saldoDo(t);
  const desconto = dec(b.desconto ?? 0);
  let valor: Dec;
  let multa: Dec;
  let juros: Dec;
  let abatido: Dec;
  let quita: boolean;
  if (b.multa === undefined && b.juros === undefined) {
    // Cada real de principal carrega a sua multa e os seus juros: pagar em partes custa o mesmo que pagar de uma vez.
    const distribuir = (valorRecebido: string) => {
      try {
        return distribuirBaixa({
          valorRecebido,
          saldo: saldo.toFixed(2),
          vencimento: textoData(t.vencimento),
          dataPagamento: b.data,
          desconto: desconto.toFixed(2),
          multa: tt(p.multaAtraso),
          jurosMes: tt(p.jurosMes)
        });
      } catch (e) {
        if (e instanceof RangeError && /passa do devido/.test(e.message)) {
          const devido = /\(([\d.]+)\)/.exec(e.message)?.[1];
          throw regra('VALOR_ACIMA_DO_DEVIDO', `O valor passa do devido hoje${devido ? ` (R$ ${devido.replace('.', ',')})` : ''}. Confira o valor e o desconto.`, { devido });
        }
        if (e instanceof RangeError) throw regra('VALOR_INVALIDO', `${e.message} Confira o valor da baixa.`);
        throw e;
      }
    };
    const d = distribuir(b.valor ?? distribuir('0.01').devidoTotal);
    valor = dec(b.valor ?? d.devidoTotal);
    multa = dec(d.multa);
    juros = dec(d.juros);
    abatido = d.quita ? saldo : dec(d.principal);
    quita = d.quita;
  } else {
    const auto = devidoEm(t, b.data, p);
    multa = dec(b.multa ?? auto.multa);
    juros = dec(b.juros ?? auto.juros);
    const devido = saldo.plus(multa).plus(juros).minus(desconto);
    valor = dec(b.valor ?? devido.toFixed(2));
    if (valor.lte(0)) throw regra('VALOR_INVALIDO', 'O valor da baixa precisa ser maior que zero.');
    if (valor.gt(devido.plus('0.005'))) {
      throw regra('VALOR_ACIMA_DO_DEVIDO', `O valor passa do devido hoje (R$ ${devido.toFixed(2).replace('.', ',')}). Confira multa, juros e desconto.`, { devido: devido.toFixed(2) });
    }
    const principal = valor.minus(multa).minus(juros).plus(desconto);
    if (principal.lte(0)) throw regra('VALOR_INSUFICIENTE', 'O valor não cobre nem a multa e os juros. Informe um valor maior ou dispense os encargos.');
    abatido = principal.gt(saldo) ? saldo : principal;
    quita = abatido.gte(saldo);
  }
  const baixa = await db.baixa.create({
    data: {
      tenantId,
      tituloId: t.id,
      contaId: b.contaId,
      data: dataBanco(b.data),
      valor: pd(valor.toFixed(2)),
      principal: pd(abatido.toFixed(2)),
      multa: pd(multa.toFixed(2)),
      juros: pd(juros.toFixed(2)),
      desconto: pd(desconto.toFixed(2)),
      observacao: b.observacao ?? null,
      usuarioId: b.usuarioId ?? null
    }
  });
  const pago = dec(tt(t.valorPago)).plus(abatido);
  await db.titulo.update({ where: { id: t.id }, data: { valorPago: pd(pago.toFixed(2)), status: quita || pago.gte(tt(t.valor)) ? 'PAGO' : 'PARCIAL' } });
  await historico(db, tenantId, t.id, 'baixa', `R$ ${valor.toFixed(2)} em ${b.data}${multa.plus(juros).gt(0) ? ` (multa ${multa.toFixed(2)}, juros ${juros.toFixed(2)})` : ''}`, b.usuarioId);
  await gerarComissao(db, tenantId, t, baixa.id, abatido.toFixed(2), b.data);
  return baixa;
}

async function gerarComissao(db: Db, tenantId: string, t: Titulo, baixaId: string, base: string, data: string) {
  if (t.tipo !== 'RECEBER' || t.origemTipo !== 'OS' || !t.origemId) return;
  const os = await db.ordemServico.findUnique({ where: { id: t.origemId }, include: { orcamento: true } });
  const o = os?.orcamento;
  if (!o?.vendedorId || o.comissao.lte(0)) return;
  await db.comissao.create({
    data: { tenantId, vendedorId: o.vendedorId, tituloId: t.id, baixaId, competencia: data.slice(0, 7), base: pd(base), percentual: o.comissao, valor: pd(comissaoSobre(base, tt(o.comissao))) }
  });
}

/** Rotina diária: recorrências do mês e bloqueio comercial por inadimplência. */
export async function rotinaDiaria(db: Db, tenantId: string) {
  const hoje = hojeLocal();
  const p = await db.parametros.findUniqueOrThrow({ where: { tenantId } });
  const recorrenciasGeradas = await gerarRecorrencias(db, tenantId, hoje.slice(0, 7));
  const limite = dataBanco(somarDias(hoje, -p.diasBloqueioInadimplencia));
  const vencidos = await db.titulo.findMany({ where: { tenantId, tipo: 'RECEBER', status: { in: [...ABERTOS] }, vencimento: { lt: limite }, clienteId: { not: null } } });
  const ids = [...new Set(vencidos.map((t) => t.clienteId!))];
  const bloquear = await db.cliente.findMany({
    where: { tenantId, id: { in: ids }, status: 'ATIVO', OR: [{ liberadoAte: null }, { liberadoAte: { lt: dataBanco(hoje) } }] }
  });
  for (const c of bloquear) await db.cliente.update({ where: { id: c.id }, data: { status: 'BLOQUEADO', bloqueioAutomatico: true } });
  const followUps = await criarFollowUps(db, tenantId);
  const preventivas = await gerarPreventivas(db, tenantId);
  const vencendo = await db.habilitacao.findMany({ where: { tenantId, validade: { gte: dataBanco(hoje), lte: dataBanco(somarDias(hoje, 30)) } } });
  for (const h of vencendo) {
    const c = await db.colaborador.findUnique({ where: { id: h.colaboradorId }, select: { nome: true } });
    await notificar(db, tenantId, {
      permissoes: ['rh.visualizar'],
      tipo: 'ATENCAO',
      titulo: `Habilitação vencendo: ${c?.nome ?? 'colaborador'}`,
      mensagem: `${h.descricao} vence em ${textoData(h.validade).split('-').reverse().join('/')}. Agende a renovação para não travar o apontamento.`,
      link: '/rh/habilitacoes?vencendo=30',
      chave: `habilitacao-${h.id}-${textoData(h.validade)}`
    });
  }
  const notificacoes = await notificacoesDaRotina(db, tenantId);
  await db.parametros.update({ where: { tenantId }, data: { rotinaExecutadaEm: dataBanco(hoje) } });
  return {
    followUps,
    preventivas,
    notificacoes,
    recorrenciasGeradas,
    clientesBloqueados: bloquear.map((c) => ({ id: c.id, nome: c.nome })),
    alertas: bloquear.map((c) => ({
      tipo: 'atencao' as const,
      mensagem: `${c.fantasia || c.nome} foi bloqueado: tem título vencido há mais de ${p.diasBloqueioInadimplencia} dias. Um gestor pode liberar por 7 dias.`,
      link: `/clientes/${c.id}`
    }))
  };
}

/** Linhas de peças de reposição no custo orçado da OS (para separar receita de peças). */
export const linhasComItem = (linhas: unknown) => (linhas as LinhaOrcamento[]).filter((l) => (l as { itemId?: string }).itemId);
export const somaDec = (vs: (Prisma.Decimal | string)[]) => soma(vs.map((v) => dec(typeof v === 'string' ? v : tt(v))));
