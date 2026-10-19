import { no, type NoExplicacao } from './explicacao.js';
import { dec, fracao, soma, txt, UM, ZERO, type Dec, type Num } from './numero.js';

/** Linhas que crescem com a quantidade de peças ('peca') ou são cobradas uma vez ('lote'). */
export type Base = 'peca' | 'lote';

export type LinhaOrcamento =
  | { tipo: 'material'; descricao: string; base?: Base; quantidade: Num; custoUnitario: Num }
  | { tipo: 'materialCorte'; descricao: string; comprimentoMm: Num; sobraMm?: Num; pesoPorMetroKg: Num; precoKg: Num }
  | { tipo: 'ferramental'; descricao: string; custo: Num }
  | {
      tipo: 'operacao';
      descricao: string;
      centroId?: string;
      /** Custo-hora cheio da versão da Tabela de Custos referenciada. */
      custoHora: Num;
      /** Parte do custo-hora que é rateio do custo fixo; separa "rateio" na composição. */
      rateioHora?: Num;
      cicloHorasPorPeca: Num;
      setupHorasPorLote?: Num;
    }
  | { tipo: 'maoDeObra'; descricao: string; base?: Base; custoHora: Num; rateioHora?: Num; tempoPadraoHoras: Num; fatorDificuldade?: Num }
  | { tipo: 'terceiro'; descricao: string; base?: Base; custo: Num; markup?: Num }
  | { tipo: 'frete'; descricao: string; valor?: Num; km?: Num; valorKm?: Num };

export type MetodoPreco = 'divisor' | 'markup';

export interface EntradaOrcamento {
  lote: number;
  linhas: LinhaOrcamento[];
  impostos: Num;
  comissao: Num;
  margemAlvo: Num;
  margemMinima?: Num;
  desconto?: Num;
  metodo?: MetodoPreco;
  /** Quantidades da curva de lote. Padrão: 1, 10, 50 e 100. */
  curva?: number[];
}

export type CategoriaCusto =
  | 'material'
  | 'ferramental'
  | 'horaMaquina'
  | 'setup'
  | 'maoDeObra'
  | 'rateio'
  | 'terceiros'
  | 'frete'
  | 'impostos'
  | 'comissao'
  | 'margem';

/** Ordem fixa da composição em todo o produto. */
export const ORDEM_COMPOSICAO: CategoriaCusto[] = [
  'material',
  'ferramental',
  'horaMaquina',
  'setup',
  'maoDeObra',
  'rateio',
  'terceiros',
  'frete',
  'impostos',
  'comissao',
  'margem'
];

export type SituacaoMargem = 'ok' | 'atencao' | 'perigo';

export interface ResultadoLinha {
  indice: number;
  tipo: LinhaOrcamento['tipo'];
  descricao: string;
  custoLote: string;
  partes: Partial<Record<CategoriaCusto, string>>;
}

export interface PontoCurva {
  quantidade: number;
  custoUnitario: string;
  precoUnitario: string;
}

export interface ResultadoOrcamento {
  lote: number;
  linhas: ResultadoLinha[];
  custoLote: string;
  custoUnitario: string;
  /** Custos que variam com o volume (material, ciclo, terceiros por peça, comissão, impostos). */
  custosVariaveisLote: string;
  precoUnitario: string;
  precoLote: string;
  precoFinalUnitario: string;
  precoFinalLote: string;
  margemAlvo: string;
  margemEfetiva: string;
  margemContribuicao: string;
  situacaoMargem: SituacaoMargem;
  exigeAprovacao: boolean;
  composicao: { categoria: CategoriaCusto; valor: string }[];
  curvaLote: PontoCurva[];
  explicacao: NoExplicacao;
}

interface Partes {
  /** Custo que se repete a cada peça. */
  porPeca: Partial<Record<CategoriaCusto, Dec>>;
  /** Custo cobrado uma vez por lote. */
  porLote: Partial<Record<CategoriaCusto, Dec>>;
}

const add = (alvo: Partial<Record<CategoriaCusto, Dec>>, cat: CategoriaCusto, v: Dec) => {
  if (!v.isZero()) alvo[cat] = (alvo[cat] ?? ZERO).plus(v);
};

