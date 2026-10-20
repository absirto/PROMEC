import type { Tom } from '../../components/Pill';

/* ---------- Tipos da API (fase 1h) ---------- */

export type SituacaoPlano = 'ok' | 'proxima' | 'vencida';
export type TipoPlano = 'HORAS' | 'CALENDARIO';
export interface SituacaoPreventiva { situacao: SituacaoPlano; falta: string; proximaData: string | null; progresso: string }
export interface Plano {
  id: string; centroId: string; centroNome: string | null; nome: string; tipo: TipoPlano;
  intervaloHoras: string | null; intervaloDias: number | null; duracaoHoras: string; checklist: string[];
  ultimaExecucao: string | null; horasDesdeUltima: string; ativo: boolean; situacao: SituacaoPreventiva;
  ordemAberta: { id: string; numero: string } | null;
}

export type StatusOrdem = 'ABERTA' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA';
export type TipoOrdem = 'PREVENTIVA' | 'CORRETIVA';
export type TipoCusto = 'PECA' | 'MAO_DE_OBRA' | 'TERCEIRO';
export interface CustoOrdem {
  id: string; tipo: TipoCusto; descricao: string | null; itemId: string | null; quantidade: string | null;
  colaboradorId: string | null; horas: string | null; fornecedorId: string | null; valor: string; tituloId: string | null; data: string | null;
}
export interface ItemChecklist { item: string; ok: boolean }
export interface Ordem {
  id: string; numero: string; centroId: string; centroNome: string | null; tipo: TipoOrdem; origem: 'PLANO' | 'MANUAL' | 'QUEBRA' | string;
  planoId: string | null; execucao: 'INTERNA' | 'EXTERNA' | string; fornecedorId: string | null; fornecedorNome: string | null;
  descricao: string; prevista: string | null; inicio: string | null; fim: string | null; status: StatusOrdem; bloqueiaAgenda: boolean;
  paradaId: string | null; custos: CustoOrdem[]; custoTotal: string; horasParado: string | null; checklist: unknown;
  observacao: string | null; motivoCancelamento: string | null; osAfetadas: { id: string; numero: string }[] | null; criadoEm?: string;
}

export interface IndicadoresCentro {
  centro: { id: string; codigo: string | null; nome: string; tipo: string };
  indicadores: { quebras: number; mtbf: string | null; mttr: string | null; disponibilidade: string; horasParado: string; custoPorHoraProduzida: string | null };
  custoPorMes: { competencia: string; valor: string }[];
  media6: string; media12: string; cadastro: string; diferenca: string; mediaCategoria: string;
  alerta: { mensagem: string; substituicao: Substituicao } | null;
}
export interface Substituicao { atualMes: string; novoMes: string; economiaMes: string; vale: boolean }
export interface Indicadores { meses: number; competencias: string[]; centros: IndicadoresCentro[] }

export interface LinhaProposta {
  centroId: string; nome: string; manutencaoCadastro: string; manutencaoProposta: string; diferencaManutencao: string;
  horasExpedienteCadastro: string; horasDisponiveisReais: string; diferencaHoras: string;
}
export interface Proposta { competencia: string; centros: LinhaProposta[] }
export interface RespostaAceite { centros: LinhaProposta[]; tabelaDesatualizada: boolean }

/* ---------- Rótulos ---------- */

export const STATUS_ORDEM: Record<StatusOrdem, [string, Tom]> = {
  ABERTA: ['Aberta', 'info'],
  EM_EXECUCAO: ['Em execução', 'run'],
  CONCLUIDA: ['Concluída', 'ok'],
  CANCELADA: ['Cancelada', 'neutral']
};
export const rotuloStatusOrdem = (s: string) => STATUS_ORDEM[s as StatusOrdem]?.[0] ?? s;
export const tomStatusOrdem = (s: string): Tom => STATUS_ORDEM[s as StatusOrdem]?.[1] ?? 'neutral';
export const TIPO_ORDEM: Record<TipoOrdem, string> = { PREVENTIVA: 'Preventiva', CORRETIVA: 'Corretiva' };
export const ORIGEM_ORDEM: Record<string, string> = { PLANO: 'do plano', MANUAL: 'manual', QUEBRA: 'quebra' };
export const TIPO_CUSTO: Record<TipoCusto, string> = { PECA: 'Peça do estoque', MAO_DE_OBRA: 'Mão de obra', TERCEIRO: 'Serviço de terceiro' };
export const TIPO_PLANO: Record<TipoPlano, string> = { HORAS: 'Por horas de uso', CALENDARIO: 'Por calendário' };
export const SITUACAO: Record<SituacaoPlano, [string, Tom]> = { ok: ['Em dia', 'ok'], proxima: ['Próxima', 'warn'], vencida: ['Vencida', 'bad'] };
export const ABERTAS: StatusOrdem[] = ['ABERTA', 'EM_EXECUCAO'];
export const estaAberta = (o: Pick<Ordem, 'status'>) => ABERTAS.includes(o.status);

/* ---------- Números ---------- */

const n1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const toN = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** 147.5 → "147,5"; 150 → "150". */
export const numCurto = (v: unknown) => n1.format(toN(v)).replace(/ /g, ' ');
export const clamp01 = (v: unknown) => Math.min(1, Math.max(0, toN(v)));

/* ---------- Anel da preventiva ---------- */

export interface Anel { fracao: number; tom: Tom; cor: string; texto: string; rotulo: string }

