
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedGroupsAndPermissions } from './seed-groups';

const prisma = new PrismaClient();

async function main() {
  const email = 'guidortas25@gmail.com';
  const password = '180525@';
  const role = 'admin';
  const firstName = 'Guilherme';
  const lastName = 'Dortas';

  // Garante grupos e permissões
  const adminGroup = await seedGroupsAndPermissions(prisma);

  const hashedPassword = await bcrypt.hash(password, 10);

  // Vincula usuário admin ao grupo Admin
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role,
      firstName,
      lastName,
      groupId: adminGroup.id,
    },
    create: {
      email,
      password: hashedPassword,
      role,
      firstName,
      lastName,
      groupId: adminGroup.id,
    },
  });

  console.log('Usuário admin garantido:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
