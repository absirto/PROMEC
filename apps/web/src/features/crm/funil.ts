import { toNum } from '../../lib/format';

export type Etapa = 'LEAD' | 'CONTATO' | 'ORCAMENTO_ENVIADO' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';
export type Origem = 'INDICACAO' | 'SITE' | 'WHATSAPP' | 'TELEFONE' | 'VISITA' | 'RECORRENTE' | 'OUTRO';
export type TipoAtividade = 'LIGACAO' | 'VISITA' | 'MENSAGEM' | 'EMAIL' | 'TAREFA';

export const ETAPAS: Etapa[] = ['LEAD', 'CONTATO', 'ORCAMENTO_ENVIADO', 'NEGOCIACAO', 'GANHO', 'PERDIDO'];
export const FINAIS: Etapa[] = ['GANHO', 'PERDIDO'];
export const ROTULO_ETAPA: Record<Etapa, string> = { LEAD: 'Lead', CONTATO: 'Contato', ORCAMENTO_ENVIADO: 'Orçamento enviado', NEGOCIACAO: 'Negociação', GANHO: 'Ganho', PERDIDO: 'Perdido' };
export const ROTULO_ORIGEM: Record<Origem, string> = { INDICACAO: 'Indicação', SITE: 'Site', WHATSAPP: 'WhatsApp', TELEFONE: 'Telefone', VISITA: 'Visita', RECORRENTE: 'Recorrente', OUTRO: 'Outro' };
export const ROTULO_TIPO: Record<TipoAtividade, string> = { LIGACAO: 'Ligação', VISITA: 'Visita', MENSAGEM: 'Mensagem', EMAIL: 'E-mail', TAREFA: 'Tarefa' };

export type Ref = { id: string; nome: string };
export interface ProximaAtividade { data: string; assunto?: string; tipo?: TipoAtividade }
export interface Oportunidade {
  id: string;
  titulo: string;
  cliente?: Ref | null;
  clienteId?: string | null;
  contato?: string | null;
  origem?: Origem;
  etapa: Etapa;
  valorEstimado?: string | number | null;
  responsavel?: Ref | string | null;
  responsavelId?: string | null;
  orcamentoId?: string | null;
  proximaAtividade?: ProximaAtividade | string | null;
  observacao?: string | null;
  atualizadoEm?: string;
}
export type Totais = Record<Etapa, { quantidade: number; valor: number }>;
export interface ListaOportunidades { itens: Oportunidade[]; total: number; funil?: Partial<Record<Etapa, { quantidade: number | string; valor: number | string }>> }

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  assunto: string;
  data: string;
  clienteId?: string | null;
  oportunidadeId?: string | null;
  orcamentoId?: string | null;
  responsavelId?: string;
  observacao?: string | null;
  concluida?: boolean;
  resultado?: string | null;
  cliente?: Ref | null;
  oportunidade?: { id: string; titulo: string } | null;
}

export const comoLista = <T>(d: T[] | { itens?: T[] } | null | undefined): T[] => (Array.isArray(d) ? d : d?.itens ?? []);

export function totaisFunil(itens: Pick<Oportunidade, 'etapa' | 'valorEstimado'>[]): Totais {
  const t = Object.fromEntries(ETAPAS.map((e) => [e, { quantidade: 0, valor: 0 }])) as Totais;
  for (const o of itens) {
    const c = t[o.etapa];
    if (!c) continue;
    c.quantidade += 1;
    c.valor = Math.round((c.valor + toNum(o.valorEstimado)) * 100) / 100;
  }
  return t;
}

/** Totais do servidor quando vierem; senão, calculados dos itens. */
export function funilDe(d: ListaOportunidades | undefined): Totais {
  const calc = totaisFunil(d?.itens ?? []);
  if (!d?.funil) return calc;
  return Object.fromEntries(
    ETAPAS.map((e) => {
      const s = d.funil?.[e];
      return [e, s ? { quantidade: toNum(s.quantidade), valor: toNum(s.valor) } : calc[e]];
    })
  ) as Totais;
}

/** Ganhas ÷ decididas (ganhas + perdidas). Sem decisão, null. */
export function taxaConversao(t: Pick<Totais, 'GANHO' | 'PERDIDO'>): number | null {
  const dec = t.GANHO.quantidade + t.PERDIDO.quantidade;
  return dec ? t.GANHO.quantidade / dec : null;
}

/** Move o item e ajusta o funil sem esperar o servidor. */
export function moverNaLista(d: ListaOportunidades, id: string, etapa: Etapa): ListaOportunidades {
  const o = d.itens.find((x) => x.id === id);
  if (!o || o.etapa === etapa) return d;
  const base = funilDe(d);
  const v = toNum(o.valorEstimado);
  const funil = { ...base, [o.etapa]: { quantidade: base[o.etapa].quantidade - 1, valor: base[o.etapa].valor - v }, [etapa]: { quantidade: base[etapa].quantidade + 1, valor: base[etapa].valor + v } };
  return { ...d, itens: d.itens.map((x) => (x.id === id ? { ...x, etapa } : x)), funil };
}

export const nomeRef = (r: Ref | string | null | undefined) => (r == null ? '' : typeof r === 'string' ? r : r.nome);
export const dataProxima = (p: Oportunidade['proximaAtividade']) => (p == null ? null : typeof p === 'string' ? p : p.data ?? null);

