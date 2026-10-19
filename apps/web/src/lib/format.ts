type N = string | number | null | undefined;

const nf = new Map<string, Intl.NumberFormat>();
const fmt = (min: number, max = min) => {
  const k = `${min}-${max}`;
  if (!nf.has(k)) nf.set(k, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max }));
  return nf.get(k)!;
};
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const toNum = (v: N): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** R$ 1.234,56 */
export const brl = (v: N) => moeda.format(toNum(v)).replace(/ /g, ' ');
/** 1.234,56 */
export const num = (v: N, casas = 2) => fmt(casas).format(toNum(v));
/** Fração 0–1 para "16,5%". */
export const pct = (v: N, casas = 1) => `${fmt(casas).format(toNum(v) * 100)}%`;
/** 3,40 h */
export const horas = (v: N, casas = 2) => `${fmt(casas).format(toNum(v))} h`;
/** 0,10 h → 00:06 */
export const hhmm = (v: N) => {
  const min = Math.round(toNum(v) * 60);
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
};

export const data = (iso?: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : '—';
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-10" → "outubro de 2026" */
export const competenciaLonga = (c?: string | null) => {
  if (!c) return '—';
  const [a, m] = c.split('-').map(Number);
  return `${MESES[m - 1] ?? '?'} de ${a}`;
};
export const mesNome = (c: string) => MESES[Number(c.split('-')[1]) - 1] ?? c;

export const competenciaAtual = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const somarMes = (c: string, delta: number) => {
  const [a, m] = c.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return competenciaAtual(d);
};

/** Texto digitado em pt-BR ("1.234,5") para decimal ("1234.5"); vazio fica vazio. */
export const parseBR = (t: string): string => {
  const s = t.replace(/[^\d,.-]/g, '');
  if (!s) return '';
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpo);
  return Number.isFinite(n) ? String(n) : '';
};

/** Decimal ("1234.5") para texto editável pt-BR ("1234,5"), sem separador de milhar. */
export const paraCampo = (v: N, casas?: number) => {
  if (v === null || v === undefined || v === '') return '';
  const n = toNum(v);
  const s = casas === undefined ? String(Number(n.toFixed(6))) : n.toFixed(casas);
  return s.replace('.', ',');
};

export const iniciais = (nome?: string) =>
  (nome ?? '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
