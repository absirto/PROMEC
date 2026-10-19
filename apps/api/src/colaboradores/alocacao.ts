import { Prisma } from '@prisma/client';
import { pct } from '../comum/decimal';
import { invalido, regra } from '../comum/erros';
import { Db } from '../tabelas-custos/entrada';

/** A soma das alocações de um colaborador entre centros não passa de 100%. */
export async function conferirAlocacao(db: Db, tenantId: string, colaboradorId: string, nome: string, novas: Prisma.Decimal, excetoCentroId?: string) {
  const outras = await db.centroOperador.aggregate({
    where: { tenantId, colaboradorId, ...(excetoCentroId ? { centroId: { not: excetoCentroId } } : {}) },
    _sum: { alocacao: true }
  });
  const total = novas.plus(outras._sum.alocacao ?? 0);
  if (total.gt(1)) {
    throw regra(
      'ALOCACAO_EXCEDIDA',
      `${nome} ficaria alocado em ${pct(total.toFixed())} somando os centros. O máximo é 100%; reduza a alocação em algum centro.`,
      { colaboradorId, total: total.toFixed() }
    );
  }
}

export function semRepetidos(ids: string[], campo: string) {
  if (new Set(ids).size !== ids.length) {
    throw invalido(`O mesmo item aparece duas vezes em ${campo}. Deixe cada um uma vez só, com a alocação somada.`);
  }
}