/** "YYYY-MM-DD" no fuso local. */
export const diaLocal = (iso: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type GrupoAgenda = 'atrasadas' | 'hoje' | 'proximos';
export const grupoAgenda = (iso: string, hoje: string): GrupoAgenda => {
  const d = diaLocal(iso);
  return d < hoje ? 'atrasadas' : d === hoje ? 'hoje' : 'proximos';
};

export function agruparAgenda(ativs: Atividade[], hoje: string): Record<GrupoAgenda, Atividade[]> {
  const g: Record<GrupoAgenda, Atividade[]> = { atrasadas: [], hoje: [], proximos: [] };
  [...ativs].sort((a, b) => a.data.localeCompare(b.data)).forEach((a) => g[grupoAgenda(a.data, hoje)].push(a));
  return g;
}

export type TomNps = 'ok' | 'warn' | 'bad';
export const tomNps = (n: number): TomNps => (n >= 50 ? 'ok' : n >= 0 ? 'warn' : 'bad');

/** Fração 0–1; aceita também percentuais (ex.: 42 → 0,42). */
const fracao = (v: unknown) => {
  const n = toNum(v as string);
  return n > 1 ? n / 100 : n;
};

export interface LinhaConversao { rotulo: string; taxa: number; ganhos: number; total: number }
export interface LinhaPerda { motivo: string; quantidade: number; valor: number }
export interface Indicadores { porVendedor: LinhaConversao[]; porSegmento: LinhaConversao[]; perdas: LinhaPerda[]; precoAceito: number | null; cicloDias: number | null; nps: { valor: number; promotores?: number; detratores?: number; respostas?: number } | null }

type Bruto = Record<string, unknown>;
const pega = (o: Bruto | undefined, ...ks: string[]) => ks.map((k) => o?.[k]).find((v) => v !== undefined && v !== null);
const linhas = (v: unknown): Bruto[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.entries(v as Bruto).map(([k, x]) => ({ chave: k, ...(x as Bruto) })) : []);
const opcional = (v: unknown) => (v === undefined || v === null || v === '' ? null : toNum(v as string));

const SEGMENTOS: Record<string, string> = { OFICINA: 'Oficina', USINAGEM: 'Usinagem', CALDEIRARIA: 'Caldeiraria' };

function conversao(v: unknown): LinhaConversao[] {
  return linhas(v).map((l) => {
    const ganhos = toNum(pega(l, 'ganhos', 'ganhas', 'aprovados') as string);
    const total = toNum(pega(l, 'decididos', 'total', 'decididas', 'enviados', 'oportunidades', 'quantidade') as string);
    const t = pega(l, 'taxa', 'conversao', 'taxaConversao');
    const nome = pega(l, 'nome', 'rotulo', 'vendedor', 'segmento', 'chave');
    const rotulo = nome && typeof nome === 'object' ? (nome as Ref).nome : typeof nome === 'string' ? (SEGMENTOS[nome] ?? nome) : nome == null && 'vendedor' in l ? 'Sem vendedor' : String(nome ?? '—');
    return { rotulo, ganhos, total, taxa: t !== undefined ? fracao(t) : total ? ganhos / total : 0 };
  });
}

export function normalizarIndicadores(r: Bruto | null | undefined): Indicadores {
  const n = pega(r ?? {}, 'nps');
  const npsObj = n && typeof n === 'object' ? (n as Bruto) : undefined;
  const npsValor = npsObj ? opcional(pega(npsObj, 'valor', 'nps', 'indice')) : opcional(n);
  const p = pega(r ?? {}, 'precoAceitoSobreOfertado', 'razaoPrecoAceito', 'precoAceitoOfertado', 'mediaPrecoAceito', 'precoAceito');
  const preco = p && typeof p === 'object' ? pega(p as Bruto, 'media', 'valor', 'razao') : p;
  return {
    porVendedor: conversao(pega(r ?? {}, 'porVendedor', 'conversaoPorVendedor', 'vendedores')),
    porSegmento: conversao(pega(r ?? {}, 'porSegmento', 'conversaoPorSegmento', 'segmentos')),
    perdas: linhas(pega(r ?? {}, 'motivosPerda', 'perdas', 'motivos'))
      .map((l) => ({ motivo: String(pega(l, 'motivo', 'chave') ?? 'OUTRO'), quantidade: toNum(pega(l, 'quantidade', 'qtd') as string), valor: toNum(pega(l, 'valor', 'valorTotal') as string) }))
      .sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor),
    precoAceito: opcional(preco) === null ? null : toNum(preco as string) > 2 ? toNum(preco as string) / 100 : toNum(preco as string),
    cicloDias: opcional(pega(r ?? {}, 'cicloMedioDias', 'cicloMedio', 'ciclo')),
    nps: npsValor === null ? null : { valor: npsValor, promotores: opcional(pega(npsObj, 'promotores')) ?? undefined, detratores: opcional(pega(npsObj, 'detratores')) ?? undefined, respostas: opcional(pega(npsObj, 'respostas', 'total')) ?? opcional(pega(r ?? {}, 'npsRespostas')) ?? undefined }
  };
}
