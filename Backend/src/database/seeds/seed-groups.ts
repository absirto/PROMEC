import type { PrismaClient } from '@prisma/client';

export async function seedGroupsAndPermissions(prisma: PrismaClient) {
  const permissions = [
    // Permissões legadas (compatibilidade)
    { name: 'admin', description: 'Acesso administrativo' },
    { name: 'cadastro', description: 'Cadastros (Pessoas, Funcionários)' },
    { name: 'operacao', description: 'Operação (Ordens de Serviço, Qualidade)' },
    { name: 'auxiliares', description: 'Auxiliares (Catálogos, Funções, Áreas, Materiais)' },

    // Permissões por tela/ação (modelo atual)
    { name: 'dashboard:visualizar', description: 'Visualizar dashboard' },
    { name: 'pessoas:visualizar', description: 'Visualizar pessoas/clientes' },
    { name: 'pessoas:gerenciar', description: 'Criar/editar/excluir pessoas/clientes' },
    { name: 'funcionarios:visualizar', description: 'Visualizar funcionários' },
    { name: 'funcionarios:gerenciar', description: 'Criar/editar/excluir funcionários' },
    { name: 'materiais:visualizar', description: 'Visualizar materiais' },
    { name: 'materiais:gerenciar', description: 'Criar/editar/excluir materiais' },
    { name: 'os:visualizar', description: 'Visualizar ordens de serviço' },
    { name: 'os:gerenciar', description: 'Criar/editar/excluir ordens de serviço' },
    { name: 'qualidade:visualizar', description: 'Visualizar controle de qualidade' },
    { name: 'qualidade:gerenciar', description: 'Executar controle de qualidade' },
    { name: 'estoque:visualizar', description: 'Visualizar estoque' },
    { name: 'estoque:gerenciar', description: 'Gerenciar movimentações de estoque' },
    { name: 'financeiro:visualizar', description: 'Visualizar financeiro' },
    { name: 'financeiro:gerenciar', description: 'Gerenciar financeiro' },
    { name: 'relatorios:visualizar', description: 'Visualizar relatórios' },
    { name: 'configuracoes:gerenciar', description: 'Gerenciar configurações do sistema' },
    { name: 'usuarios:gerenciar', description: 'Gerenciar usuários e grupos' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const adminGroup = await prisma.group.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Grupo com acesso total',
      permissions: {
        create: allPermissions.map((p) => ({ permissionId: p.id })),
      },
    },
    include: { permissions: true },
  });

  const operacaoPerm = await prisma.permission.findUnique({ where: { name: 'operacao' } });
  const opView = await prisma.permission.findUnique({ where: { name: 'os:visualizar' } });
  const qcView = await prisma.permission.findUnique({ where: { name: 'qualidade:visualizar' } });
  const dashboardView = await prisma.permission.findUnique({ where: { name: 'dashboard:visualizar' } });
  await prisma.group.upsert({
    where: { name: 'Usuário' },
    update: {},
    create: {
      name: 'Usuário',
      description: 'Grupo padrão para usuários',
      permissions: {
        create: [operacaoPerm, opView, qcView, dashboardView]
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => ({ permissionId: p.id })),
      },
    },
  });

  return adminGroup;
}