/** Separa o custo-hora entre a parte direta e o rateio do custo fixo. */
function horas(p: Partial<Record<CategoriaCusto, Dec>>, cat: CategoriaCusto, h: Dec, custoHora: Num, rateioHora?: Num) {
  const ch = dec(custoHora);
  const rat = dec(rateioHora);
  add(p, cat, h.times(ch.minus(rat)));
  add(p, 'rateio', h.times(rat));
}

function partesDaLinha(l: LinhaOrcamento): Partes {
  const porPeca: Partes['porPeca'] = {};
  const porLote: Partes['porLote'] = {};
  switch (l.tipo) {
    case 'material':
      add((l.base ?? 'peca') === 'peca' ? porPeca : porLote, 'material', dec(l.quantidade).times(dec(l.custoUnitario)));
      break;
    case 'materialCorte': {
      const metros = dec(l.comprimentoMm).plus(dec(l.sobraMm)).div(1000);
      add(porPeca, 'material', metros.times(dec(l.pesoPorMetroKg)).times(dec(l.precoKg)));
      break;
    }
    case 'ferramental':
      add(porLote, 'ferramental', dec(l.custo));
      break;
    case 'operacao':
      horas(porPeca, 'horaMaquina', dec(l.cicloHorasPorPeca), l.custoHora, l.rateioHora);
      horas(porLote, 'setup', dec(l.setupHorasPorLote), l.custoHora, l.rateioHora);
      break;
    case 'maoDeObra': {
      const h = dec(l.tempoPadraoHoras).times(l.fatorDificuldade === undefined ? UM : dec(l.fatorDificuldade));
      horas((l.base ?? 'lote') === 'peca' ? porPeca : porLote, 'maoDeObra', h, l.custoHora, l.rateioHora);
      break;
    }
    case 'terceiro':
      add((l.base ?? 'lote') === 'peca' ? porPeca : porLote, 'terceiros', dec(l.custo).times(UM.plus(dec(l.markup))));
      break;
    case 'frete':
      add(porLote, 'frete', l.valor !== undefined ? dec(l.valor) : dec(l.km).times(dec(l.valorKm)));
      break;
  }
  return { porPeca, porLote };
}

const custoPara = (partes: Partes[], q: number) => {
  const porCategoria: Partial<Record<CategoriaCusto, Dec>> = {};
  for (const p of partes) {
    for (const [cat, v] of Object.entries(p.porPeca)) add(porCategoria, cat as CategoriaCusto, v.times(q));
    for (const [cat, v] of Object.entries(p.porLote)) add(porCategoria, cat as CategoriaCusto, v);
  }
  return { porCategoria, total: soma(Object.values(porCategoria)) };
};

