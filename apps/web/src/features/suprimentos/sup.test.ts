import { describe, expect, it } from 'vitest';
import { barraMedicao, flagsDivergencia, rankingCotacao, textoConversao } from './sup';

describe('suprimentos e qualidade', () => {
  it('barra de medição posiciona o marcador na faixa', () => {
    const dentro = barraMedicao({ nominal: '20', tolInferior: '0', tolSuperior: '0.021', medido: '20.010' });
    expect(dentro.conforme).toBe(true);
    expect(dentro.marcador).toBeGreaterThan(dentro.faixaInicio);
    expect(dentro.marcador).toBeLessThan(dentro.faixaFim);
    const fora = barraMedicao({ nominal: '20', tolInferior: '0', tolSuperior: '0.021', medido: '20.030' });
    expect(fora.conforme).toBe(false);
    expect(fora.marcador).toBeGreaterThan(fora.faixaFim);
    expect(barraMedicao({ nominal: '20', tolInferior: '0', tolSuperior: '0.021', medido: '19' }).marcador).toBe(0);
    expect(barraMedicao({ nominal: '20', tolInferior: '0', tolSuperior: '0.021', medido: '20' }).marcador).toBeCloseTo(16.67, 1);
  });

  it('sinaliza divergências de recebimento', () => {
    expect(flagsDivergencia({ pendente: '10', quantidade: '10', precoPedido: '42', preco: '42.80' })).toMatchObject({ quantidade: false, preco: false });
    expect(flagsDivergencia({ pendente: '10', quantidade: '8', precoPedido: '42', preco: '43' })).toMatchObject({ quantidade: true, preco: true });
    expect(flagsDivergencia({ pendente: '10', quantidade: '10', precoPedido: '42', preco: '41' }).preco).toBe(true);
  });

  it('ranking de cotação com destaques', () => {
    const r = rankingCotacao([
      { fornecedorId: 'a', nome: 'Metais Joinville', precoUnitario: '42', quantidade: '50', frete: '0', prazoDias: 5, avaliacao: '4.6' },
      { fornecedorId: 'b', nome: 'Aços Itajaí', precoUnitario: '40', quantidade: '50', frete: '150', prazoDias: 9, avaliacao: '3.8' },
      { fornecedorId: 'c', nome: 'Barato e Lento', precoUnitario: '38', quantidade: '50', frete: '0', prazoDias: 30, avaliacao: '2' }
    ]);
    expect(r.map((x) => x.posicao)).toEqual([1, 2, 3]);
    expect(r[0]!.nome).toBe('Metais Joinville');
    expect(r.find((x) => x.melhorPreco)!.nome).toBe('Barato e Lento');
    expect(r[0]!.rotulo).toMatch(/^1º · nota \d+% · melhor prazo$/);
  });

  it('texto de conversão de unidade', () => {
    expect(textoConversao('barra', 'mm', '6000')).toBe('1 barra = 6.000 mm');
    expect(textoConversao('cx', 'un', '12', 2)).toBe('2 cx = 24 un');
    expect(textoConversao('kg', 'kg', '1')).toBe('Compra e consumo na mesma unidade (kg).');
    expect(textoConversao('rolo', 'm', '')).toBeNull();
    expect(textoConversao('kg', 'g', '1000')).toBe('1 kg = 1.000 g');
  });
});
