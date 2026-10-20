import { randomUUID } from 'node:crypto';
import { OrigemNc, Segmento } from '@prisma/client';
import { avaliarFornecedor } from '@promec/motor';
import { pd, tt } from '../comum/decimal';
import { proximoNumero } from '../orcamentos/numeracao';
import { Db } from '../tabelas-custos/entrada';

export type TipoItemPlano = 'DIMENSIONAL' | 'VISUAL' | 'SOLDA' | 'CHECK';
export interface ItemPlano {
  id: string;
  descricao: string;
  tipo: TipoItemPlano;
  nominal?: string | null;
  tolInferior?: string | null;
  tolSuperior?: string | null;
  unidade?: string | null;
  instrumento?: string | null;
}

export const normalizarItensPlano = (itens: Partial<ItemPlano>[]): ItemPlano[] =>
  itens.map((i) => ({
    id: i.id ?? randomUUID(),
    descricao: (i.descricao ?? '').trim(),
    tipo: i.tipo ?? 'CHECK',
    ...(i.tipo === 'DIMENSIONAL'
      ? { nominal: String(i.nominal), tolInferior: String(i.tolInferior ?? 0), tolSuperior: String(i.tolSuperior ?? 0), unidade: i.unidade ?? 'mm', instrumento: i.instrumento ?? null }
      : { instrumento: i.instrumento ?? null })
  }));

/** Mantém só a versão mais alta de cada plano (lista já ordenada por versão decrescente). */
export const ultimasVersoes = <T extends { planoId: string }>(versoes: T[]) => [...versoes.reduce((m, v) => (m.has(v.planoId) ? m : m.set(v.planoId, v)), new Map<string, T>()).values()];

/** Última versão do plano ativo do segmento (o primeiro por nome). */
export async function planoDoSegmento(db: Db, tenantId: string, segmento: Segmento) {
  const versoes = await db.planoInspecao.findMany({ where: { tenantId, segmento }, orderBy: [{ nome: 'asc' }, { versao: 'desc' }] });
  const ultimas = ultimasVersoes(versoes).filter((v) => v.ativo);
  const p = ultimas.sort((a, b) => a.nome.localeCompare(b.nome))[0];
  return p ? { planoInspecaoId: p.planoId, planoVersao: p.versao } : { planoInspecaoId: null, planoVersao: null };
}

export async function ultimaVersao(db: Db, tenantId: string, planoId: string) {
  return db.planoInspecao.findFirst({ where: { tenantId, planoId }, orderBy: { versao: 'desc' } });
}

/** Abre a NC; de fornecedor ou material com lote, pesa na avaliação do fornecedor. */
export async function abrirNc(
  db: Db,
  tenantId: string,
  nc: { origem: OrigemNc; descricao: string; osId?: string | null; centroId?: string | null; loteId?: string | null; fornecedorId?: string | null; colaboradorId?: string | null }
) {
  let fornecedorId = nc.fornecedorId ?? null;
  if (!fornecedorId && nc.loteId) fornecedorId = (await db.lote.findUnique({ where: { id: nc.loteId } }))?.fornecedorId ?? null;
  const criada = await db.naoConformidade.create({
    data: {
      tenantId,
      numero: await proximoNumero(db, tenantId, 'NC'),
      origem: nc.origem,
      descricao: nc.descricao,
      osId: nc.osId ?? null,
      centroId: nc.centroId ?? null,
      loteId: nc.loteId ?? null,
      fornecedorId,
      colaboradorId: nc.colaboradorId ?? null
    }
  });
  if (fornecedorId && (nc.origem === 'FORNECEDOR' || (nc.origem === 'MATERIAL' && nc.loteId))) {
    const f = await db.fornecedor.findUnique({ where: { id: fornecedorId } });
    if (f) {
      await db.fornecedor.update({
        where: { id: f.id },
        data: {
          avaliacao: pd(
            avaliarFornecedor({ notaAtual: tt(f.avaliacao), entregas: f.entregas, noPrazo: true, divergenciaQuantidade: false, divergenciaPreco: false, naoConforme: true })
          )
        }
      });
    }
  }
  return criada;
}
