import { describe, expect, it } from 'vitest';
import {
  arredondar,
  avaliarFornecedor,
  avaliarMedicao,
  compararCotacoes,
  converterUnidade,
  curvaABC,
  custoMedioAposEntrada,
  reais,
  sugestaoDeCompra,
  variacaoDePreco
} from '../src/index.js';

describe('estoque', () => {
  it('custo médio ponderado a cada entrada', () => {
    // 20 kg a R$ 42,00 + 30 kg a R$ 45,00 → 2.190 ÷ 50 = R$ 43,80
    expect(custoMedioAposEntrada({ saldo: 20, custoMedio: 42, quantidade: 30, custoUnitario: 45 })).toEqual({ saldo: '50', custoMedio: '43.8' });
    expect(custoMedioAposEntrada({ saldo: 0, custoMedio: 42, quantidade: 10, custoUnitario: 44 }).custoMedio).toBe('44');
  });

  it('conversão de unidade e ponto de pedido', () => {
    expect(converterUnidade(2, 6000)).toBe('12000');
    expect(sugestaoDeCompra({ disponivel: 8, minimo: 10, maximo: 50 })).toBe('42');
    expect(sugestaoDeCompra({ disponivel: 12, minimo: 10, maximo: 50 })).toBe('0');
  });

  it('curva ABC por valor consumido', () => {
    const r = curvaABC([
      { id: 'latao', valor: 7000 },
      { id: 'aco', valor: 2000 },
      { id: 'inox', valor: 600 },
      { id: 'parafuso', valor: 400 }
    ]);
    expect(r.map((i) => [i.id, i.classe])).toEqual([
      ['latao', 'A'],
      ['aco', 'A'],
      ['inox', 'B'],
      ['parafuso', 'C']
    ]);
  });

  it('variação de preço de compra', () => {
    expect(arredondar(variacaoDePreco(46.2, 42), 2)).toBe('0.10');
  });
});

describe('compras', () => {
  it('comparativo pondera preço com frete, prazo e avaliação', () => {
    const r = compararCotacoes([
      { fornecedorId: 'barato-lento', precoUnitario: 42, quantidade: 50, frete: 0, prazoDias: 15, avaliacao: 3 },
      { fornecedorId: 'equilibrado', precoUnitario: 43, quantidade: 50, frete: 30, prazoDias: 3, avaliacao: 4.5 },
      { fornecedorId: 'caro', precoUnitario: 50, quantidade: 50, frete: 0, prazoDias: 2, avaliacao: 5 }
    ]);
    const por = Object.fromEntries(r.map((x) => [x.fornecedorId, x]));
    expect(reais(por['equilibrado'].total)).toBe('2180.00');
    expect(por['barato-lento'].melhorPreco).toBe(true);
    expect(por['caro'].melhorPrazo).toBe(true);
    expect(por['equilibrado'].posicao).toBe(1);
  });

  it('avaliação do fornecedor cai com atraso e divergência', () => {
    expect(arredondar(avaliarFornecedor({ notaAtual: 5, entregas: 3, noPrazo: false, divergenciaQuantidade: true, divergenciaPreco: false }), 2)).toBe('4.38');
  });
});

describe('qualidade', () => {
  it('Ø20 H7: faixa 20,000 a 20,021', () => {
    const ok = avaliarMedicao({ nominal: 20, tolInferior: 0, tolSuperior: '0.021', medido: '20.012' });
    expect(ok.conforme).toBe(true);
    expect(arredondar(ok.posicao, 3)).toBe('0.571');
    const fora = avaliarMedicao({ nominal: 20, tolInferior: 0, tolSuperior: '0.021', medido: '20.025' });
    expect(fora.conforme).toBe(false);
    expect(fora.desvio).toBe('0.025');
  });
});
