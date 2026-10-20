import { calcularOrcamento, type LinhaOrcamento } from '@promec/motor';
import { exigeJustificativa, horasEntre, mesclarObjeto, roteiroDoOrcamento } from './custo';

describe('OS a partir do orçamento', () => {
  const linhas: LinhaOrcamento[] = [
    { tipo: 'material', descricao: 'Latão', quantidade: 1, custoUnitario: '8' },
    { tipo: 'operacao', descricao: 'Torneamento', centroId: 'torno', custoHora: '100', cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' },
    { tipo: 'maoDeObra', descricao: 'Montagem', centroId: 'banc', custoHora: '50', tempoPadraoHoras: '2', fatorDificuldade: '1.5' } as LinhaOrcamento,
    { tipo: 'frete', descricao: 'Entrega', valor: '60' }
  ];
  const resultado = calcularOrcamento({ lote: 10, linhas, impostos: 0.14, comissao: 0, margemAlvo: 0.2 });

  it('operações viram roteiro e o resto vira custo orçado', () => {
    const { operacoes, custos } = roteiroDoOrcamento(linhas, resultado);
    expect(operacoes).toEqual([
      { sequencia: 10, descricao: 'Torneamento', centroId: 'torno', custoHora: '100', setupOrcadoHoras: '3', cicloOrcadoHorasPorPeca: '0.1' },
      { sequencia: 20, descricao: 'Montagem', centroId: 'banc', custoHora: '50', setupOrcadoHoras: '3', cicloOrcadoHorasPorPeca: '0' }
    ]);
    expect(custos).toEqual([
      { descricao: 'Latão', categoria: 'material', orcado: '80', itemId: null },
      { descricao: 'Entrega', categoria: 'frete', orcado: '60', itemId: null }
    ]);
  });

  it('justificativa acima de 20% do orçado e horas decimais', () => {
    expect(exigeJustificativa('100', '120')).toBe(false);
    expect(exigeJustificativa('100', '120.01')).toBe(true);
    expect(exigeJustificativa('0', '1')).toBe(true);
    expect(exigeJustificativa('100', null)).toBe(false);
    expect(horasEntre(new Date(0), new Date(1_368_000))).toBe('0.38');
    expect(mesclarObjeto({ desenho: 'A' }, { revisao: 'C', extra: 1 })).toMatchObject({ desenho: 'A', revisao: 'C', placa: null });
  });
});
