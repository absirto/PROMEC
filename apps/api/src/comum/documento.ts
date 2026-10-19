const digitos = (s: string) => s.replace(/\D/g, '');

const dv = (base: string, pesos: number[]) => {
  const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
};

export function cpfValido(valor: string): boolean {
  const s = digitos(valor);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  const d1 = dv(s.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(s.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return s.endsWith(`${d1}${d2}`);
}

const P1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const P2 = [6, ...P1];

export function cnpjValido(valor: string): boolean {
  const s = digitos(valor);
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  return s.endsWith(`${dv(s.slice(0, 12), P1)}${dv(s.slice(0, 13), P2)}`);
}

/** Completa os dígitos verificadores de uma raiz de 12 dígitos (usado no seed). */
export function completarCnpj(raiz12: string): string {
  const d1 = dv(raiz12, P1);
  return `${raiz12}${d1}${dv(`${raiz12}${d1}`, P2)}`;
}

export const somenteDigitos = digitos;
