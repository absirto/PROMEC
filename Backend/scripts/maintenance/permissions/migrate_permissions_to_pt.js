
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mapping = {
  'dashboard:view': 'dashboard:visualizar',
  'people:view': 'pessoas:visualizar',
  'people:manage': 'pessoas:gerenciar',
  'employees:view': 'funcionarios:visualizar',
  'employees:manage': 'funcionarios:gerenciar',
  'materials:view': 'materiais:visualizar',
  'materials:manage': 'materiais:gerenciar',
  'service_orders:view': 'os:visualizar',
  'service_orders:manage': 'os:gerenciar',
  'budgets:view': 'orcamentos:visualizar',
  'budgets:manage': 'orcamentos:gerenciar',
  'quality:view': 'qualidade:visualizar',
  'quality:manage': 'qualidade:gerenciar',
  'stock:view': 'estoque:visualizar',
  'stock:manage': 'estoque:gerenciar',
  'finance:view': 'financeiro:visualizar',
  'finance:manage': 'financeiro:gerenciar',
  'reports:view': 'relatorios:visualizar',
  'settings:manage': 'configuracoes:gerenciar',
  'users:manage': 'usuarios:gerenciar'
};

async function migratePermissions() {
  console.log('Iniciando migração de permissões para PT-BR...');

  // 1. Garantir que as novas permissões existam (já deve ter sido feito pelo seed, mas por segurança...)
  const allPerms = await prisma.permission.findMany();
  
  // 2. Para cada grupo, ver as permissões antigas e adicionar as novas correspondentes
  const groups = await prisma.group.findMany({
    include: { permissions: { include: { permission: true } } }
  });

  for (const group of groups) {
    console.log(`Migrando grupo: ${group.name}`);
    for (const gp of group.permissions) {
      const oldName = gp.permission.name;
      const newName = mapping[oldName];
      
      if (newName) {
        const newPerm = await prisma.permission.findUnique({ where: { name: newName } });
        if (newPerm) {
          await prisma.groupPermission.upsert({
            where: {
              groupId_permissionId: {
                groupId: group.id,
                permissionId: newPerm.id
              }
            },
            update: {},
            create: {
              groupId: group.id,
              permissionId: newPerm.id
            }
          });
        }
      }
    }
  }

  // 3. Garantir que o grupo Administrador tenha TODAS as novas permissões
  const adminGroup = await prisma.group.findFirst({ where: { name: 'Administrador' } });
  if (adminGroup) {
    const newPermissions = await prisma.permission.findMany({
      where: { name: { contains: ':' } } // Filtra as novas que seguem o padrão chave:valor
    });
    for (const p of newPermissions) {
       await prisma.groupPermission.upsert({
          where: { groupId_permissionId: { groupId: adminGroup.id, permissionId: p.id } },
          update: {},
          create: { groupId: adminGroup.id, permissionId: p.id }
       });
    }
  }

  // 4. Remover permissões antigas (opcional, mas limpa o banco)
  const oldKeys = Object.keys(mapping);
  await prisma.groupPermission.deleteMany({
    where: { permission: { name: { in: oldKeys } } }
  });
  await prisma.permission.deleteMany({
    where: { name: { in: oldKeys } }
  });

  console.log('Migração concluída com sucesso!');
}

migratePermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
