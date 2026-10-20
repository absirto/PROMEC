/** Permissões sensíveis: nunca liberadas por herança de módulo. */
export const SENSIVEIS = ['custo.ver_custo_hora', 'orcamento.editar_margem', 'orcamento.aprovar_desconto', 'custo.publicar_tabela', 'os.cancelar', 'financeiro.estornar', 'compras.aprovar_pedido'] as const;

/**
 * `<modulo>.gerenciar` inclui `<modulo>.visualizar`. Sem lista de permissões (API antiga),
 * cai no papel: ADMIN e GESTOR podem tudo; os demais, tudo menos as sensíveis.
 */
export function temPermissao(permissoes: string[] | undefined | null, chave: string, papel?: string): boolean {
  if (!permissoes) {
    if (papel === 'ADMIN' || papel === 'GESTOR') return true;
    return !(SENSIVEIS as readonly string[]).includes(chave) && !chave.startsWith('usuarios.');
  }
  if (permissoes.includes(chave)) return true;
  const [modulo, acao] = chave.split('.');
  return acao === 'visualizar' && permissoes.includes(`${modulo}.gerenciar`);
}

export const MASCARA = '••••';
export const DICA_MASCARA = 'Você não tem permissão para ver o custo-hora';

/** Valor de custo para exibir: mascarado quando a API escondeu (null ou `mascarado`). */
export function exibirCusto(valor: string | number | null | undefined, formatar: (v: string | number) => string, mascarado?: boolean): { texto: string; mascarado: boolean } {
  if (mascarado || valor === null || valor === undefined) return { texto: MASCARA, mascarado: true };
  return { texto: formatar(valor), mascarado: false };
}
