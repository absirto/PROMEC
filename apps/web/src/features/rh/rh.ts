import { custoColaborador, disponibilidadeNoMes } from '@promec/motor';
import { ApiError } from '../../lib/api';
import type { Colaborador, Parametros, Vinculo } from '../../lib/types';
import { brl, num, pct, toNum } from '../../lib/format';
import type { Tom } from '../../components/Pill';

/* ---------- Tipos da API de RH ---------- */

export type TipoAusencia = 'FERIAS' | 'AFASTAMENTO' | 'TREINAMENTO' | 'FALTA' | 'FOLGA';
export type SituacaoHab = 'ok' | 'vencendo' | 'vencida';

export interface Ausencia {
  id: string;
  colaboradorId: string;
  colaborador: { id: string; nome: string } | null;
  tipo: TipoAusencia;
  inicio: string;
  fim: string;
  observacao: string | null;
}

export interface Habilitacao {
  id: string;
  colaboradorId: string;
  colaborador: { id: string; nome: string } | null;
  centroId: string;
  centroNome: string | null;
  descricao: string;
  emissao: string;
  validade: string;
  documento: string | null;
  situacao: SituacaoHab;
}

export interface CelulaMatriz {
  colaboradorId: string;
  centroId: string;
  alocacao: string | null;
  habilitacao: { id?: string; descricao?: string; validade: string; situacao: SituacaoHab } | null;
}

export interface Matriz {
  colaboradores: { id: string; nome: string; funcao?: string | null }[];
  centros: { id: string; codigo: string; nome: string }[];
  celulas: CelulaMatriz[];
}

export interface DispColaborador {
  colaborador: { id: string; nome: string; funcao?: string | null };
  jornada: string;
  diasUteis: number;
  diasAusente: number;
  horasDisponiveis: string;
  ausencias: { id: string; tipo: TipoAusencia; inicio: string; fim: string }[];
}
export interface DispCentro { centroId: string; nome: string; horasExpedienteCadastro: string; horasDisponiveisReais: string }
export interface Disponibilidade { competencia: string; colaboradores: DispColaborador[]; centros: DispCentro[] }

export interface MesProdutividade { competencia: string; horasApontadas: string; horasDisponiveis: string; produtividade: string }
interface BaseProd { meses: MesProdutividade[]; atual: string; recalibrar: boolean; refugo: number; retrabalhoHoras: string }
export interface ProdColaborador extends BaseProd { colaborador: { id: string; nome: string } }
export interface ProdCentro extends BaseProd { centro: { id: string; codigo: string; nome: string }; eficienciaTabela: string }
export interface Produtividade { competencias: string[]; colaboradores: ProdColaborador[]; centros: ProdCentro[] }

/** Colaborador com os campos do RH operacional (fase 1h). */
export type ColaboradorRH = Colaborador & {
  encargosPercentual?: string | null;
  turno?: string | null;
  diasSemana?: number[];
  horasDisponiveisMes?: string;
  mascarado?: boolean;
  usuario?: { id: string; nome: string } | null;
  comissoes?: { competencia: string; valor: string }[];
};
export type ParametrosRH = Parametros & { encargosPorVinculo?: Partial<Record<Vinculo, string>> | null };

/* ---------- Rótulos ---------- */

export const TIPOS_AUSENCIA: TipoAusencia[] = ['FERIAS', 'AFASTAMENTO', 'TREINAMENTO', 'FALTA', 'FOLGA'];
export const TIPO_AUSENCIA: Record<TipoAusencia, { rotulo: string; estado: string; barra: string; ponto: string }> = {
  FERIAS: { rotulo: 'Férias', estado: 'de férias', barra: 'bg-info-soft border-info', ponto: 'bg-info' },
  AFASTAMENTO: { rotulo: 'Afastamento', estado: 'afastado', barra: 'bg-bad-soft border-bad', ponto: 'bg-bad' },
  TREINAMENTO: { rotulo: 'Treinamento', estado: 'em treinamento', barra: 'bg-run-soft border-run', ponto: 'bg-run' },
  FALTA: { rotulo: 'Falta', estado: 'com falta', barra: 'bg-warn-soft border-warn', ponto: 'bg-warn' },
  FOLGA: { rotulo: 'Folga', estado: 'de folga', barra: 'bg-ok-soft border-ok', ponto: 'bg-ok' }
};

