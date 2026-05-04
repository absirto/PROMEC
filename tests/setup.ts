import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_32chars_min!!';
process.env.ALLOW_PUBLIC_REGISTER = 'false';
process.env.ALLOW_PUBLIC_EXTERNAL_LOOKUP = 'false';

export const prisma = new PrismaClient();

export async function globalSetup() {
  // Intencionalmente vazio: evita deleteMany em User (FKs) e mantém migrações do CI.
}

export async function globalTeardown() {
  await prisma.$disconnect();
}
