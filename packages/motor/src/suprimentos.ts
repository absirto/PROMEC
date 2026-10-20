import { dec, soma, txt, UM, ZERO, type Dec, type Num } from './numero.js';

/** Custo médio ponderado após uma entrada. Saldo negativo ou zerado assume o custo da entrada. */
export function custoMedioAposEntrada(p: { saldo: Num; custoMedio: Num; quantidade: Num; custoUnitario: Num }): { saldo: string; custoMedio: string } {
  const saldo = dec(p.saldo);
  const q = dec(p.quantidade);
  if (q.lte(0)) throw new RangeError('A quantidade da entrada precisa ser maior que zero.');
  const novoSaldo = saldo.plus(q);
  const medio = saldo.lte(0)
    ? dec(p.custoUnitario)
    : saldo.times(dec(p.custoMedio)).plus(q.times(dec(p.custoUnitario))).div(novoSaldo);
  return { saldo: txt(novoSaldo), custoMedio: txt(medio) };
}

/** Converte da unidade de compra para a de consumo (ex.: barra de 6 m → 6000 mm). */
export const converterUnidade = (quantidade: Num, fator: Num): string => txt(dec(quantidade).times(dec(fator)));

/** Ponto de pedido: abaixo do mínimo, sugere completar até o máximo. */
export function sugestaoDeCompra(p: { disponivel: Num; minimo: Num; maximo: Num }): string {
  const disp = dec(p.disponivel);
  if (disp.gte(dec(p.minimo))) return '0';
  const q = dec(p.maximo).minus(disp);
  return txt(q.gt(0) ? q : ZERO);
}

export interface RespostaCotacao {
  fornecedorId: string;
  precoUnitario: Num;
  quantidade: Num;
  frete?: Num;
  prazoDias: number;
  /** Avaliação do fornecedor de 0 a 5. */
  avaliacao?: Num;
}

export interface ResultadoCotacao {
  fornecedorId: string;
  total: string;
  nota: string;
  posicao: number;
  melhorPreco: boolean;
  melhorPrazo: boolean;
}

/**
 * Comparativo de cotações: nota de 0 a 1 ponderando preço total (com frete), prazo e avaliação.
 * Preço: menor total ÷ total. Prazo: perde 1/30 por dia além do mais rápido. Avaliação: nota ÷ 5.
 */
export function compararCotacoes(
  respostas: RespostaCotacao[],
  pesos: { preco: Num; prazo: Num; avaliacao: Num } = { preco: '0.6', prazo: '0.25', avaliacao: '0.15' }
): ResultadoCotacao[] {
  if (respostas.length === 0) return [];
  const linhas = respostas.map((r) => ({
    r,
    total: dec(r.precoUnitario).times(dec(r.quantidade)).plus(dec(r.frete)),
    prazo: dec(Math.max(r.prazoDias, 0)),
    aval: dec(r.avaliacao ?? 3)
  }));
  const menorTotal = linhas.reduce((m, l) => (l.total.lt(m) ? l.total : m), linhas[0].total);
  const menorPrazo = linhas.reduce((m, l) => (l.prazo.lt(m) ? l.prazo : m), linhas[0].prazo);
  const pp = dec(pesos.preco);
  const pz = dec(pesos.prazo);
  const pa = dec(pesos.avaliacao);
  const somaPesos = pp.plus(pz).plus(pa);
  const notas = linhas.map((l) => {
    const np = l.total.isZero() ? UM : menorTotal.div(l.total);
    const atraso = UM.minus(l.prazo.minus(menorPrazo).div(30));
    const nz = atraso.lt(0) ? ZERO : atraso;
    const na = l.aval.div(5);
    return { l, nota: np.times(pp).plus(nz.times(pz)).plus(na.times(pa)).div(somaPesos) };
  });
  const ordem = [...notas].sort((a, b) => b.nota.comparedTo(a.nota) || a.l.total.comparedTo(b.l.total));
  return notas.map((n) => ({
    fornecedorId: n.l.r.fornecedorId,
    total: txt(n.l.total),
    nota: txt(n.nota),
    posicao: ordem.indexOf(n) + 1,
    melhorPreco: n.l.total.eq(menorTotal),
    melhorPrazo: n.l.prazo.eq(menorPrazo)
  }));
}

export interface ItemConsumo {
  id: string;
  /** Valor consumido no período (quantidade × custo). */
  valor: Num;
}

/** Curva ABC por valor de consumo: A até 80% acumulado, B até 95%, C o resto. */
export function curvaABC(itens: ItemConsumo[]): { id: string; valor: string; participacao: string; acumulado: string; classe: 'A' | 'B' | 'C' }[] {
  const ordenados = itens.map((i) => ({ id: i.id, v: dec(i.valor) })).sort((a, b) => b.v.comparedTo(a.v) || (a.id < b.id ? -1 : 1));
  const total = soma(ordenados.map((i) => i.v));
  let acumuladoAntes = ZERO;
  return ordenados.map((i) => {
    const part = total.isZero() ? ZERO : i.v.div(total);
    const classe = acumuladoAntes.lt('0.8') ? 'A' : acumuladoAntes.lt('0.95') ? 'B' : 'C';
    acumuladoAntes = acumuladoAntes.plus(part);
    return { id: i.id, valor: txt(i.v), participacao: txt(part), acumulado: txt(acumuladoAntes), classe };
  });
}

/** Variação de preço de compra contra o custo de referência (fração; positivo = ficou mais caro). */
export const variacaoDePreco = (novo: Num, referencia: Num): string => {
  const ref = dec(referencia);
  return txt(ref.isZero() ? ZERO : dec(novo).minus(ref).div(ref));
};

export interface Medicao {
  nominal: Num;
  /** Tolerância inferior e superior relativas ao nominal (ex.: H7 em Ø20 → 0 e +0,021). */
  tolInferior: Num;
  tolSuperior: Num;
  medido: Num;
}

/** Medida dentro da faixa? Posição de 0 a 1 na faixa, para a barra com marcador. */
export function avaliarMedicao(m: Medicao): { conforme: boolean; minimo: string; maximo: string; desvio: string; posicao: string } {
  const nominal = dec(m.nominal);
  const min = nominal.plus(dec(m.tolInferior));
  const max = nominal.plus(dec(m.tolSuperior));
  if (max.lt(min)) throw new RangeError('A tolerância superior precisa ser maior que a inferior.');
  const med = dec(m.medido);
  const faixa = max.minus(min);
  const pos = faixa.isZero() ? (med.eq(min) ? dec('0.5') : med.lt(min) ? ZERO : UM) : med.minus(min).div(faixa);
  return {
    conforme: med.gte(min) && med.lte(max),
    minimo: txt(min),
    maximo: txt(max),
    desvio: txt(med.minus(nominal)),
    posicao: txt(pos)
  };
}

/** Avaliação do fornecedor (0 a 5) após um recebimento: média móvel com peso da entrega atual. */
export function avaliarFornecedor(p: { notaAtual: Num; entregas: number; noPrazo: boolean; divergenciaQuantidade: boolean; divergenciaPreco: boolean; naoConforme?: boolean }): string {
  let nota: Dec = dec(5);
  if (!p.noPrazo) nota = nota.minus(1.5);
  if (p.divergenciaQuantidade) nota = nota.minus(1);
  if (p.divergenciaPreco) nota = nota.minus(1);
  if (p.naoConforme) nota = nota.minus(2);
  if (nota.lt(0)) nota = ZERO;
  const n = Math.max(p.entregas, 0);
  return txt(dec(p.notaAtual).times(n).plus(nota).div(n + 1));
}
