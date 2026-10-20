import { dec, soma, txt, ZERO, type Dec, type Num } from './numero.js';

export type Prioridade = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';

export interface CalendarioCentro {
  id: string;
  nome: string;
  /** Mesma base da Tabela de Custos: horas de expediente no mês e eficiência. */
  horasExpedienteMes: Num;
  eficiencia: Num;
  /** Dias de trabalho (0 = domingo … 6 = sábado). Padrão: segunda a sexta. */
  diasSemana?: number[];
  /** Paradas (manutenção etc.), datas inclusivas AAAA-MM-DD. */
  bloqueios?: { inicio: string; fim: string; motivo?: string }[];
}

export interface OperacaoPlanejavel {
  id: string;
  centroId: string;
  sequencia: number;
  horasRestantes: Num;
}

export interface OrdemPlanejavel {
  id: string;
  prioridade?: Prioridade;
  prazo?: string | null;
  /** Posição definida à mão (arrastar e soltar); vence os demais critérios. */
  posicao?: number | null;
  /** Orçamento aprovado ainda não convertido: reserva capacidade, mas fica atrás das OS. */
  provisoria?: boolean;
  /** Entra depois de todas as outras (simulação de promessa de prazo). */
  fimDaFila?: boolean;
  operacoes: OperacaoPlanejavel[];
}

export interface EntradaPlanejamento {
  hoje: string;
  horizonteDias?: number;
  feriados?: string[];
  centros: CalendarioCentro[];
  ordens: OrdemPlanejavel[];
  /** Horas já tomadas por agenda (hora marcada na oficina) ou reservas fixas. */
  ocupacaoFixa?: { centroId: string; data: string; horas: Num }[];
  /** Acima disso a semana é sobrecarga (padrão 90%). */
  limiteSobrecarga?: Num;
}

export interface AlocacaoDia {
  data: string;
  horas: string;
}

export interface OperacaoPlanejada {
  id: string;
  centroId: string;
  inicio: string | null;
  fim: string | null;
  horas: string;
  alocacao: AlocacaoDia[];
}

export interface OrdemPlanejada {
  id: string;
  posicao: number;
  inicio: string | null;
  fim: string | null;
  prazo: string | null;
  /** Dias corridos entre o prazo e o fim previsto (positivo = atraso). */
  atrasoDias: number;
  atrasada: boolean;
  provisoria: boolean;
  operacoes: OperacaoPlanejada[];
}

export interface SemanaCentro {
  inicio: string;
  capacidade: string;
  carga: string;
  ocupacao: string;
  sobrecarga: boolean;
}

export interface CentroPlanejado {
  id: string;
  nome: string;
  semanas: SemanaCentro[];
  dias: { data: string; capacidade: string; carga: string }[];
}

export interface ResultadoPlanejamento {
  ordens: OrdemPlanejada[];
  centros: CentroPlanejado[];
  semDestino: { ordemId: string; operacaoId: string; motivo: 'CENTRO_INEXISTENTE' | 'SEM_CAPACIDADE' }[];
  alertas: { tipo: 'sobrecarga' | 'atraso'; centroId?: string; ordemId?: string; semana?: string; mensagem: string }[];
}

const DIA = 86_400_000;
const paraData = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const paraTexto = (t: number) => new Date(t).toISOString().slice(0, 10);
const somarDias = (s: string, n: number) => paraTexto(paraData(s) + n * DIA);
const diaSemana = (s: string) => new Date(paraData(s)).getUTCDay();
const segundaDa = (s: string) => somarDias(s, -((diaSemana(s) + 6) % 7));
const diasEntre = (a: string, b: string) => Math.round((paraData(b) - paraData(a)) / DIA);

const PESO_PRIORIDADE: Record<Prioridade, number> = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAIXA: 3 };

/** Capacidade de um dia: horas reais do mês (expediente × eficiência) ÷ dias úteis do mês. */
function capacidadeDoDia(c: CalendarioCentro, data: string, feriados: Set<string>, diasUteisMes: Map<string, number>): Dec {
  const dias = c.diasSemana ?? [1, 2, 3, 4, 5];
  if (!dias.includes(diaSemana(data)) || feriados.has(data)) return ZERO;
  if (c.bloqueios?.some((b) => data >= b.inicio && data <= b.fim)) return ZERO;
  const mes = data.slice(0, 7);
  const chave = `${c.id}|${mes}`;
  let n = diasUteisMes.get(chave);
  if (n === undefined) {
    n = 0;
    for (let d = `${mes}-01`; d.startsWith(mes); d = somarDias(d, 1)) {
      if (dias.includes(diaSemana(d)) && !feriados.has(d)) n++;
    }
    diasUteisMes.set(chave, n);
  }
  return n === 0 ? ZERO : dec(c.horasExpedienteMes).times(dec(c.eficiencia)).div(n);
}

