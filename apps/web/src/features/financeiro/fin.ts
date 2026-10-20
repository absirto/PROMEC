import { distribuirBaixa, encargosDeAtraso, gerarParcelas, interpretarCondicao, type Parcela } from '@promec/motor';
import { brl, data, pct, toNum } from '../../lib/format';
import type { LinhaDRE } from '../../lib/types';

/** Parcelas ao vivo a partir da condição digitada ("30/60/90", "entrada + 30"). */
export function previaParcelas(condicao: string, valor: string | number, dataBase: string): { parcelas: Parcela[]; texto: string; erro: string | null } {
  if (!condicao.trim()) return { parcelas: [], texto: '', erro: null };
  try {
    const prazos = interpretarCondicao(condicao);
    if (!(toNum(valor) > 0)) return { parcelas: [], texto: `${prazos.length === 1 ? '1 parcela' : `${prazos.length} parcelas`}: ${prazos.map((d) => (d === 0 ? 'à vista' : `${d} dias`)).join(', ')}`, erro: null };
    const parcelas = gerarParcelas({ valor: String(toNum(valor)), dataBase, prazos });
    const lista = parcelas.map((p) => `${brl(p.valor)} em ${data(p.vencimento)}`).join(' · ');
    return { parcelas, texto: `${parcelas.length === 1 ? '1 parcela' : `${parcelas.length} parcelas`}: ${lista}`, erro: null };
  } catch (e) {
    return { parcelas: [], texto: '', erro: e instanceof Error ? e.message : 'Condição não entendida.' };
  }
}

/** Encargos para pagar numa data: multa e juros pró-rata (parâmetros do tenant). */
export function encargosNaData(p: { saldo: string; vencimento: string; dataPagamento: string; multa?: string; jurosMes?: string }) {
  if (!p.dataPagamento || !p.vencimento) return { diasAtraso: 0, multa: '0.00', juros: '0.00', total: toNum(p.saldo).toFixed(2) };
  return encargosDeAtraso({ valor: String(toNum(p.saldo)), vencimento: p.vencimento.slice(0, 10), dataPagamento: p.dataPagamento, multa: p.multa, jurosMes: p.jurosMes });
}

/** Escala vertical do fluxo de caixa: inclui o zero, com folga, para barras e saldo negativo. */
export function escalaFluxo(valores: number[], altura: number, folga = 0.08) {
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const span = max - min || 1;
  const topo = max + span * folga;
  const base = min - (min < 0 ? span * folga : 0);
  const y = (v: number) => ((topo - v) / (topo - base)) * altura;
  return { min: base, max: topo, y, zero: y(0) };
}

/** Linha da DRE para exibir: custos com sinal de menos, % da receita, destaque nos totais. */
export function formatarLinhaDRE(l: LinhaDRE) {
  const custo = ['variaveis', 'impostos', 'material', 'terceiros', 'comissoes', 'naoQualidade', 'custoFixo'].includes(l.chave);
  const v = toNum(l.valor);
  const valor = custo && v !== 0 ? `− ${brl(Math.abs(v))}` : brl(v);
  return { rotulo: l.rotulo, valor, pct: pct(Math.abs(toNum(l.pct)) * (custo ? 1 : Math.sign(toNum(l.pct)) || 1)), total: l.nivel === 0, negativo: !custo && v < 0, custo };
}

/** Divide o valor recebido em principal, multa e juros na proporção do devido (sem cobrar encargo duas vezes). */
export function previaBaixa(p: { saldo: string; vencimento: string; dataPagamento: string; valor?: string | number | null; desconto?: string; multa?: string; jurosMes?: string }) {
  const base = { saldo: String(toNum(p.saldo)), vencimento: p.vencimento.slice(0, 10), dataPagamento: p.dataPagamento, desconto: String(toNum(p.desconto)), multa: p.multa, jurosMes: p.jurosMes };
  const devidoTotal = distribuirBaixa({ ...base, valorRecebido: '0.01' }).devidoTotal;
  const valor = p.valor === undefined || p.valor === null || p.valor === '' ? devidoTotal : String(toNum(p.valor));
  try {
    const d = distribuirBaixa({ ...base, valorRecebido: valor });
    const resta = Math.max(0, toNum(p.saldo) - toNum(d.principal));
    const texto = `Recebe ${brl(valor)} = principal ${brl(d.principal)} + multa ${brl(d.multa)} + juros ${brl(d.juros)}${toNum(d.desconto) > 0 ? ` − desconto ${brl(d.desconto)}` : ''}`;
    return { ...d, devidoTotal, valor, resta, texto, situacao: d.quita ? 'Quita o título.' : `Fica um saldo de ${brl(resta)}.`, erro: null as string | null };
  } catch (e) {
    const erro = toNum(valor) > toNum(devidoTotal) ? `Passa do devido: o máximo hoje é ${brl(devidoTotal)}. Se o cliente pagou a mais, lance a diferença à parte.` : e instanceof Error ? e.message : 'Valor inválido.';
    return { principal: '0', multa: '0', juros: '0', desconto: '0', quita: false, devidoTotal, valor, resta: toNum(p.saldo), texto: '', situacao: '', erro };
  }
}
