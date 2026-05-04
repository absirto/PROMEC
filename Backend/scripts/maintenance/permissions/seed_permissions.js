
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const permissions = [
  { name: 'dashboard:visualizar', description: 'Visualizar Dashboard' },
  { name: 'pessoas:visualizar', description: 'Visualizar Pessoas/Clientes' },
  { name: 'pessoas:gerenciar', description: 'Criar/Editar/Excluir Pessoas/Clientes' },
  { name: 'funcionarios:visualizar', description: 'Visualizar Funcionários' },
  { name: 'funcionarios:gerenciar', description: 'Criar/Editar/Excluir Funcionários' },
  { name: 'materiais:visualizar', description: 'Visualizar Materiais' },
  { name: 'materiais:gerenciar', description: 'Criar/Editar/Excluir Materiais' },
  { name: 'os:visualizar', description: 'Visualizar Ordens de Serviço' },
  { name: 'os:gerenciar', description: 'Criar/Editar/Excluir Ordens de Serviço' },
  { name: 'orcamentos:visualizar', description: 'Visualizar Orçamentos' },
  { name: 'orcamentos:gerenciar', description: 'Criar/Editar/Excluir Orçamentos' },
  { name: 'qualidade:visualizar', description: 'Visualizar Controle de Qualidade' },
  { name: 'qualidade:gerenciar', description: 'Executar Controle de Qualidade' },
  { name: 'estoque:visualizar', description: 'Visualizar Estoque' },
  { name: 'estoque:gerenciar', description: 'Gerenciar Movimentações de Estoque' },
  { name: 'financeiro:visualizar', description: 'Visualizar Financeiro' },
  { name: 'financeiro:gerenciar', description: 'Gerenciar Transações Financeiras' },
  { name: 'relatorios:visualizar', description: 'Visualizar Relatórios' },
  { name: 'configuracoes:gerenciar', description: 'Gerenciar Configurações do Sistema' },
  { name: 'usuarios:gerenciar', description: 'Gerenciar Usuários e Grupos' }
];

async function seed() {
  console.log('Semeando permissões por tela...');
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: { description: p.description },
      create: { name: p.name, description: p.description }
    });
  }
  console.log('Permissões semeadas com sucesso!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
