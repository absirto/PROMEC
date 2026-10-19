import { Db } from '../tabelas-custos/entrada';

export const formatarNumero = (ano: number, n: number) => `ORC-${ano}-${String(n).padStart(5, '0')}`;

/** Próximo número sem furos da série anual do tenant. */
export async function proximoNumero(db: Db, tenantId: string, ano = new Date().getFullYear()) {
  const s = await db.sequencia.upsert({
    where: { tenantId_chave: { tenantId, chave: `ORC-${ano}` } },
    create: { tenantId, chave: `ORC-${ano}`, valor: 1 },
    update: { valor: { increment: 1 } }
  });
  return formatarNumero(ano, s.valor);
}
