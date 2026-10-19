import { Db } from '../tabelas-custos/entrada';

export const formatarNumero = (ano: number, n: number, prefixo = 'ORC') => `${prefixo}-${ano}-${String(n).padStart(5, '0')}`;

/** Próximo número sem furos da série anual do tenant (ORC, OS…). */
export async function proximoNumero(db: Db, tenantId: string, prefixo = 'ORC', ano = new Date().getFullYear()) {
  const chave = `${prefixo}-${ano}`;
  const s = await db.sequencia.upsert({
    where: { tenantId_chave: { tenantId, chave } },
    create: { tenantId, chave, valor: 1 },
    update: { valor: { increment: 1 } }
  });
  return formatarNumero(ano, s.valor, prefixo);
}
