import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { semearEmpresa } from '../src/seed/semear';

const env = resolve(__dirname, '../.env');
if (existsSync(env)) process.loadEnvFile(env);

async function main() {
  const db = new PrismaClient();
  try {
    const r = await semearEmpresa(db, {
      prefixo: 'uj',
      nome: 'Usinagem Joinville',
      dominio: 'usinagemjoinville.com.br',
      senha: process.env.SEED_SENHA ?? 'promec2026'
    });
    console.log(`Usinagem Joinville pronta. Entre com ${r.emails.gestor}. ORC-2026-00128: R$ ${Number(r.precos[128]).toFixed(2)}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
