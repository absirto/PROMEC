import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const people = await prisma.person.findMany({
    include: {
      naturalPerson: true,
      legalPerson: true
    }
  });
  console.log(JSON.stringify(people, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
