import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSettings() {
  // Busca o registro único de configurações
  return prisma.settings.findFirst();
}
