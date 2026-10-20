export const FUSO = 'America/Sao_Paulo';

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** Data (AAAA-MM-DD) e minutos do dia no horário de Brasília. */
export function local(d: Date) {
  const p = Object.fromEntries(formato.formatToParts(d).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

export const hojeLocal = () => local(new Date()).data;

/** Data de banco (@db.Date) para AAAA-MM-DD. */
export const textoData = (d: Date) => d.toISOString().slice(0, 10);
export const dataBanco = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

export const somarDias = (s: string, n: number) => {
  const d = dataBanco(s);
  d.setUTCDate(d.getUTCDate() + n);
  return textoData(d);
};
export const diaDaSemana = (s: string) => dataBanco(s).getUTCDay();
export const segundaDa = (s: string) => somarDias(s, -((diaDaSemana(s) + 6) % 7));

/** Horário sem fuso é lido como horário de Brasília. */
export function lerHorario(s: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.length === 16 ? `${s}:00` : s}-03:00`);
}

/** Meia-noite de Brasília de uma data local, como instante. */
export const inicioDoDia = (s: string) => new Date(`${s}T00:00:00-03:00`);
