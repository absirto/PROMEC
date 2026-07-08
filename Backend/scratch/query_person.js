require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const people = await prisma.person.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    include: { contacts: true }
  });
  console.dir(people, { depth: null });
}

main().finally(() => prisma.$disconnect());