export const DIAS_SEMANA = [
  { n: 0, curto: 'D', nome: 'domingo' },
  { n: 1, curto: 'S', nome: 'segunda' },
  { n: 2, curto: 'T', nome: 'terça' },
  { n: 3, curto: 'Q', nome: 'quarta' },
  { n: 4, curto: 'Q', nome: 'quinta' },
  { n: 5, curto: 'S', nome: 'sexta' },
  { n: 6, curto: 'S', nome: 'sábado' }
] as const;

/* ---------- Datas ---------- */

const DIA = 86_400_000;
const utc = (s: string) => {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number);
  return Date.UTC(a!, m! - 1, d!);
};
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const somarDias = (s: string, n: number) => iso(utc(s) + n * DIA);
export const diaDaSemana = (s: string) => new Date(utc(s)).getUTCDay();
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const ultimoDia = (c: string) => {
  const [a, m] = c.split('-').map(Number);
  return `${c}-${String(new Date(Date.UTC(a!, m!, 0)).getUTCDate()).padStart(2, '0')}`;
};
export const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export interface DiaMes { data: string; dia: number; semana: number; fimDeSemana: boolean }
export function diasDoMes(competencia: string): DiaMes[] {
  const fim = ultimoDia(competencia);
  const dias: DiaMes[] = [];
  for (let d = `${competencia}-01`; d <= fim; d = somarDias(d, 1)) {
    const semana = diaDaSemana(d);
    dias.push({ data: d, dia: Number(d.slice(8, 10)), semana, fimDeSemana: semana === 0 || semana === 6 });
  }
  return dias;
}

/** Coluna inicial (1 = dia 1) e quantos dias a ausência ocupa dentro do mês; null se não cai no mês. */
export function faixaNoMes(a: Pick<Ausencia, 'inicio' | 'fim'>, competencia: string): { coluna: number; dias: number; continuaAntes: boolean; continuaDepois: boolean } | null {
  const ini = `${competencia}-01`;
  const fim = ultimoDia(competencia);
  if (a.fim < ini || a.inicio > fim) return null;
  const de = a.inicio < ini ? ini : a.inicio;
  const ate = a.fim > fim ? fim : a.fim;
  return { coluna: Number(de.slice(8, 10)), dias: Math.round((utc(ate) - utc(de)) / DIA) + 1, continuaAntes: a.inicio < ini, continuaDepois: a.fim > fim };
}

export const duracaoDias = (a: Pick<Ausencia, 'inicio' | 'fim'>) => Math.round((utc(a.fim) - utc(a.inicio)) / DIA) + 1;

/** Quantas pessoas diferentes estão ausentes na data. */
export const ausentesEm = (ausencias: Pick<Ausencia, 'colaboradorId' | 'inicio' | 'fim'>[], data: string) =>
  new Set(ausencias.filter((a) => a.inicio <= data && a.fim >= data).map((a) => a.colaboradorId)).size;

export const periodo = (a: Pick<Ausencia, 'inicio' | 'fim'>) => (a.inicio === a.fim ? dm(a.inicio) : `${dm(a.inicio)} a ${dm(a.fim)}`);

/* ---------- Encargos ---------- */

export const ENCARGOS_PADRAO: Record<Vinculo, string> = { CLT: '0.64', HORISTA: '0.64', PJ: '0', SOCIO: '0' };

/** Percentual (fração) de encargos do vínculo nos parâmetros, com o padrão do produto quando falta. */
export const encargosDoVinculo = (vinculo: Vinculo, porVinculo?: Partial<Record<Vinculo, string>> | null) => porVinculo?.[vinculo] ?? ENCARGOS_PADRAO[vinculo] ?? '0';

/** Valor dos encargos a partir do percentual: "CLT: 64% = R$ 3.200,00". */
export function previaEncargos(p: { salario: string | number; percentual: string | number; vinculo?: string }): { valor: string; texto: string } {
  const f = limitarFracao(p.percentual);
  const valor = custoColaborador({ salario: Math.max(0, toNum(p.salario)), encargosPercentual: f, horasDisponiveis: 1 }).encargos;
  const cem = f * 100;
  const pc = pct(f, Math.abs(cem - Math.round(cem)) < 1e-6 ? 0 : 1);
  return { valor, texto: `${p.vinculo ? `${p.vinculo}: ` : ''}${pc} = ${brl(valor)}` };
}

