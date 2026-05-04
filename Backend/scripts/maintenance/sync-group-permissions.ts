import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISSION_NAMES = [
  'admin',
  'cadastro',
  'operacao',
  'auxiliares',
  'dashboard:visualizar',
  'pessoas:visualizar',
  'pessoas:gerenciar',
  'funcionarios:visualizar',
  'funcionarios:gerenciar',
  'materiais:visualizar',
  'materiais:gerenciar',
  'os:visualizar',
  'os:gerenciar',
  'qualidade:visualizar',
  'qualidade:gerenciar',
  'estoque:visualizar',
  'estoque:gerenciar',
  'financeiro:visualizar',
  'financeiro:gerenciar',
  'relatorios:visualizar',
  'configuracoes:gerenciar',
  'usuarios:gerenciar',
];

const GROUP_TARGETS: Array<{ name: string; description: string; permissions: string[] }> = [
  {
    name: 'Admin',
    description: 'Grupo com acesso total',
    permissions: ALL_PERMISSION_NAMES,
  },
  {
    name: 'Usuário',
    description: 'Grupo padrão para usuários',
    permissions: ['operacao', 'os:visualizar', 'qualidade:visualizar', 'dashboard:visualizar'],
  },
];

async function ensurePermissions() {
  for (const name of ALL_PERMISSION_NAMES) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: name },
    });
  }
}

async function syncGroupPermissions() {
  await ensurePermissions();

  for (const target of GROUP_TARGETS) {
    const group = await prisma.group.upsert({
      where: { name: target.name },
      update: { description: target.description },
      create: { name: target.name, description: target.description },
    });

    const permissionRows = await prisma.permission.findMany({
      where: { name: { in: target.permissions } },
      select: { id: true, name: true },
    });

    const permissionIds = permissionRows.map((p) => p.id);
    const missing = target.permissions.filter((p) => !permissionRows.some((row) => row.name === p));
    if (missing.length > 0) {
      console.warn(`[WARN] Permissões não encontradas para grupo ${target.name}: ${missing.join(', ')}`);
    }

    await prisma.groupPermission.deleteMany({
      where: {
        groupId: group.id,
        permissionId: { notIn: permissionIds.length > 0 ? permissionIds : [0] },
      },
    });

    for (const permissionId of permissionIds) {
      await prisma.groupPermission.upsert({
        where: {
          groupId_permissionId: {
            groupId: group.id,
            permissionId,
          },
        },
        update: {},
        create: {
          groupId: group.id,
          permissionId,
        },
      });
    }

    console.log(`[OK] Grupo ${target.name} sincronizado com ${permissionIds.length} permissões.`);
  }
}

syncGroupPermissions()
  .catch((err) => {
    console.error('Erro ao sincronizar permissões de grupos:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
