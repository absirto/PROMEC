import { describe, expect, it } from 'vitest';
import { exibirCusto, MASCARA, temPermissao } from './permissoes';
import { brl } from './format';

describe('permissões', () => {
  it('gerenciar inclui visualizar, sensíveis só explícitas', () => {
    const p = ['orcamentos.gerenciar', 'custos.visualizar'];
    expect(temPermissao(p, 'orcamentos.visualizar')).toBe(true);
    expect(temPermissao(p, 'orcamentos.gerenciar')).toBe(true);
    expect(temPermissao(p, 'custos.gerenciar')).toBe(false);
    expect(temPermissao(p, 'custo.ver_custo_hora')).toBe(false);
    expect(temPermissao([...p, 'custo.ver_custo_hora'], 'custo.ver_custo_hora')).toBe(true);
  });
  it('sem lista cai no papel', () => {
    expect(temPermissao(undefined, 'financeiro.estornar', 'GESTOR')).toBe(true);
    expect(temPermissao(undefined, 'financeiro.estornar', 'ORCAMENTISTA')).toBe(false);
    expect(temPermissao(undefined, 'orcamentos.gerenciar', 'ORCAMENTISTA')).toBe(true);
  });
  it('mascara custo escondido pela API', () => {
    expect(exibirCusto(null, brl)).toEqual({ texto: MASCARA, mascarado: true });
    expect(exibirCusto('117.78', brl, true).texto).toBe('••••');
    expect(exibirCusto('117.78', brl)).toEqual({ texto: 'R$ 117,78', mascarado: false });
  });
});
