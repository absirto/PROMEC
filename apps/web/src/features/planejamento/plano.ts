import { planejar, type CalendarioCentro, type EntradaPlanejamento, type ResultadoPlanejamento } from '@promec/motor';
import type { Centro, Parada, Plano } from '../../lib/types';
import { toNum } from '../../lib/format';

export type TomOcupacao = 'ok' | 'warn' | 'bad';
/** Até 75% tranquilo, até 90% atenção, acima disso sobrecarga. */
export const tomOcupacao = (f: string | number): TomOcupacao => (toNum(f) <= 0.75 ? 'ok' : toNum(f) <= 0.9 ? 'warn' : 'bad');

const DIA = 86_400_000;
const utc = (s: string) => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a!, m! - 1, d!); };
const texto = (t: number) => new Date(t).toISOString().slice(0, 10);
export const somarDias = (s: string, n: number) => texto(utc(s) + n * DIA);
export const diaDaSemana = (s: string) => new Date(utc(s)).getUTCDay();
/** Segunda-feira da semana da data. */
export const semanaDe = (s: string) => somarDias(s, -((diaDaSemana(s) + 6) % 7));
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
/** "20/10 – 26/10" */
export const rotuloSemana = (inicio: string) => `${dm(inicio)} – ${dm(somarDias(inicio, 6))}`;
export const diasDaSemana = (inicio: string) => Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const rotuloDia = (s: string) => `${NOMES[diaDaSemana(s)]} ${dm(s)}`;
export const diasEntre = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DIA);

/**
 * Reconstrói a entrada do motor a partir do plano do servidor, para recalcular no navegador ao arrastar.
 * A capacidade usa horas de expediente e eficiência do centro, como o servidor;
 * a agenda da oficina entra como ocupação fixa: carga do dia menos o que as ordens alocaram.
 */
export function entradaDoPlano(
  plano: Plano,
  centros: Centro[],
  base: Map<string, { horasExpediente: string | number; eficiencia: string | number }>,
  feriados: string[],
  paradas: Map<string, Parada[]>
): EntradaPlanejamento {
  const cad = new Map(centros.map((c) => [c.id, c]));
  const calendario: CalendarioCentro[] = plano.centros.map((c) => {
    const b = base.get(c.id) ?? cad.get(c.id);
    return {
      id: c.id,
      nome: c.nome,
      horasExpedienteMes: b?.horasExpediente ?? 0,
      eficiencia: b?.eficiencia ?? 0,
      diasSemana: cad.get(c.id)?.diasSemana,
      bloqueios: (paradas.get(c.id) ?? []).map((p) => ({ inicio: p.inicio.slice(0, 10), fim: p.fim.slice(0, 10), motivo: p.motivo }))
    };
  });
  const alocado = new Map<string, number>();
  for (const o of plano.ordens) for (const op of o.operacoes) for (const a of op.alocacao) alocado.set(`${op.centroId}|${a.data}`, (alocado.get(`${op.centroId}|${a.data}`) ?? 0) + toNum(a.horas));
  const ocupacaoFixa = plano.centros.flatMap((c) =>
    c.dias.map((d) => ({ centroId: c.id, data: d.data, horas: toNum(d.carga) - (alocado.get(`${c.id}|${d.data}`) ?? 0) })).filter((x) => x.horas > 1e-6)
  );
  return {
    hoje: plano.hoje,
    feriados,
    centros: calendario,
    ocupacaoFixa,
    ordens: plano.ordens.map((o) => ({
      id: o.id,
      prazo: o.prazo,
      prioridade: o.prioridade ?? o.ref.prioridade,
      provisoria: o.provisoria,
      posicao: plano.filaManual && !o.provisoria ? o.posicao : null,
      operacoes: o.operacoes.map((op, i) => ({ id: op.id, centroId: op.centroId, sequencia: op.sequencia ?? i, horasRestantes: op.horas }))
    }))
  };
}

/** Prévia da fila com as OS na ordem arrastada; orçamentos provisórios seguem as regras do motor. */
export function previaReordenada(e: EntradaPlanejamento, ordemOS: string[]): ResultadoPlanejamento {
  const pos = new Map(ordemOS.map((id, i) => [id, i + 1]));
  return planejar({ ...e, ordens: e.ordens.map((o) => ({ ...o, posicao: o.provisoria ? null : pos.get(o.id) ?? null })) });
}

export const moverItem = <T,>(xs: T[], de: number, para: number) => {
  const r = [...xs];
  const [x] = r.splice(de, 1);
  r.splice(Math.max(0, Math.min(r.length, para)), 0, x!);
  return r;
};