/** Fração entre 0 e 1 (o motor recusa fora disso). */
export const limitarFracao = (v: string | number | null | undefined) => Math.min(1, Math.max(0, toNum(v)));

/** Custo mensal e custo-hora pelo motor, com encargos em valor ou em %. */
export function custoAoVivo(p: { salario: string; beneficios: string; encargos: string; percentual: string | null; horasDisponiveis: string | number }) {
  return custoColaborador({
    salario: Math.max(0, toNum(p.salario)),
    ...(p.percentual !== null ? { encargosPercentual: limitarFracao(p.percentual) } : { encargos: Math.max(0, toNum(p.encargos)) }),
    beneficios: Math.max(0, toNum(p.beneficios)),
    horasDisponiveis: Math.max(0, toNum(p.horasDisponiveis))
  });
}

/* ---------- Matriz de habilitações ---------- */

export type EstadoCelula = 'ok' | 'vencendo' | 'vencida' | 'sem_habilitacao' | 'nenhum';
export const ESTADO_CELULA: Record<EstadoCelula, { rotulo: string; tom: Tom; classe: string; dica: string }> = {
  ok: { rotulo: 'Em dia', tom: 'ok', classe: 'bg-ok-soft text-ok border-ok', dica: 'Habilitação válida' },
  vencendo: { rotulo: 'Vencendo', tom: 'warn', classe: 'bg-warn-soft text-ink-1 border-warn', dica: 'Vence nos próximos 30 dias' },
  vencida: { rotulo: 'Vencida', tom: 'bad', classe: 'bg-bad-soft text-bad border-bad', dica: 'Venceu: apontamento e agenda recusam' },
  sem_habilitacao: { rotulo: 'Sem habilitação', tom: 'bad', classe: 'bg-surface-1 text-bad border-bad border-dashed', dica: 'Alocado sem habilitação: precisa de atenção' },
  nenhum: { rotulo: 'Sem vínculo', tom: 'neutral', classe: 'bg-transparent text-ink-3 border-border', dica: 'Não alocado e sem habilitação' }
};

/** Estado da célula colaborador × centro e se pede atenção (alocado com habilitação vencida ou inexistente). */
export function estadoCelula(c: Pick<CelulaMatriz, 'alocacao' | 'habilitacao'> | null | undefined): { estado: EstadoCelula; alocado: boolean; atencao: boolean } {
  const alocado = !!c && toNum(c.alocacao) > 0;
  const h = c?.habilitacao ?? null;
  const estado: EstadoCelula = h ? h.situacao : alocado ? 'sem_habilitacao' : 'nenhum';
  return { estado, alocado, atencao: alocado && (estado === 'vencida' || estado === 'sem_habilitacao' || estado === 'vencendo') };
}

const PESO: Record<SituacaoHab, number> = { ok: 0, vencendo: 1, vencida: 2 };

/**
 * A matriz da API mostra a melhor habilitação do par. Se outra do mesmo par (ex.: NR-12) está vencendo
 * ou vencida, a célula deve chamar atenção também: usa a pior situação entre todas as do par.
 */
export function celulaComPior<C extends Pick<CelulaMatriz, 'colaboradorId' | 'centroId' | 'alocacao' | 'habilitacao'>>(
  c: C | null,
  todas: Pick<Habilitacao, 'colaboradorId' | 'centroId' | 'situacao' | 'validade'>[],
  par?: { colaboradorId: string; centroId: string }
): C | null {
  const chave = c ?? par;
  if (!chave) return c;
  const doPar = todas.filter((h) => h.colaboradorId === chave.colaboradorId && h.centroId === chave.centroId);
  const pior = doPar.reduce<(typeof doPar)[number] | null>((a, h) => (!a || PESO[h.situacao] > PESO[a.situacao] ? h : a), null);
  if (!pior || (c?.habilitacao && PESO[c.habilitacao.situacao] >= PESO[pior.situacao])) return c;
  const base = (c ?? { colaboradorId: chave.colaboradorId, centroId: chave.centroId, alocacao: '0', habilitacao: null }) as C;
  return { ...base, habilitacao: { ...(base.habilitacao ?? {}), validade: pior.validade, situacao: pior.situacao } };
}

