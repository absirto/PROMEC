export const ENCARGOS_PADRAO: Record<string, string> = { CLT: '0.64', HORISTA: '0.64', PJ: '0', SOCIO: '0' };
export const VINCULOS: [string, string][] = [['CLT', 'CLT'], ['HORISTA', 'Horista'], ['PJ', 'PJ'], ['SOCIO', 'Sócio']];

/** "0.64" → "64" (até 2 casas, sem zeros sobrando). */
export const fracaoParaPercentual = (f: string | number) => String(Math.round(Number(f) * 10000) / 100);
/** "64" ou "64,5" → "0.64" / "0.645". */
export const percentualParaFracao = (p: string) => String(Math.round(Number(String(p).replace(',', '.')) * 100) / 10000);
