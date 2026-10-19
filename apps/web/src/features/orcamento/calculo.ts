import { useMemo } from 'react';
import { calcularOrcamento, type EntradaOrcamento, type LinhaOrcamento, type MetodoPreco, type ResultadoOrcamento, type ResultadoTabela } from '@promec/motor';
import type { LinhaApi } from '../../lib/types';

export interface CustoCentro { id: string; nome: string; cheioHora: string; rateioHora: string }
export type MapaCentros = Map<string, CustoCentro>;

export const mapaCentros = (r?: Pick<ResultadoTabela, 'centros'> | null): MapaCentros =>
  new Map((r?.centros ?? []).map((c) => [c.id, { id: c.id, nome: c.nome, cheioHora: c.cheioHora, rateioHora: c.rateioHora }]));

export interface PrecoForm {
  lote: number | string;
  impostos: string;
  comissao: string;
  margemAlvo: string;
  margemMinima: string;
  desconto: string;
  metodo: MetodoPreco;
  linhas: LinhaApi[];
}

const n = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '0';
  const x = Number(v);
  return Number.isFinite(x) ? String(v) : '0';
};
const opc = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : n(v));

export function paraLinhaMotor(l: LinhaApi, centros: MapaCentros): LinhaOrcamento {
  const descricao = l.descricao || '';
  switch (l.tipo) {
    case 'material':
      return { tipo: 'material', descricao, base: l.base ?? 'peca', quantidade: n(l.quantidade), custoUnitario: n(l.custoUnitario) };
    case 'materialCorte':
      return { tipo: 'materialCorte', descricao, comprimentoMm: n(l.comprimentoMm), sobraMm: n(l.sobraMm), pesoPorMetroKg: n(l.pesoPorMetroKg), precoKg: n(l.precoKg) };
    case 'ferramental':
      return { tipo: 'ferramental', descricao, custo: n(l.custo) };
    case 'operacao': {
      const c = l.centroId ? centros.get(l.centroId) : undefined;
      return {
        tipo: 'operacao',
        descricao,
        centroId: l.centroId,
        custoHora: n(c?.cheioHora ?? l.custoHora),
        rateioHora: n(c?.rateioHora ?? l.rateioHora),
        cicloHorasPorPeca: n(l.cicloHorasPorPeca),
        setupHorasPorLote: n(l.setupHorasPorLote)
      };
    }
    case 'maoDeObra': {
      const c = l.centroId ? centros.get(l.centroId) : undefined;
      return {
        tipo: 'maoDeObra',
        descricao,
        base: l.base ?? 'lote',
        custoHora: n(c?.cheioHora ?? l.custoHora),
        rateioHora: n(c?.rateioHora ?? l.rateioHora),
        tempoPadraoHoras: n(l.tempoPadraoHoras),
        fatorDificuldade: opc(l.fatorDificuldade)
      };
    }
    case 'terceiro':
      return { tipo: 'terceiro', descricao, base: l.base ?? 'lote', custo: n(l.custo), markup: opc(l.markup) };
    case 'frete':
      return opc(l.valor) !== undefined ? { tipo: 'frete', descricao, valor: n(l.valor) } : { tipo: 'frete', descricao, km: n(l.km), valorKm: n(l.valorKm) };
  }
}

export function montarEntrada(f: PrecoForm, centros: MapaCentros): EntradaOrcamento {
  return {
    lote: Math.floor(Number(f.lote)),
    linhas: f.linhas.map((l) => paraLinhaMotor(l, centros)),
    impostos: n(f.impostos),
    comissao: n(f.comissao),
    margemAlvo: n(f.margemAlvo),
    margemMinima: opc(f.margemMinima),
    desconto: n(f.desconto),
    metodo: f.metodo
  };
}

export function calcularAoVivo(f: PrecoForm, centros: MapaCentros): { resultado: ResultadoOrcamento | null; erro: string | null } {
  try {
    if (!(Number(f.lote) >= 1)) return { resultado: null, erro: 'Diga quantas peças são: o lote precisa de pelo menos 1.' };
    return { resultado: calcularOrcamento(montarEntrada(f, centros)), erro: null };
  } catch (e) {
    return { resultado: null, erro: e instanceof Error ? e.message : 'Não deu para calcular com esses números.' };
  }
}

/** Recalcula o orçamento no navegador a cada tecla, com o mesmo motor da API. */
export function useOrcamentoAoVivo(f: PrecoForm | null, centros: MapaCentros) {
  return useMemo(() => (f ? calcularAoVivo(f, centros) : { resultado: null, erro: null }), [f, centros]);
}
