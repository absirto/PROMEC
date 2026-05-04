const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (JS version)...');

  // 1. Create Default Job Roles
  await prisma.jobRole.upsert({ where: { id: 1 }, update: {}, create: { name: 'Administrador' } });
  await prisma.jobRole.upsert({ where: { id: 2 }, update: {}, create: { name: 'Usinador' } });

  // 2. Create Default Work Areas
  await prisma.workArea.upsert({ where: { id: 1 }, update: {}, create: { name: 'Fábrica' } });
  await prisma.workArea.upsert({ where: { id: 2 }, update: {}, create: { name: 'Escritório' } });

  // 3. Create PRIMARY USER (Guilherme Dortas)
  const hashedPassword = await bcrypt.hash('180525@', 10);
  
  await prisma.user.upsert({
    where: { email: 'guidortas25@gmail.com' },
    update: {},
    create: {
      email: 'guidortas25@gmail.com',
      password: hashedPassword,
      firstName: 'Guilherme',
      lastName: 'Dortas',
      role: 'admin',
    },
  });

  // 4. Create Default Settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: 'ProMEC Industrial',
      cnpj: '00.000.000/0001-00',
      systemTheme: 'dark',
    },
  });

  console.log('✅ Seed finished successfully!');
  console.log('👤 Primary User: guidortas25@gmail.com / 180525@');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
