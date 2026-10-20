import { dec, fracao, soma, txt, ZERO, type Dec, type Num } from './numero.js';

const DIA = 86_400_000;
const paraData = (s: string) => {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const paraTexto = (t: number) => new Date(t).toISOString().slice(0, 10);
const somarDias = (s: string, n: number) => paraTexto(paraData(s) + n * DIA);
const diasEntre = (a: string, b: string) => Math.round((paraData(b) - paraData(a)) / DIA);

/**
 * Lê uma condição de pagamento em texto: "à vista", "28 dias", "30/60/90", "entrada + 30/60",
 * "3x" (30/60/90). Devolve os prazos em dias a partir da data base.
 */
export function interpretarCondicao(texto: string): number[] {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (!t || /a vista|avista|pix|dinheiro/.test(t)) return [0];
  const entrada = /entrada|sinal|\bent\b/.test(t);
  const vezes = t.match(/(\d+)\s*x/);
  let prazos: number[];
  if (vezes && !t.includes('/')) {
    const n = Number(vezes[1]);
    prazos = Array.from({ length: n }, (_, i) => (i + 1) * 30);
  } else {
    prazos = (t.match(/\d+/g) ?? []).map(Number).filter((n) => n <= 720);
  }
  if (entrada) prazos = [0, ...prazos];
  const unicos = [...new Set(prazos)].sort((a, b) => a - b);
  if (unicos.length === 0) throw new RangeError(`Não entendi a condição "${texto}". Use algo como "30/60/90" ou "entrada + 30".`);
  return unicos;
}

export interface Parcela {
  numero: number;
  vencimento: string;
  valor: string;
}

/**
 * Parcelas em centavos exatos: divide igualmente e a diferença de arredondamento vai na primeira.
 * Com `entrada`, a primeira parcela (prazo 0) vale esse percentual do total.
 */
export function gerarParcelas(p: { valor: Num; dataBase: string; prazos: number[]; entrada?: Num }): Parcela[] {
  const total = dec(p.valor).toDecimalPlaces(2);
  if (total.lte(0)) throw new RangeError('O valor do título precisa ser maior que zero.');
  if (p.prazos.length === 0) throw new RangeError('Informe pelo menos um prazo.');
  const prazos = [...p.prazos].sort((a, b) => a - b);
  const valores: Dec[] = [];
  let restantes = prazos;
  let saldo = total;
  if (p.entrada !== undefined && prazos[0] === 0 && prazos.length > 1) {
    const ent = total.times(fracao(p.entrada, 'Entrada')).toDecimalPlaces(2);
    valores.push(ent);
    saldo = total.minus(ent);
    restantes = prazos.slice(1);
  }
  const n = restantes.length;
  const base = saldo.div(n).toDecimalPlaces(2, 1); // para baixo
  const sobra = saldo.minus(base.times(n));
  restantes.forEach((_, i) => valores.push(i === 0 ? base.plus(sobra) : base));
  return prazos.map((d, i) => ({ numero: i + 1, vencimento: somarDias(p.dataBase, d), valor: valores[i].toFixed(2) }));
}

/** Multa fixa e juros simples pró-rata dia (juros ao mês ÷ 30) sobre o valor em aberto. */
export function encargosDeAtraso(p: { valor: Num; vencimento: string; dataPagamento: string; multa?: Num; jurosMes?: Num }): {
  diasAtraso: number;
  multa: string;
  juros: string;
  total: string;
} {
  const dias = Math.max(0, diasEntre(p.vencimento, p.dataPagamento));
  const valor = dec(p.valor);
  if (dias === 0) return { diasAtraso: 0, multa: '0.00', juros: '0.00', total: valor.toFixed(2) };
  const multa = valor.times(fracao(p.multa ?? '0.02', 'Multa')).toDecimalPlaces(2);
  const juros = valor.times(fracao(p.jurosMes ?? '0.01', 'Juros')).div(30).times(dias).toDecimalPlaces(2);
  return { diasAtraso: dias, multa: multa.toFixed(2), juros: juros.toFixed(2), total: valor.plus(multa).plus(juros).toFixed(2) };
}

export interface LancamentoCaixa {
  data: string;
  /** Positivo entra, negativo sai. */
  valor: Num;
  realizado: boolean;
}

export interface PontoCaixa {
  inicio: string;
  entradas: string;
  saidas: string;
  saldoFinal: string;
  entradasPrevistas: string;
  saidasPrevistas: string;
  negativo: boolean;
}

/** Fluxo de caixa por dia, semana (segunda) ou mês, a partir do saldo de hoje. Previsto vencido entra hoje. */
export function projetarCaixa(p: {
  saldoInicial: Num;
  hoje: string;
  ate: string;
  agrupamento: 'dia' | 'semana' | 'mes';
  lancamentos: LancamentoCaixa[];
}): PontoCaixa[] {
  const inicioDe = (d: string) => {
    if (p.agrupamento === 'dia') return d;
    if (p.agrupamento === 'mes') return `${d.slice(0, 7)}-01`;
    const dow = new Date(paraData(d)).getUTCDay();
    return somarDias(d, -((dow + 6) % 7));
  };
  const proximo = (d: string) => {
    if (p.agrupamento === 'dia') return somarDias(d, 1);
    if (p.agrupamento === 'semana') return somarDias(d, 7);
    const [a, m] = d.split('-').map(Number);
    return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  };
  const buckets = new Map<string, { ent: Dec; sai: Dec; entP: Dec; saiP: Dec }>();
  for (let d = inicioDe(p.hoje); d <= p.ate; d = proximo(d)) buckets.set(d, { ent: ZERO, sai: ZERO, entP: ZERO, saiP: ZERO });
  for (const l of p.lancamentos) {
    if (l.realizado) continue;
    const data = l.data < p.hoje ? p.hoje : l.data;
    if (data > p.ate) continue;
    const b = buckets.get(inicioDe(data));
    if (!b) continue;
    const v = dec(l.valor);
    if (v.gte(0)) {
      b.ent = b.ent.plus(v);
      b.entP = b.entP.plus(v);
    } else {
      b.sai = b.sai.plus(v.abs());
      b.saiP = b.saiP.plus(v.abs());
    }
  }
  let saldo = dec(p.saldoInicial);
  return [...buckets.entries()].map(([inicio, b]) => {
    saldo = saldo.plus(b.ent).minus(b.sai);
    return {
      inicio,
      entradas: b.ent.toFixed(2),
      saidas: b.sai.toFixed(2),
      saldoFinal: saldo.toFixed(2),
      entradasPrevistas: b.entP.toFixed(2),
      saidasPrevistas: b.saiP.toFixed(2),
      negativo: saldo.lt(0)
    };
  });
}

export interface EntradaDRE {
  receitaServicos: Num;
  receitaPecas: Num;
  material: Num;
  terceiros: Num;
  comissoes: Num;
  impostos: Num;
  custoFixo: Num;
  /** Custo da não-qualidade (retrabalho e garantia), mostrado à parte dentro dos variáveis. */
  naoQualidade?: Num;
}

export interface ResultadoDRE {
  receitaBruta: string;
  custosVariaveis: string;
  margemContribuicao: string;
  margemContribuicaoPct: string;
  custoFixo: string;
  resultado: string;
  resultadoPct: string;
  pontoEquilibrio: string | null;
  linhas: { chave: string; rotulo: string; valor: string; pct: string; nivel: number }[];
}

/** DRE gerencial: receita − variáveis = margem de contribuição; − custo fixo = resultado. */
export function calcularDRE(e: EntradaDRE): ResultadoDRE {
  const rs = dec(e.receitaServicos);
  const rp = dec(e.receitaPecas);
  const receita = rs.plus(rp);
  const nq = dec(e.naoQualidade);
  const variaveis = soma([dec(e.material), dec(e.terceiros), dec(e.comissoes), dec(e.impostos), nq]);
  const mc = receita.minus(variaveis);
  const cf = dec(e.custoFixo);
  const resultado = mc.minus(cf);
  const pct = (v: Dec) => (receita.isZero() ? ZERO : v.div(receita));
  const mcPct = pct(mc);
  const linha = (chave: string, rotulo: string, v: Dec, nivel = 1) => ({ chave, rotulo, valor: v.toFixed(2), pct: txt(pct(v)), nivel });
  return {
    receitaBruta: receita.toFixed(2),
    custosVariaveis: variaveis.toFixed(2),
    margemContribuicao: mc.toFixed(2),
    margemContribuicaoPct: txt(mcPct),
    custoFixo: cf.toFixed(2),
    resultado: resultado.toFixed(2),
    resultadoPct: txt(pct(resultado)),
    pontoEquilibrio: mcPct.gt(0) ? cf.div(mcPct).toFixed(2) : null,
    linhas: [
      linha('receita', 'Receita bruta', receita, 0),
      linha('receitaServicos', 'Serviços', rs),
      linha('receitaPecas', 'Peças', rp),
      linha('variaveis', 'Custos variáveis', variaveis, 0),
      linha('impostos', 'Impostos sobre a venda', dec(e.impostos)),
      linha('material', 'Material', dec(e.material)),
      linha('terceiros', 'Terceiros', dec(e.terceiros)),
      linha('comissoes', 'Comissões', dec(e.comissoes)),
      linha('naoQualidade', 'Não-qualidade (retrabalho e garantia)', nq),
      linha('margemContribuicao', 'Margem de contribuição', mc, 0),
      linha('custoFixo', 'Custo fixo', cf, 0),
      linha('resultado', 'Resultado', resultado, 0)
    ]
  };
}

/** Comissão sobre o valor efetivamente recebido. */
export const comissaoSobre = (recebido: Num, percentual: Num): string =>
  dec(recebido).times(fracao(percentual, 'Comissão')).toDecimalPlaces(2).toFixed(2);

/** Diferença do custo fixo realizado contra o usado na Tabela de Custos (fração; positivo = gastou mais). */
export const desvioCustoFixo = (realizado: Num, tabela: Num): string => {
  const t = dec(tabela);
  return txt(t.isZero() ? ZERO : dec(realizado).minus(t).div(t));
};

/**
 * Divide um pagamento entre principal, multa e juros proporcionalmente: cada real de principal quitado
 * carrega a sua multa e os seus juros. Assim, pagar em partes custa o mesmo que pagar de uma vez.
 */
export function distribuirBaixa(p: {
  valorRecebido: Num;
  saldo: Num;
  vencimento: string;
  dataPagamento: string;
  desconto?: Num;
  multa?: Num;
  jurosMes?: Num;
}): { principal: string; multa: string; juros: string; desconto: string; quita: boolean; devidoTotal: string } {
  const saldo = dec(p.saldo);
  const recebido = dec(p.valorRecebido);
  const desconto = dec(p.desconto);
  if (recebido.lte(0)) throw new RangeError('O valor recebido precisa ser maior que zero.');
  const dias = Math.max(0, diasEntre(p.vencimento, p.dataPagamento));
  const m = dias > 0 ? fracao(p.multa ?? '0.02', 'Multa') : ZERO;
  const j = dias > 0 ? fracao(p.jurosMes ?? '0.01', 'Juros').div(30).times(dias) : ZERO;
  const fator = dec(1).plus(m).plus(j);
  const multaTotal = saldo.times(m).toDecimalPlaces(2);
  const jurosTotal = saldo.times(j).toDecimalPlaces(2);
  const devidoTotal = saldo.plus(multaTotal).plus(jurosTotal).minus(desconto);
  if (recebido.gt(devidoTotal)) throw new RangeError(`O valor passa do devido (${devidoTotal.toFixed(2)}).`);
  if (recebido.eq(devidoTotal)) {
    return { principal: saldo.toFixed(2), multa: multaTotal.toFixed(2), juros: jurosTotal.toFixed(2), desconto: desconto.toFixed(2), quita: true, devidoTotal: devidoTotal.toFixed(2) };
  }
  const principal = recebido.plus(desconto).div(fator).toDecimalPlaces(2);
  const multa = principal.times(m).toDecimalPlaces(2);
  const juros = recebido.plus(desconto).minus(principal).minus(multa);
  return { principal: principal.toFixed(2), multa: multa.toFixed(2), juros: juros.toFixed(2), desconto: desconto.toFixed(2), quita: false, devidoTotal: devidoTotal.toFixed(2) };
}
