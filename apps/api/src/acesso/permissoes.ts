import { Papel, Perfil } from '@prisma/client';
import { Db } from '../tabelas-custos/entrada';

export const MODULOS: [string, string][] = [
  ['painel', 'Painel'],
  ['orcamentos', 'Orçamentos'],
  ['os', 'Ordens de serviço'],
  ['planejamento', 'Planejamento e capacidade'],
  ['agenda', 'Agenda da oficina'],
  ['operador', 'Modo Operador (apontamento)'],
  ['custos', 'Motor de custos'],
  ['cadastros', 'Cadastros'],
  ['estoque', 'Estoque'],
  ['compras', 'Compras'],
  ['qualidade', 'Qualidade'],
  ['financeiro', 'Financeiro'],
  ['crm', 'CRM e portal'],
  ['manutencao', 'Manutenção de ativos'],
  ['rh', 'RH operacional'],
  ['usuarios', 'Usuários e perfis'],
  ['configuracoes', 'Configurações']
];

export const SENSIVEIS: [string, string, string][] = [
  ['custo.ver_custo_hora', 'custos', 'Ver custo-hora dos centros, das operações e da Tabela de Custos'],
  ['orcamento.editar_margem', 'orcamentos', 'Alterar margem alvo e margem mínima do orçamento'],
  ['orcamento.aprovar_desconto', 'orcamentos', 'Liberar orçamento com margem abaixo do mínimo'],
  ['custo.publicar_tabela', 'custos', 'Publicar uma versão da Tabela de Custos'],
  ['os.cancelar', 'os', 'Cancelar ordem de serviço'],
  ['financeiro.estornar', 'financeiro', 'Estornar baixas de títulos'],
  ['compras.aprovar_pedido', 'compras', 'Aprovar pedido de compra acima da alçada'],
  ['rh.ver_salario', 'rh', 'Ver salário, encargos, benefícios e custo dos colaboradores']
];

export const CATALOGO = [
  ...MODULOS.flatMap(([m, nome]) => [
    { chave: `${m}.visualizar`, modulo: m, descricao: `Ver ${nome.toLowerCase()}`, sensivel: false },
    { chave: `${m}.gerenciar`, modulo: m, descricao: `Criar, alterar e executar ações em ${nome.toLowerCase()}`, sensivel: false }
  ]),
  ...SENSIVEIS.map(([chave, modulo, descricao]) => ({ chave, modulo, descricao, sensivel: true }))
];
export const TODAS = CATALOGO.map((p) => p.chave);

const v = (...ms: string[]) => ms.map((m) => `${m}.visualizar`);
const g = (...ms: string[]) => ms.map((m) => `${m}.gerenciar`);

export const PERFIS_PADRAO: { nome: string; papel: Papel | null; permissoes: string[] }[] = [
  { nome: 'Administrador', papel: 'ADMIN', permissoes: TODAS },
  { nome: 'Gerente', papel: 'GESTOR', permissoes: TODAS.filter((p) => p !== 'usuarios.gerenciar') },
  {
    nome: 'Orçamentista',
    papel: 'ORCAMENTISTA',
    permissoes: [...v('painel', 'custos', 'os', 'agenda', 'estoque', 'compras', 'qualidade'), ...g('orcamentos', 'crm', 'cadastros', 'planejamento'), 'custo.ver_custo_hora', 'orcamento.editar_margem']
  },
  { nome: 'Produção/Técnico', papel: 'OPERADOR', permissoes: [...v('painel', 'os', 'planejamento', 'agenda', 'estoque', 'cadastros', 'rh'), ...g('operador', 'qualidade', 'manutencao')] },
  { nome: 'Compras', papel: null, permissoes: [...v('painel', 'cadastros', 'os', 'qualidade', 'planejamento'), ...g('compras', 'estoque')] },
  { nome: 'Financeiro', papel: null, permissoes: [...v('painel', 'cadastros', 'orcamentos', 'os', 'compras', 'crm', 'custos', 'rh'), ...g('financeiro'), 'financeiro.estornar', 'rh.ver_salario'] },
  { nome: 'Recepção', papel: null, permissoes: [...v('painel', 'orcamentos', 'os'), ...g('agenda', 'cadastros', 'crm')] }
];

const PERFIL_DO_PAPEL: Record<Papel, string> = { ADMIN: 'Administrador', GESTOR: 'Gerente', ORCAMENTISTA: 'Orçamentista', OPERADOR: 'Produção/Técnico' };

/** Tem a permissão? Gerenciar inclui visualizar. */
export const temPermissao = (permissoes: readonly string[], chave: string) =>
  permissoes.includes(chave) || (chave.endsWith('.visualizar') && permissoes.includes(chave.replace(/\.visualizar$/, '.gerenciar')));

/** Papel antigo derivado do perfil, para quem ainda lê `papel`. */
export function papelDoPerfil(p: Pick<Perfil, 'papelLegado' | 'permissoes'>): Papel {
  if (p.papelLegado) return p.papelLegado;
  if (p.permissoes.includes('usuarios.gerenciar')) return 'ADMIN';
  if (p.permissoes.includes('orcamento.aprovar_desconto')) return 'GESTOR';
  if (temPermissao(p.permissoes, 'orcamentos.gerenciar')) return 'ORCAMENTISTA';
  return 'OPERADOR';
}

/** Cria os perfis padrão do tenant (idempotente) e liga usuários antigos ao perfil do papel. */
export async function garantirPerfis(db: Db, tenantId: string, atualizar = false) {
  for (const p of PERFIS_PADRAO) {
    await db.perfil.upsert({
      where: { tenantId_nome: { tenantId, nome: p.nome } },
      create: { tenantId, nome: p.nome, padrao: true, papelLegado: p.papel, permissoes: p.permissoes },
      update: atualizar ? { padrao: true, papelLegado: p.papel, permissoes: p.permissoes } : {}
    });
  }
  const admin = await db.perfil.findUnique({ where: { tenantId_nome: { tenantId, nome: 'Administrador' } } });
  if (admin && TODAS.some((p) => !admin.permissoes.includes(p))) {
    await db.perfil.update({ where: { id: admin.id }, data: { permissoes: [...new Set([...admin.permissoes, ...TODAS])] } });
  }
  const perfis = await db.perfil.findMany({ where: { tenantId, padrao: true } });
  const semPerfil = await db.usuario.findMany({ where: { tenantId, perfilId: null } });
  for (const u of semPerfil) {
    await db.usuario.update({ where: { id: u.id }, data: { perfilId: perfis.find((x) => x.nome === PERFIL_DO_PAPEL[u.papel])!.id } });
  }
  return perfis;
}
