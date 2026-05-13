/**
 * Expande permissões baseadas em "tags" ou hierarquia.
 * Ex: 'os:gerenciar' concede automaticamente 'os:visualizar'.
 */
export function expandPermissions(permissionNames: string[]): string[] {
  const expanded = new Set<string>();

  permissionNames.forEach(p => {
    expanded.add(p);
    
    // Atalhos de Perfil
    if (p === 'admin') {
      [
        'usuarios', 'configuracoes', 'dashboard', 'relatorios', 
        'financeiro', 'estoque', 'materiais', 'pessoas', 
        'funcionarios', 'os', 'qualidade', 'auxiliares', 'orcamentos'
      ].forEach(mod => {
        expanded.add(`${mod}:visualizar`);
        expanded.add(`${mod}:gerenciar`);
      });
    }
    
    if (p === 'cadastro') {
      ['pessoas', 'funcionarios'].forEach(mod => {
        expanded.add(`${mod}:visualizar`);
        expanded.add(`${mod}:gerenciar`);
      });
    }
    
    if (p === 'operacao') {
      ['os', 'qualidade', 'dashboard', 'orcamentos', 'materiais', 'estoque'].forEach(mod => {
        expanded.add(`${mod}:visualizar`);
        expanded.add(`${mod}:gerenciar`);
      });
    }

    // Regra de Ouro: Gerenciar implica Visualizar
    if (p.endsWith(':gerenciar')) {
      expanded.add(p.replace(':gerenciar', ':visualizar'));
    }
  });

  return Array.from(expanded);
}
