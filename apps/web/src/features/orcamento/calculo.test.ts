import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { reais } from '@promec/motor';
import { calcularAoVivo, useOrcamentoAoVivo, type MapaCentros, type PrecoForm } from './calculo';

const centros: MapaCentros = new Map([['torno', { id: 'torno', nome: 'Torno CNC de entrada', cheioHora: '117.7777777778', rateioHora: '44.4444444444' }]]);

const bucha: PrecoForm = {
  lote: 10,
  impostos: '0.14',
  comissao: '0',
  margemAlvo: '0.2',
  margemMinima: '0.15',
  desconto: '0.05',
  metodo: 'divisor',
  linhas: [
    { tipo: 'material', descricao: 'Barra de latão C360 Ø25', base: 'peca', quantidade: '1', custoUnitario: '8.00' },
    { tipo: 'operacao', descricao: 'Tornear completo + furo H7', centroId: 'torno', cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' }
  ]
};

describe('orçamento ao vivo', () => {
  it('fecha a bucha H7 em R$ 793,27 com margem de 16,5% (atenção)', () => {
    const { result } = renderHook(() => useOrcamentoAoVivo(bucha, centros));
    const r = result.current.resultado!;
    expect(result.current.erro).toBeNull();
    expect(reais(r.custoLote)).toBe('551.11');
    expect(reais(r.precoLote)).toBe('835.02');
    expect(reais(r.precoFinalLote)).toBe('793.27');
    expect(Number(r.margemEfetiva).toFixed(3)).toBe('0.165');
    expect(r.situacaoMargem).toBe('atencao');
    expect(r.curvaLote.map((p) => reais(p.precoUnitario))).toEqual(['565.32', '83.50', '40.67', '35.32']);
  });

  it('usa o custo-hora da tabela e separa o rateio na composição', () => {
    const r = calcularAoVivo(bucha, centros).resultado!;
    const rateio = r.composicao.find((c) => c.categoria === 'rateio');
    expect(reais(rateio!.valor)).toBe('177.78');
  });

  it('campos vazios contam como zero e lote inválido vira mensagem', () => {
    expect(calcularAoVivo({ ...bucha, linhas: [{ tipo: 'ferramental', descricao: '', custo: '' }] }, centros).resultado?.custoLote).toBe('0');
    expect(calcularAoVivo({ ...bucha, lote: 0 }, centros).erro).toMatch(/pelo menos 1/);
    expect(calcularAoVivo({ ...bucha, impostos: '0.5', margemAlvo: '0.5' }, centros).erro).toMatch(/100%/);
  });
});
