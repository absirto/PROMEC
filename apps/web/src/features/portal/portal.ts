import { useEffect } from 'react';
import { toNum } from '../../lib/format';

export type Solto = Record<string, any>;

const BASE = '/api/v1/portal';

export class ErroPortal extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
    public detalhes?: Solto
  ) {
    super(message);
  }
}

async function chamar<T>(caminho: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${caminho}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ErroPortal(0, mensagemErro('OFFLINE'), 'OFFLINE');
  }
  const texto = await res.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = (json ?? {}) as { mensagem?: string; codigo?: string; detalhes?: Solto };
    const codigo = e.codigo ?? (res.status === 401 ? 'LINK_INVALIDO' : res.status === 429 ? 'MUITAS_TENTATIVAS' : undefined);
    throw new ErroPortal(res.status, e.mensagem ?? mensagemErro(codigo), codigo, e.detalhes);
  }
  return json as T;
}

const t = encodeURIComponent;
export const portal = {
  orcamento: (token: string) => chamar<Solto>(`/orcamento/${t(token)}`),
  aprovar: (token: string, nome: string) => chamar<Solto>(`/orcamento/${t(token)}/aprovar`, { nome, aceite: true }),
  ajuste: (token: string, nome: string, mensagem: string) => chamar<Solto>(`/orcamento/${t(token)}/ajuste`, { nome, mensagem }),
  os: (token: string) => chamar<Solto>(`/os/${t(token)}`),
  avaliar: (token: string, nota: number, comentario?: string) => chamar<Solto>(`/os/${t(token)}/avaliacao`, { nota, comentario: comentario || undefined })
};

export const repetirConsulta = (n: number, e: unknown) => !(e instanceof ErroPortal && e.status >= 400 && e.status < 500) && n < 2;

const MENSAGENS: Record<string, string> = {
  LINK_INVALIDO: 'Este link não vale mais. Peça um novo ao vendedor que enviou para você, ele manda em um minuto.',
  MUITAS_TENTATIVAS: 'Muitos acessos em pouco tempo. Espere um minuto e tente de novo.',
  ORCAMENTO_VENCIDO: 'A validade deste orçamento terminou. Fale com o vendedor para receber os valores atualizados.',
  JA_APROVADO: 'Este orçamento já foi aprovado. Não precisa fazer mais nada.',
  OFFLINE: 'Não conseguimos conectar. Confira a internet e tente de novo.'
};
export const mensagemErro = (codigo?: string) => (codigo && MENSAGENS[codigo]) || 'Algo deu errado do nosso lado. Tente de novo em instantes ou fale com o vendedor.';

export const nomeDe = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'object' && v ? String((v as Solto).nome ?? '') : '');
export const primeiroNome = (v: unknown) => nomeDe(v).trim().split(/\s+/)[0] ?? '';

export type ChaveGrupo = 'material' | 'maoDeObra' | 'terceiros';
export interface Grupo { chave: ChaveGrupo; rotulo: string; valor: number; pct: number; cor: string }

export const GRUPOS: Record<ChaveGrupo, [string, string]> = {
  material: ['Material e peças', 'var(--pm-chart-material)'],
  maoDeObra: ['Mão de obra e máquina', 'var(--pm-chart-hora)'],
  terceiros: ['Serviços de terceiros e frete', '#0E7C86']
};
const ORDEM: ChaveGrupo[] = ['material', 'maoDeObra', 'terceiros'];

const classificar = (k: string): ChaveGrupo | null => {
  const s = k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/terceir|frete/.test(s)) return 'terceiros';
  if (/mao|maquina|operac|setup|hora|servico/.test(s)) return 'maoDeObra';
  if (/material|peca|insumo/.test(s)) return 'material';
  return null;
};

/** Percentuais inteiros que somam 100 (maiores restos). */
export function percentuais(valores: number[]): number[] {
  const total = valores.reduce((a, v) => a + v, 0);
  if (total <= 0) return valores.map(() => 0);
  const brutos = valores.map((v) => (v / total) * 100);
  const base = brutos.map(Math.floor);
  let falta = 100 - base.reduce((a, v) => a + v, 0);
  brutos
    .map((b, i) => [b - Math.floor(b), i] as const)
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (falta > 0) { base[i]! += 1; falta -= 1; }
    });
  return base;
}