const COR: Record<SituacaoPlano, string> = { ok: 'var(--pm-ok)', proxima: 'var(--pm-signal)', vencida: 'var(--pm-bad)' };

/** Texto curto da situação: "faltam 147,5 h", "vence em 12 dias", "vencida há 3 dias". */
export function textoSituacao(tipo: TipoPlano, s: Pick<SituacaoPreventiva, 'situacao' | 'falta'>): string {
  const falta = toN(s.falta);
  if (tipo === 'HORAS') {
    if (falta > 0) return `falta${falta === 1 ? '' : 'm'} ${numCurto(falta)} h`;
    if (falta === 0) return 'chegou ao intervalo';
    return `vencida há ${numCurto(-falta)} h`;
  }
  const dias = Math.round(falta);
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === 1) return 'vence amanhã';
  if (dias === 0) return 'vence hoje';
  return `vencida há ${-dias} dia${dias === -1 ? '' : 's'}`;
}

export function anelPreventiva(tipo: TipoPlano, s: SituacaoPreventiva): Anel {
  const situacao: SituacaoPlano = SITUACAO[s.situacao] ? s.situacao : 'ok';
  const fracao = situacao === 'vencida' ? 1 : clamp01(s.progresso);
  const texto = textoSituacao(tipo, s);
  return { fracao, tom: SITUACAO[situacao][1], cor: COR[situacao], texto, rotulo: `${SITUACAO[situacao][0]}: ${texto}` };
}

/* ---------- Listas e formulários ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lista = <T,>(x: unknown): T[] => (Array.isArray(x) ? x : Array.isArray((x as any)?.itens) ? (x as { itens: T[] }).itens : []);

/** Move o item `i` uma posição (delta -1 ou 1); fora dos limites devolve a mesma lista. */
export function moverItem<T>(l: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (i < 0 || i >= l.length || j < 0 || j >= l.length) return l;
  const n = [...l];
  [n[i], n[j]] = [n[j]!, n[i]!];
  return n;
}

/** Checklist para concluir: o que a ordem já guardou ou os itens do plano, todos desmarcados. */
export function checklistInicial(salvo: unknown, doPlano: string[] = []): ItemChecklist[] {
  if (Array.isArray(salvo) && salvo.length) {
    return salvo
      .map((x) => (typeof x === 'string' ? { item: x, ok: false } : x && typeof x === 'object' && 'item' in x ? { item: String((x as ItemChecklist).item), ok: !!(x as ItemChecklist).ok } : null))
      .filter((x): x is ItemChecklist => !!x && !!x.item.trim());
  }
  return doPlano.filter((x) => x.trim()).map((item) => ({ item, ok: false }));
}

/** Itens do checklist limpos: sem vazios e sem repetidos. */
export const limparChecklist = (l: string[]) => [...new Set(l.map((x) => x.trim()).filter(Boolean))];

/** OS que a quebra deve pausar: apontamento aberto no centro ou OS em execução com o centro atual. */
export function osPrevistasNaQuebra(
  centro: { id: string; nome: string },
  apontamentos: { centroId?: string; os?: { id: string; numero: string; titulo?: string; status?: string } | null }[],
  emExecucao: { id: string; numero: string; titulo?: string; status?: string; centroAtual?: string | null }[]
): { id: string; numero: string; titulo?: string }[] {
  const m = new Map<string, { id: string; numero: string; titulo?: string }>();
  for (const a of apontamentos) if (a.centroId === centro.id && a.os && (!a.os.status || a.os.status === 'EM_EXECUCAO')) m.set(a.os.id, { id: a.os.id, numero: a.os.numero, titulo: a.os.titulo });
  for (const o of emExecucao) if (o.status === 'EM_EXECUCAO' && o.centroAtual === centro.nome && !m.has(o.id)) m.set(o.id, { id: o.id, numero: o.numero, titulo: o.titulo });
  return [...m.values()].sort((a, b) => a.numero.localeCompare(b.numero));
}

/** Mensagem na voz do produto para os conflitos de manutenção. */
export function mensagemConflito(codigo: string | undefined, mensagem: string): string {
  if (codigo === 'ORDEM_COM_CUSTOS') return 'Esta ordem já tem peça baixada do estoque ou serviço de terceiro lançado. Remova esses custos primeiro (a peça volta ao estoque e o título é cancelado) e depois cancele.';
  if (codigo === 'TITULO_COM_BAIXA') return 'O título desse serviço já foi pago. Estorne a baixa em Contas a pagar antes de tirar o custo da ordem.';
  return mensagem;
}

/** Centros parados hoje: quebra em execução ou preventiva que bloqueia a agenda no dia. */
export function centrosParados(ordens: Ordem[], hoje: string): number {
  const ids = new Set<string>();
  for (const o of ordens) {
    if (!estaAberta(o) || !o.paradaId) continue;
    if ((o.tipo === 'CORRETIVA' && o.status === 'EM_EXECUCAO') || (o.bloqueiaAgenda && o.prevista?.slice(0, 10) === hoje)) ids.add(o.centroId);
  }
  return ids.size;
}

/** Teto "redondo" do eixo: 1, 2, 2,5 ou 5 × 10ⁿ acima do maior valor. */
export function tetoEixo(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= max) ?? 10 * p);
}

/** Depreciação mensal linear. */
export const depreciacaoMes = (valor: unknown, residual: unknown, vidaMeses: unknown) => (toN(vidaMeses) > 0 ? Math.max(0, toN(valor) - toN(residual)) / toN(vidaMeses) : 0);

export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const agoraLocal = (d = new Date()) => `${hojeISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