export function calcularOrcamento(e: EntradaOrcamento): ResultadoOrcamento {
  if (!Number.isInteger(e.lote) || e.lote < 1) throw new RangeError('O lote precisa ser de pelo menos 1 peça.');
  const i = fracao(e.impostos, 'Impostos');
  const c = fracao(e.comissao, 'Comissão');
  const m = fracao(e.margemAlvo, 'Margem alvo');
  const d = fracao(e.desconto, 'Desconto');
  const mMin = e.margemMinima === undefined ? undefined : fracao(e.margemMinima, 'Margem mínima');
  const metodo = e.metodo ?? 'divisor';

  const porDentro = metodo === 'divisor' ? i.plus(c).plus(m) : i.plus(c);
  if (porDentro.gte(1)) {
    throw new RangeError('Impostos, comissão e margem somam 100% ou mais; assim o preço não fecha. Reduza algum deles.');
  }
  const divisor = UM.minus(porDentro);
  const fatorMarkup = metodo === 'markup' ? UM.plus(m) : UM;
  const precoDe = (custo: Dec) => custo.times(fatorMarkup).div(divisor);

  const partes = e.linhas.map(partesDaLinha);
  const { porCategoria, total: custoLote } = custoPara(partes, e.lote);
  const custoUnitario = custoLote.div(e.lote);

  const precoUnitario = precoDe(custoUnitario);
  const precoLote = precoUnitario.times(e.lote);
  const precoFinalUnitario = precoUnitario.times(UM.minus(d));
  const precoFinalLote = precoFinalUnitario.times(e.lote);

  const margemEfetiva = precoFinalUnitario.isZero()
    ? ZERO
    : UM.minus(i).minus(c).minus(custoUnitario.div(precoFinalUnitario));

  const impostos = precoFinalLote.times(i);
  const comissao = precoFinalLote.times(c);
  const margemValor = precoFinalLote.minus(custoLote).minus(impostos).minus(comissao);

  const variaveis = soma(partes.flatMap((p) => Object.values(p.porPeca)).map((v) => v.times(e.lote)))
    .plus(impostos)
    .plus(comissao);

  const minimo = mMin ?? ZERO;
  const situacaoMargem: SituacaoMargem = margemEfetiva.gte(m.minus('0.0000001'))
    ? 'ok'
    : margemEfetiva.gte(minimo)
      ? 'atencao'
      : 'perigo';

  const valores: Partial<Record<CategoriaCusto, Dec>> = { ...porCategoria, impostos, comissao, margem: margemValor };
  const composicao = ORDEM_COMPOSICAO.filter((cat) => valores[cat] && !valores[cat]!.isZero()).map((categoria) => ({
    categoria,
    valor: txt(valores[categoria]!)
  }));

  const curvaLote = (e.curva ?? [1, 10, 50, 100]).map((q) => {
    const cu = custoPara(partes, q).total.div(q);
    return { quantidade: q, custoUnitario: txt(cu), precoUnitario: txt(precoDe(cu)) };
  });

  const linhas = e.linhas.map((l, indice): ResultadoLinha => {
    const p = partes[indice];
    const { porCategoria: pc, total } = custoPara([p], e.lote);
    return {
      indice,
      tipo: l.tipo,
      descricao: l.descricao,
      custoLote: txt(total),
      partes: Object.fromEntries(Object.entries(pc).map(([k, v]) => [k, txt(v)]))
    };
  });

  const explicacao = no('Preço do lote', precoFinalLote, {
    unidade: 'R$',
    formula:
      metodo === 'divisor'
        ? 'custo ÷ (1 − impostos − comissão − margem) × (1 − desconto)'
        : 'custo × (1 + margem) ÷ (1 − impostos − comissão) × (1 − desconto)',
    filhos: [
      no('Custo do lote', custoLote, {
        unidade: 'R$',
        filhos: linhas.map((l) => no(l.descricao, dec(l.custoLote), { unidade: 'R$' }))
      }),
      no('Impostos', impostos, { unidade: 'R$', formula: `${i.times(100).toFixed()}% sobre o preço` }),
      ...(c.isZero() ? [] : [no('Comissão', comissao, { unidade: 'R$', formula: `${c.times(100).toFixed()}% sobre o preço` })]),
      no('Margem', margemValor, { unidade: 'R$', formula: `efetiva de ${margemEfetiva.times(100).toDecimalPlaces(1).toFixed()}%` }),
      ...(d.isZero() ? [] : [no('Desconto concedido', precoLote.minus(precoFinalLote), { unidade: 'R$' })])
    ]
  });

  return {
    lote: e.lote,
    linhas,
    custoLote: txt(custoLote),
    custoUnitario: txt(custoUnitario),
    custosVariaveisLote: txt(variaveis),
    precoUnitario: txt(precoUnitario),
    precoLote: txt(precoLote),
    precoFinalUnitario: txt(precoFinalUnitario),
    precoFinalLote: txt(precoFinalLote),
    margemAlvo: txt(m),
    margemEfetiva: txt(margemEfetiva),
    margemContribuicao: txt(precoFinalLote.minus(variaveis)),
    situacaoMargem,
    exigeAprovacao: mMin !== undefined && margemEfetiva.lt(mMin),
    composicao,
    curvaLote,
    explicacao
  };
}

/** Preço de venda de uma hora de centro de trabalho (simulador rápido da planilha). */
export function precoDaHora(custoHora: Num, p: { impostos: Num; comissao?: Num; margem: Num }): string {
  const divisor = UM.minus(fracao(p.impostos, 'Impostos')).minus(fracao(p.comissao, 'Comissão')).minus(fracao(p.margem, 'Margem'));
  if (divisor.lte(0)) throw new RangeError('Impostos, comissão e margem somam 100% ou mais.');
  return txt(dec(custoHora).div(divisor));
}