/** Normaliza a composição de venda nos 3 grupos visíveis ao cliente, na ordem fixa, sem grupos zerados. */
export function gruposComposicao(r: Solto | null | undefined): Grupo[] {
  const c = r?.composicao ?? r?.resumo ?? r?.grupos;
  const somas: Record<ChaveGrupo, number> = { material: 0, maoDeObra: 0, terceiros: 0 };
  const pares: [string, unknown][] = Array.isArray(c)
    ? c.map((g: Solto) => [String(g?.chave ?? g?.grupo ?? g?.categoria ?? g?.rotulo ?? ''), g?.valor ?? g?.valorVenda])
    : c && typeof c === 'object'
      ? Object.entries(c).map(([k, v]) => [k, typeof v === 'object' && v ? (v as Solto).valor ?? (v as Solto).valorVenda : v])
      : [];
  for (const [k, v] of pares) {
    const g = classificar(k);
    if (g) somas[g] += toNum(v as number);
  }
  const ativos = ORDEM.filter((k) => somas[k] > 0);
  const pcts = percentuais(ativos.map((k) => somas[k]));
  return ativos.map((k, i) => ({ chave: k, rotulo: GRUPOS[k][0], cor: GRUPOS[k][1], valor: somas[k], pct: pcts[i]! }));
}

export interface PontoCurva { quantidade: number; unitario: number; atual: boolean }

export function curvaLote(r: Solto | null | undefined): PontoCurva[] {
  const c = r?.curvaLote ?? r?.curva;
  const lote = toNum(r?.lote?.quantidade ?? r?.lote);
  const pares: [number, number][] = Array.isArray(c)
    ? c.map((p: Solto) => [toNum(p?.quantidade ?? p?.lote ?? p?.qtd), toNum(p?.precoUnitario ?? p?.unitario ?? p?.valorUnitario ?? p?.preco)])
    : c && typeof c === 'object'
      ? Object.entries(c).map(([k, v]) => [toNum(k), toNum(typeof v === 'object' && v ? (v as Solto).precoUnitario ?? (v as Solto).unitario : (v as number))])
      : [];
  return pares
    .filter(([q, u]) => q > 0 && u > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([q, u]) => ({ quantidade: q, unitario: u, atual: q === lote }));
}

export function diasAte(iso?: string | null, hoje = new Date()): number | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  const alvo = Date.UTC(a, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}

export const linkWhatsapp = (telefone?: string | null, texto?: string) => {
  let n = (telefone ?? '').replace(/\D/g, '');
  if (!n) return null;
  if (n.length <= 11) n = `55${n}`;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};

export type FaixaNps = 'detrator' | 'neutro' | 'promotor';
export const faixaNps = (nota: number): FaixaNps => (nota <= 6 ? 'detrator' : nota <= 8 ? 'neutro' : 'promotor');

export interface Etapa { chave: string; rotulo: string; data: string | null; estado: 'feita' | 'atual' | 'futura' }

const ETAPAS_PADRAO: [string, string][] = [
  ['APROVADO', 'Pedido aprovado'],
  ['MATERIAL', 'Material separado'],
  ['MAQUINA', 'Na máquina'],
  ['INSPECAO', 'Inspeção de qualidade'],
  ['PRONTO', 'Pronto para entrega'],
  ['ENTREGUE', 'Entregue']
];

export function etapasOS(r: Solto | null | undefined): Etapa[] {
  const lista: Solto[] = Array.isArray(r?.etapas) && r!.etapas.length ? r!.etapas : ETAPAS_PADRAO.map(([chave, rotulo]) => ({ chave, rotulo }));
  const feitas = lista.map((e) => !!(e?.concluida ?? e?.feita ?? e?.data ?? e?.concluidaEm));
  const atualIdx = lista.findIndex((e) => e?.atual === true);
  // Na API, "concluida" quer dizer "chegou nesta etapa": a última alcançada é a atual, até a entrega.
  const entregue = !!r?.entregueEm || r?.status === 'ENTREGUE' || r?.entregue === true;
  const doContrato = lista.some((e) => typeof e?.etapa === 'string');
  const ultimaFeita = feitas.lastIndexOf(true);
  const atual = atualIdx >= 0 ? atualIdx : entregue ? -1 : doContrato && ultimaFeita >= 0 ? ultimaFeita : feitas.indexOf(false);
  return lista.map((e, i) => ({
    chave: String(e?.chave ?? e?.etapa ?? i),
    rotulo: String(e?.rotulo ?? e?.nome ?? e?.titulo ?? e?.chave ?? ''),
    data: e?.data ?? e?.concluidaEm ?? null,
    estado: entregue || feitas[i] ? (i === atual ? 'atual' : 'feita') : i === atual ? 'atual' : 'futura'
  }));
}

export function useTemaClaro() {
  useEffect(() => {
    const el = document.documentElement;
    const anterior = el.dataset.theme;
    el.dataset.theme = 'claro';
    return () => {
      if (anterior) el.dataset.theme = anterior;
      else delete el.dataset.theme;
    };
  }, []);
}
