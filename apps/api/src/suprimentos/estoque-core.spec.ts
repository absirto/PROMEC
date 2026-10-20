import type { LinhaOrcamento } from '@promec/motor';
import { ultimasVersoes } from '../qualidade/qualidade-core';
import { quantidadeDaLinha } from './estoque-core';

describe('suprimentos', () => {
  it('quantidade reservada por linha do orçamento', () => {
    expect(quantidadeDaLinha({ tipo: 'material', descricao: 'Latão', quantidade: '0.19', custoUnitario: 42 }, 10)).toBe('1.9');
    expect(quantidadeDaLinha({ tipo: 'material', descricao: 'Kit', base: 'lote', quantidade: '2', custoUnitario: 1 }, 10)).toBe('2');
    expect(quantidadeDaLinha({ tipo: 'materialCorte', descricao: 'Barra', comprimentoMm: '45', sobraMm: '5', pesoPorMetroKg: '4', precoKg: 42 }, 10)).toBe('2');
    expect(quantidadeDaLinha({ tipo: 'frete', descricao: 'x', valor: 1 } as LinhaOrcamento, 10)).toBeNull();
  });

  it('plano usa a versão mais alta', () => {
    expect(ultimasVersoes([{ planoId: 'a', versao: 2 }, { planoId: 'a', versao: 1 }, { planoId: 'b', versao: 1 }])).toEqual([{ planoId: 'a', versao: 2 }, { planoId: 'b', versao: 1 }]);
  });
});