export const SITUACAO_HAB: Record<SituacaoHab, { rotulo: string; tom: Tom }> = {
  ok: { rotulo: 'Em dia', tom: 'ok' },
  vencendo: { rotulo: 'Vencendo', tom: 'warn' },
  vencida: { rotulo: 'Vencida', tom: 'bad' }
};

export const contarHabilitacoes = (itens: Pick<Habilitacao, 'situacao'>[]) => ({
  vencendo: itens.filter((h) => h.situacao === 'vencendo').length,
  vencidas: itens.filter((h) => h.situacao === 'vencida').length
});

/* ---------- Disponibilidade ---------- */

/** Horas sem casas quando inteiras: "176 h", "140,8 h". */
export const h = (v: string | number) => {
  const n = toNum(v);
  return `${Number.isInteger(Math.round(n * 100) / 100) ? num(n, 0) : num(n, 1)} h`;
};
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** "Anderson fica 5 dias fora: 176 h → 140 h" ou "Anderson trabalha os 22 dias úteis: 176 h". */
export function fraseDisponibilidade(d: { nome: string; jornada: string | number; diasUteis: number; diasAusente: number; horasDisponiveis: string | number }) {
  const nome = primeiroNome(d.nome);
  if (d.diasUteis === 0) return `${nome} não tem dias úteis neste mês.`;
  if (d.diasAusente === 0) return `${nome} trabalha os ${d.diasUteis} dias úteis: ${h(d.jornada)}`;
  if (d.diasAusente >= d.diasUteis) return `${nome} fica o mês todo fora: ${h(d.jornada)} → 0 h`;
  return `${nome} fica ${d.diasAusente} ${d.diasAusente === 1 ? 'dia' : 'dias'} fora: ${h(d.jornada)} → ${h(d.horasDisponiveis)}`;
}

/** "Torno perde 36 h para as ausências: 176 h → 140 h". */
export function fraseCentro(c: { nome: string; cadastro: string | number; reais: string | number }) {
  const dif = toNum(c.reais) - toNum(c.cadastro);
  if (Math.abs(dif) < 0.05) return `${c.nome} bate com o cadastro: ${h(c.cadastro)}`;
  return dif < 0
    ? `${c.nome} tem ${h(-dif)} a menos que o cadastro: ${h(c.cadastro)} → ${h(c.reais)}`
    : `${c.nome} tem ${h(dif)} a mais que o cadastro: ${h(c.cadastro)} → ${h(c.reais)}`;
}

/** Horas disponíveis do mês no navegador (sem feriados do tenant, que só a API conhece). */
export function horasNoMes(p: { competencia: string; jornadaHoras: string; diasSemana?: number[]; ausencias: Pick<Ausencia, 'inicio' | 'fim'>[] }) {
  return disponibilidadeNoMes({ competencia: p.competencia, jornadaHoras: toNum(p.jornadaHoras), diasSemana: p.diasSemana?.length ? p.diasSemana : undefined, ausencias: p.ausencias });
}

/* ---------- Erros na voz do produto ---------- */

const TITULO_ERRO: Record<string, string> = {
  AUSENCIA_SOBREPOSTA: 'Essas datas batem com outra ausência',
  SEM_HABILITACAO: 'Falta habilitação para esse centro',
  HABILITACAO_VENCIDA: 'A habilitação está vencida',
  COLABORADOR_AUSENTE: 'Essa pessoa está ausente nesse dia'
};

/** Título curto + mensagem do servidor para mostrar dentro do formulário. */
export function erroRh(e: unknown): { titulo: string; texto: string; codigo?: string } {
  if (e instanceof ApiError) return { titulo: (e.codigo && TITULO_ERRO[e.codigo]) || 'Não deu para salvar', texto: e.message, codigo: e.codigo };
  return { titulo: 'Não deu para salvar', texto: e instanceof Error ? e.message : 'Algo não saiu como esperado. Tente de novo.' };
}

/* ---------- Produtividade ---------- */

export const tomProdutividade = (v: string | number, eficiencia: string | number = 0.75): Tom => (toNum(v) >= toNum(eficiencia) ? 'ok' : toNum(v) >= toNum(eficiencia) * 0.85 ? 'warn' : 'bad');
