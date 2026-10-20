import { assinarLink, lerLink } from '../portal/token';
import { mascarar } from './mascara.interceptor';
import { papelDoPerfil, PERFIS_PADRAO, temPermissao, TODAS } from './permissoes';

describe('acesso', () => {
  it('gerenciar inclui visualizar e perfis padrão derivam o papel antigo', () => {
    expect(temPermissao(['os.gerenciar'], 'os.visualizar')).toBe(true);
    expect(temPermissao(['os.visualizar'], 'os.gerenciar')).toBe(false);
    const gerente = PERFIS_PADRAO.find((p) => p.nome === 'Gerente')!;
    expect(gerente.permissoes).not.toContain('usuarios.gerenciar');
    expect(TODAS).toContain('custo.ver_custo_hora');
    expect(papelDoPerfil({ papelLegado: null, permissoes: ['financeiro.gerenciar'] })).toBe('OPERADOR');
  });

  it('máscara zera custo-hora e a explicação do centro', () => {
    const { valor, mascarou } = mascarar({ centros: [{ nome: 'Torno', cheioHora: '117.77', explicacao: { valor: '1' } }], operacoes: [{ custoHora: '117.77', descricao: 'x' }] });
    expect(mascarou).toBe(true);
    expect(valor).toEqual({ centros: [{ nome: 'Torno', cheioHora: null, explicacao: null }], operacoes: [{ custoHora: null, descricao: 'x' }] });
  });

  it('link do portal é assinado e vence', () => {
    const t = assinarLink({ t: 'a', k: 'OS', id: 'x', v: 1, exp: Math.floor(Date.now() / 1000) + 60 });
    expect(lerLink(t)).toMatchObject({ id: 'x', v: 1 });
    expect(lerLink(`${t.split('.')[0]}.assinaturaFalsa`)).toBeNull();
    expect(lerLink(assinarLink({ t: 'a', k: 'OS', id: 'x', v: 1, exp: 1 }))).toBeNull();
  });
});
