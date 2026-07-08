import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { seedGroupsAndPermissions } from '../src/database/seeds/seed-groups';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed (servidor vazio: tabelas já aplicadas via migrate deploy)...');

  const adminGroup = await seedGroupsAndPermissions(prisma);

  await prisma.jobRole.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Administrador' },
  });
  await prisma.jobRole.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: 'Usinador' },
  });

  await prisma.workArea.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Fábrica' },
  });
  await prisma.workArea.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: 'Escritório' },
  });

  const email = process.env.ADMIN_DEFAULT_EMAIL || 'admin@admin.com';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || '123456';
  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {}, // Evita sobrescrever senha e dados de cadastro no banco em produção
    create: {
      email,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'System',
      role: 'admin',
      groupId: adminGroup.id,
    },
  });

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'ProMEC Industrial',
      cnpj: '00.000.000/0001-00',
      systemTheme: 'dark',
    },
  });

  console.log('Seed concluído.');
  console.log('Login inicial: guidortas25@gmail.com — altere a palavra-passe após o primeiro acesso.');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
