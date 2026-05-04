
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPermissions() {
  const permissions = await prisma.permission.findMany();
  console.log(JSON.stringify(permissions, null, 2));
}

checkPermissions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