export function ordenarFila(ordens: OrdemPlanejavel[], hoje: string): OrdemPlanejavel[] {
  const chave = (o: OrdemPlanejavel) => [
    o.fimDaFila ? Number.POSITIVE_INFINITY : (o.posicao ?? Number.MAX_SAFE_INTEGER),
    o.provisoria ? 1 : 0,
    o.prazo && o.prazo < hoje ? 0 : 1,
    PESO_PRIORIDADE[o.prioridade ?? 'NORMAL'],
    o.prazo ?? '9999-12-31'
  ];
  return [...ordens].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Programa as operações em capacidade finita, dia a dia: cada OS na ordem da fila, cada operação
 * depois da anterior do mesmo roteiro (pode começar no mesmo dia em que a anterior termina).
 */
export function planejar(e: EntradaPlanejamento): ResultadoPlanejamento {
  const horizonte = e.horizonteDias ?? 180;
  const feriados = new Set(e.feriados ?? []);
  const limite = dec(e.limiteSobrecarga ?? '0.9');
  const diasUteisMes = new Map<string, number>();
  const centros = new Map(e.centros.map((c) => [c.id, c]));
  const cap = new Map<string, Dec>();
  const usado = new Map<string, Dec>();
  const k = (centroId: string, data: string) => `${centroId}|${data}`;
  const capacidade = (centroId: string, data: string) => {
    const key = k(centroId, data);
    let v = cap.get(key);
    if (!v) {
      v = capacidadeDoDia(centros.get(centroId)!, data, feriados, diasUteisMes);
      cap.set(key, v);
    }
    return v;
  };
  const usar = (centroId: string, data: string, h: Dec) => usado.set(k(centroId, data), (usado.get(k(centroId, data)) ?? ZERO).plus(h));
  const livre = (centroId: string, data: string) => capacidade(centroId, data).minus(usado.get(k(centroId, data)) ?? ZERO);

  for (const f of e.ocupacaoFixa ?? []) if (centros.has(f.centroId) && f.data >= e.hoje) usar(f.centroId, f.data, dec(f.horas));

  const ultimoDia = somarDias(e.hoje, horizonte - 1);
  const semDestino: ResultadoPlanejamento['semDestino'] = [];
  const alertas: ResultadoPlanejamento['alertas'] = [];
  let fimHorizonte = e.hoje;

  const ordens = ordenarFila(e.ordens, e.hoje).map((o, posicao): OrdemPlanejada => {
    let cursor = e.hoje;
    const operacoes = [...o.operacoes]
      .sort((a, b) => a.sequencia - b.sequencia)
      .map((op): OperacaoPlanejada => {
        const total = dec(op.horasRestantes);
        if (!centros.has(op.centroId)) {
          semDestino.push({ ordemId: o.id, operacaoId: op.id, motivo: 'CENTRO_INEXISTENTE' });
          return { id: op.id, centroId: op.centroId, inicio: null, fim: null, horas: txt(total), alocacao: [] };
        }
        if (total.lte(0)) return { id: op.id, centroId: op.centroId, inicio: cursor, fim: cursor, horas: '0', alocacao: [] };
        let falta = total;
        const alocacao: AlocacaoDia[] = [];
        for (let d = cursor; d <= ultimoDia && falta.gt(0); d = somarDias(d, 1)) {
          const l = livre(op.centroId, d);
          if (l.lte(0)) continue;
          const h = l.lt(falta) ? l : falta;
          usar(op.centroId, d, h);
          falta = falta.minus(h);
          alocacao.push({ data: d, horas: txt(h) });
        }
        if (falta.gt(0)) {
          semDestino.push({ ordemId: o.id, operacaoId: op.id, motivo: 'SEM_CAPACIDADE' });
          return { id: op.id, centroId: op.centroId, inicio: alocacao[0]?.data ?? null, fim: null, horas: txt(total), alocacao };
        }
        const fim = alocacao[alocacao.length - 1].data;
        cursor = fim;
        if (fim > fimHorizonte) fimHorizonte = fim;
        return { id: op.id, centroId: op.centroId, inicio: alocacao[0].data, fim, horas: txt(total), alocacao };
      });

    const completas = operacoes.every((op) => op.fim !== null);
    const inicio = operacoes.map((op) => op.inicio).filter((d): d is string => !!d).sort()[0] ?? null;
    const fim = completas ? (operacoes.map((op) => op.fim!).sort().pop() ?? e.hoje) : null;
    const prazo = o.prazo ?? null;
    const atrasoDias = prazo && fim ? Math.max(0, diasEntre(prazo, fim)) : 0;
    const atrasada = !!prazo && (fim === null || fim > prazo);
    if (atrasada) {
      alertas.push({
        tipo: 'atraso',
        ordemId: o.id,
        mensagem: fim ? `Pela fila atual termina ${atrasoDias} dia(s) depois do prazo.` : 'Não cabe na capacidade do horizonte planejado.'
      });
    }
    return { id: o.id, posicao: posicao + 1, inicio, fim, prazo, atrasoDias, atrasada, provisoria: !!o.provisoria, operacoes };
  });

  const ultimaSemana = segundaDa(fimHorizonte > somarDias(e.hoje, 55) ? fimHorizonte : somarDias(e.hoje, 55));
  const semanasInicio: string[] = [];
  for (let s = segundaDa(e.hoje); s <= ultimaSemana; s = somarDias(s, 7)) semanasInicio.push(s);

  const resultadoCentros = e.centros.map((c): CentroPlanejado => {
    const dias: CentroPlanejado['dias'] = [];
    const semanas = semanasInicio.map((s): SemanaCentro => {
      const caps: Dec[] = [];
      const cargas: Dec[] = [];
      for (let i = 0; i < 7; i++) {
        const d = somarDias(s, i);
        if (d < e.hoje) continue;
        const cd = capacidade(c.id, d);
        const ud = usado.get(k(c.id, d)) ?? ZERO;
        caps.push(cd);
        cargas.push(ud);
        dias.push({ data: d, capacidade: txt(cd), carga: txt(ud) });
      }
      const capacidadeSemana = soma(caps);
      const carga = soma(cargas);
      const ocupacao = capacidadeSemana.gt(0) ? carga.div(capacidadeSemana) : carga.gt(0) ? dec(9.99) : ZERO;
      const sobrecarga = ocupacao.gt(limite);
      if (sobrecarga) {
        alertas.push({
          tipo: 'sobrecarga',
          centroId: c.id,
          semana: s,
          mensagem: `${c.nome} está com ${ocupacao.times(100).toFixed(0)}% de ocupação na semana de ${s.slice(8, 10)}/${s.slice(5, 7)}.`
        });
      }
      return { inicio: s, capacidade: txt(capacidadeSemana), carga: txt(carga), ocupacao: txt(ocupacao), sobrecarga };
    });
    return { id: c.id, nome: c.nome, semanas, dias };
  });

  return { ordens, centros: resultadoCentros, semDestino, alertas };
}

/** Data mais cedo de entrega para um roteiro novo, colocado no fim da fila atual. */
export function prometerPrazo(e: EntradaPlanejamento, roteiro: Omit<OperacaoPlanejavel, 'id'>[]): { fim: string | null; ocupacaoMaxima: string; resultado: ResultadoPlanejamento } {
  const nova: OrdemPlanejavel = {
    id: '__nova__',
    fimDaFila: true,
    provisoria: true,
    operacoes: roteiro.map((r, i) => ({ ...r, id: `__op${i}__` }))
  };
  const resultado = planejar({ ...e, ordens: [...e.ordens, nova] });
  const ordem = resultado.ordens.find((o) => o.id === '__nova__')!;
  const tocados = new Set(roteiro.map((r) => r.centroId));
  const ocup = resultado.centros
    .filter((c) => tocados.has(c.id))
    .flatMap((c) => c.semanas.filter((s) => ordem.operacoes.some((op) => op.alocacao.some((a) => segundaDa(a.data) === s.inicio))).map((s) => dec(s.ocupacao)));
  const ocupacaoMaxima = ocup.reduce((a, b) => (b.gt(a) ? b : a), ZERO);
  return { fim: ordem.fim, ocupacaoMaxima: txt(ocupacaoMaxima), resultado };
}
