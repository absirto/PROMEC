import Decimal from 'decimal.js';

/** Valor de entrada: número ou texto decimal ("117.7777"). Saídas do motor são texto com precisão cheia. */
export type Num = number | string;

const D = Decimal.clone({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export const dec = (v: Num | Dec | undefined | null): Dec => new D(v ?? 0);
export const ZERO = dec(0);
export const UM = dec(1);

export const soma = (vs: Dec[]): Dec => vs.reduce((a, b) => a.plus(b), ZERO);

/** Texto com precisão cheia, para trafegar entre backend, banco e tela sem perder centavos. */
export const txt = (v: Dec): string => v.toDecimalPlaces(10).toFixed();

/** Arredonda para exibição (meio para cima, como a planilha). */
export const arredondar = (v: Num | Dec, casas = 2): string => dec(v).toFixed(casas, D.ROUND_HALF_UP);

/** Atalho para dinheiro com 2 casas. */
export const reais = (v: Num | Dec): string => arredondar(v, 2);

/** Percentual de 0 a 1 vindo da tela ou do banco. */
export function fracao(v: Num | undefined, campo: string): Dec {
  const d = dec(v ?? 0);
  if (d.isNaN() || d.lt(0) || d.gt(1)) throw new RangeError(`${campo} precisa estar entre 0% e 100%.`);
  return d;
}
