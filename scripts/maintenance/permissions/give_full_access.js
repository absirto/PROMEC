
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function giveFullAccess() {
  console.log('Dando acesso total...');

  // 1. Garantir que o grupo Admin existe com todas as permissões
  const allPermissions = await prisma.permission.findMany();
  const adminGroup = await prisma.group.upsert({
    where: { name: 'Administrador' },
    update: {},
    create: {
      name: 'Administrador',
      description: 'Acesso total ao sistema'
    }
  });

  // Associar todas as permissões ao grupo
  for (const p of allPermissions) {
    await prisma.groupPermission.upsert({
      where: {
        groupId_permissionId: {
          groupId: adminGroup.id,
          permissionId: p.id
        }
      },
      update: {},
      create: {
        groupId: adminGroup.id,
        permissionId: p.id
      }
    });
  }

  // 2. Encontrar o usuário guilherme ou o primeiro usuário e dar admin
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'guilherme' } },
        { firstName: { contains: 'Guilherme' } },
        { email: 'admin@promec.com' }
      ]
    }
  });

  if (user) {
    console.log(`Dando acesso total para o usuário: ${user.email}`);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'admin',
        groupId: adminGroup.id
      }
    });
    console.log('Sucesso!');
  } else {
    console.log('Usuário não encontrado. Criando usuário admin padrão...');
    const hash = await require('bcryptjs').hash('admin123', 10);
    await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Sistema',
        email: 'admin@promec.com',
        password: hash,
        role: 'admin',
        groupId: adminGroup.id
      }
    });
    console.log('Usuário admin@promec.com criado com senha admin123');
  }
}

giveFullAccess()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
