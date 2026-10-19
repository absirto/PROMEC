import { Prisma } from '@prisma/client';
import { arredondar, dec } from '@promec/motor';

export type Entrada = string | number;

/** Decimal do banco para texto sem notação científica nem perda de casas. */
export const t = (v: Prisma.Decimal | null | undefined): string | null => (v === null || v === undefined ? null : v.toFixed());
export const tt = (v: Prisma.Decimal): string => v.toFixed();

/** Entrada da API (texto ou número) para Decimal do Prisma. */
export const pd = (v: Entrada): Prisma.Decimal => new Prisma.Decimal(String(v));
export function pdOpc(v: Entrada | undefined): Prisma.Decimal | undefined;
export function pdOpc(v: Entrada | null | undefined): Prisma.Decimal | null | undefined;
export function pdOpc(v: Entrada | null | undefined) {
  return v === undefined ? undefined : v === null ? null : pd(v);
}

/** Percentual legível em pt-BR ("16,5%"). */
export const pct = (v: Entrada) => `${arredondar(dec(v).times(100), 1).replace('.', ',').replace(/,0$/, '')}%`;

export const competenciaAtual = () => new Date().toISOString().slice(0, 7);
export const RE_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export const dataIso = (d: Date) => d.toISOString().slice(0, 10);
export const hoje = () => new Date(`${dataIso(new Date())}T00:00:00.000Z`);
