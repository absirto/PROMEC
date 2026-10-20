import { avaliarMedicao, compararCotacoes, variacaoDePreco, type RespostaCotacao } from '@promec/motor';
import { num, pct, toNum } from '../../lib/format';
import type { TipoItem } from '../../lib/types';

export const TIPO_ITEM: Record<TipoItem, string> = {
  MATERIA_PRIMA: 'Matéria-prima', PECA_REPOSICAO: 'Peça de reposição', INSUMO: 'Insumo', FERRAMENTA_GERAL: 'Ferramenta geral',
  FERRAMENTA_ESPECIFICA: 'Ferramenta específica', PRODUTO_ACABADO: 'Produto acabado', SERVICO_EXTERNO: 'Serviço externo'
};

const casas = (v: number) => (Number.isInteger(v) ? 0 : Math.abs(v) < 1 ? 3 : 2);
const fmt = (v: number) => num(v, casas(v)).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');

/** "1 barra = 6.000 mm" a partir da unidade de compra, consumo e fator. */
export function textoConversao(unCompra: string, unConsumo: string, fator: string | number, quantidade = 1): string | null {
  if (!unCompra || !unConsumo) return null;
  if (unCompra.trim().toLowerCase() === unConsumo.trim().toLowerCase()) return `Compra e consumo na mesma unidade (${unConsumo}).`;
  const f = toNum(fator);
  if (!(f > 0)) return null;
  return `${fmt(quantidade)} ${unCompra} = ${fmt(quantidade * f)} ${unConsumo}`;
}

export interface FlagsDivergencia { quantidade: boolean; preco: boolean; variacao: number }
/** Recebimento: quantidade diferente do pendente, ou preço mais de 2% fora do pedido. */
export function flagsDivergencia(p: { pendente: string | number; quantidade: string | number; precoPedido: string | number; preco: string | number }): FlagsDivergencia {
  const variacao = toNum(variacaoDePreco(String(toNum(p.preco)), String(toNum(p.precoPedido))));
  return { quantidade: Math.abs(toNum(p.quantidade) - toNum(p.pendente)) > 1e-9, preco: Math.abs(variacao) > 0.02, variacao };
}

/** Posição do marcador na barra de medição (0–100%, com folga de 25% de cada lado da faixa). */
export function barraMedicao(m: { nominal: string; tolInferior: string; tolSuperior: string; medido: string }) {
  const r = avaliarMedicao({ nominal: m.nominal || '0', tolInferior: m.tolInferior || '0', tolSuperior: m.tolSuperior || '0', medido: m.medido });
  const pos = toNum(r.posicao);
  return { ...r, marcador: Math.max(0, Math.min(100, ((pos + 0.25) / 1.5) * 100)), faixaInicio: (0.25 / 1.5) * 100, faixaFim: (1.25 / 1.5) * 100 };
}

export interface LinhaRanking { fornecedorId: string; nome: string; total: string; nota: string; posicao: number; melhorPreco: boolean; melhorPrazo: boolean; prazoDias: number; rotulo: string }
/** Ranking de cotação para exibir: ordenado pela posição, com rótulo de destaque. */
export function rankingCotacao(respostas: (RespostaCotacao & { nome: string })[]): LinhaRanking[] {
  const r = compararCotacoes(respostas);
  return r
    .map((x) => {
      const resp = respostas.find((y) => y.fornecedorId === x.fornecedorId)!;
      const tags = [x.melhorPreco && 'melhor preço', x.melhorPrazo && 'melhor prazo'].filter(Boolean).join(' · ');
      return { ...x, nome: resp.nome, prazoDias: resp.prazoDias, rotulo: `${x.posicao}º · nota ${pct(x.nota, 0)}${tags ? ` · ${tags}` : ''}` };
    })
    .sort((a, b) => a.posicao - b.posicao);
}
