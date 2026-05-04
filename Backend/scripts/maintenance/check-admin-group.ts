import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'guidortas25@gmail.com' },
    include: {
      group: {
        include: {
          permissions: { include: { permission: true } }
        }
      }
    }
  });
  console.dir(user, { depth: 10 });
}

main().finally(() => prisma.$disconnect());
