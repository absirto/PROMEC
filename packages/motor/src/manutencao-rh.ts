import { dec, fracao, soma, txt, UM, ZERO, type Dec, type Num } from './numero.js';

const DIA = 86_400_000;
const paraData = (s: string) => {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const paraTexto = (t: number) => new Date(t).toISOString().slice(0, 10);
const somarDias = (s: string, n: number) => paraTexto(paraData(s) + n * DIA);
const diaSemana = (s: string) => new Date(paraData(s)).getUTCDay();
const diasEntre = (a: string, b: string) => Math.round((paraData(b) - paraData(a)) / DIA);

/** Média dos últimos `n` valores (média móvel); vazio dá zero. */
export function mediaMovel(valores: Num[], n: number): string {
  const ultimos = valores.slice(-n).map((v) => dec(v));
  return ultimos.length === 0 ? '0' : txt(soma(ultimos).div(ultimos.length));
}

/**
 * MTBF, MTTR e disponibilidade no período. Horas de operação = horas apontadas no centro;
 * cada quebra tem as horas paradas até voltar a produzir.
 */
export function indicadoresManutencao(p: { horasOperacao: Num; quebras: { horasParado: Num }[]; custoManutencao: Num }): {
  quebras: number;
  mtbf: string | null;
  mttr: string | null;
  disponibilidade: string;
  horasParado: string;
  custoPorHoraProduzida: string | null;
} {
  const op = dec(p.horasOperacao);
  const parado = soma(p.quebras.map((q) => dec(q.horasParado)));
  const n = p.quebras.length;
  const mtbf = n > 0 ? op.div(n) : null;
  const mttr = n > 0 ? parado.div(n) : null;
  const total = op.plus(parado);
  return {
    quebras: n,
    mtbf: mtbf ? txt(mtbf) : null,
    mttr: mttr ? txt(mttr) : null,
    disponibilidade: txt(total.isZero() ? UM : op.div(total)),
    horasParado: txt(parado),
    custoPorHoraProduzida: op.gt(0) ? txt(dec(p.custoManutencao).div(op)) : null
  };
}

/** Situação de um plano preventivo por horas de uso ou por calendário. */
export function situacaoPreventiva(
  p:
    | { tipo: 'HORAS'; intervaloHoras: Num; horasDesdeUltima: Num; avisoHoras?: Num }
    | { tipo: 'CALENDARIO'; intervaloDias: number; ultimaExecucao: string; hoje: string; avisoDias?: number }
): { situacao: 'ok' | 'proxima' | 'vencida'; falta: string; proximaData: string | null; progresso: string } {
  if (p.tipo === 'HORAS') {
    const intervalo = dec(p.intervaloHoras);
    const usado = dec(p.horasDesdeUltima);
    const falta = intervalo.minus(usado);
    const aviso = dec(p.avisoHoras ?? intervalo.times('0.1'));
    return {
      situacao: falta.lte(0) ? 'vencida' : falta.lte(aviso) ? 'proxima' : 'ok',
      falta: txt(falta),
      proximaData: null,
      progresso: txt(intervalo.isZero() ? UM : usado.div(intervalo))
    };
  }
  const proxima = somarDias(p.ultimaExecucao, p.intervaloDias);
  const falta = diasEntre(p.hoje, proxima);
  const aviso = p.avisoDias ?? Math.max(1, Math.round(p.intervaloDias * 0.1));
  return {
    situacao: falta <= 0 ? 'vencida' : falta <= aviso ? 'proxima' : 'ok',
    falta: String(falta),
    proximaData: proxima,
    progresso: txt(dec(diasEntre(p.ultimaExecucao, p.hoje)).div(p.intervaloDias))
  };
}

export interface Ausencia {
  inicio: string;
  fim: string;
  tipo?: string;
}

/**
 * Horas disponíveis do colaborador no mês: jornada × dias úteis trabalhados ÷ dias úteis do mês.
 * Devolve também os dias úteis ausentes, para reduzir a capacidade dos centros em que ele está alocado.
 */
export function disponibilidadeNoMes(p: {
  competencia: string;
  jornadaHoras: Num;
  ausencias: Ausencia[];
  feriados?: string[];
  diasSemana?: number[];
}): { diasUteis: number; diasAusente: number; horasDisponiveis: string; diasAusencia: string[] } {
  const feriados = new Set(p.feriados ?? []);
  const dias = p.diasSemana ?? [1, 2, 3, 4, 5];
  const uteis: string[] = [];
  for (let d = `${p.competencia}-01`; d.startsWith(p.competencia); d = somarDias(d, 1)) {
    if (dias.includes(diaSemana(d)) && !feriados.has(d)) uteis.push(d);
  }
  const ausentes = uteis.filter((d) => p.ausencias.some((a) => d >= a.inicio && d <= a.fim));
  const horas = uteis.length === 0 ? ZERO : dec(p.jornadaHoras).times(uteis.length - ausentes.length).div(uteis.length);
  return { diasUteis: uteis.length, diasAusente: ausentes.length, horasDisponiveis: txt(horas), diasAusencia: ausentes };
}

/** Custo mensal e custo-hora do colaborador; encargos em valor ou em % do salário pelo vínculo. */
export function custoColaborador(p: {
  salario: Num;
  encargos?: Num;
  encargosPercentual?: Num;
  beneficios?: Num;
  horasDisponiveis: Num;
}): { encargos: string; custoMensal: string; custoHora: string | null } {
  const sal = dec(p.salario);
  const enc = p.encargosPercentual !== undefined ? sal.times(fracao(p.encargosPercentual, 'Encargos')) : dec(p.encargos);
  const mensal = sal.plus(enc).plus(dec(p.beneficios));
  const h = dec(p.horasDisponiveis);
  return { encargos: txt(enc), custoMensal: txt(mensal), custoHora: h.gt(0) ? txt(mensal.div(h)) : null };
}

/**
 * Produtividade = horas apontadas ÷ horas disponíveis. Abaixo da eficiência usada na Tabela de Custos
 * por 2 meses seguidos pede recalibração.
 */
export function produtividade(p: { meses: { horasApontadas: Num; horasDisponiveis: Num }[]; eficienciaTabela: Num }): {
  meses: string[];
  atual: string;
  recalibrar: boolean;
} {
  const eta = dec(p.eficienciaTabela);
  const vals: Dec[] = p.meses.map((m) => (dec(m.horasDisponiveis).gt(0) ? dec(m.horasApontadas).div(dec(m.horasDisponiveis)) : ZERO));
  const ult2 = vals.slice(-2);
  return {
    meses: vals.map(txt),
    atual: txt(vals[vals.length - 1] ?? ZERO),
    recalibrar: ult2.length === 2 && ult2.every((v) => v.lt(eta))
  };
}

/** Fator de capacidade do centro num dia: alocação dos presentes ÷ alocação total (sem operadores = 1). */
export function fatorPresenca(operadores: { alocacao: Num; ausente: boolean }[]): string {
  const total = soma(operadores.map((o) => dec(o.alocacao)));
  if (total.isZero()) return '1';
  const presentes = soma(operadores.filter((o) => !o.ausente).map((o) => dec(o.alocacao)));
  return txt(presentes.div(total));
}

/** Custo mensal de manter o ativo atual contra comprar um novo (depreciação + manutenção). */
export function compararSubstituicao(p: {
  manutencaoAtualMes: Num;
  depreciacaoAtualMes: Num;
  valorNovo: Num;
  vidaUtilNovoMeses: Num;
  residualNovo?: Num;
  manutencaoNovoMes: Num;
}): { atualMes: string; novoMes: string; economiaMes: string; vale: boolean } {
  const atual = dec(p.manutencaoAtualMes).plus(dec(p.depreciacaoAtualMes));
  const novo = dec(p.valorNovo).minus(dec(p.residualNovo)).div(dec(p.vidaUtilNovoMeses)).plus(dec(p.manutencaoNovoMes));
  const eco = atual.minus(novo);
  return { atualMes: txt(atual), novoMes: txt(novo), economiaMes: txt(eco), vale: eco.gt(0) };
}
