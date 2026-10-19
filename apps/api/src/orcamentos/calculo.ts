import { calcularOrcamento, type LinhaOrcamento, type MetodoPreco, type ResultadoOrcamento, type ResultadoTabela } from '@promec/motor';
import { pd } from '../comum/decimal';
import { json } from '../tabelas-custos/entrada';
import { invalido, regra } from '../comum/erros';

export const TIPOS_LINHA = ['material', 'materialCorte', 'ferramental', 'operacao', 'maoDeObra', 'terceiro', 'frete'] as const;
type TipoLinha = (typeof TIPOS_LINHA)[number];

const CAMPOS: Record<TipoLinha, { obrigatorios: string[]; opcionais: string[] }> = {
  material: { obrigatorios: ['quantidade', 'custoUnitario'], opcionais: ['base'] },
  materialCorte: { obrigatorios: ['comprimentoMm', 'pesoPorMetroKg', 'precoKg'], opcionais: ['sobraMm'] },
  ferramental: { obrigatorios: ['custo'], opcionais: [] },
  operacao: { obrigatorios: ['cicloHorasPorPeca'], opcionais: ['centroId', 'custoHora', 'rateioHora', 'setupHorasPorLote'] },
  maoDeObra: { obrigatorios: ['tempoPadraoHoras'], opcionais: ['base', 'centroId', 'custoHora', 'rateioHora', 'fatorDificuldade'] },
  terceiro: { obrigatorios: ['custo'], opcionais: ['base', 'markup'] },
  frete: { obrigatorios: [], opcionais: ['valor', 'km', 'valorKm'] }
};

const TEXTO = new Set(['base', 'centroId']);

export type LinhaEntrada = { tipo: string; descricao?: string; [campo: string]: unknown };

/** Mantém só os campos do tipo de cada linha, com números como texto decimal. */
export function normalizarLinhas(linhas: LinhaEntrada[]): LinhaEntrada[] {
  const faltas: { campo: string; mensagem: string }[] = [];
  const limpas = linhas.map((l, i) => {
    const regras = CAMPOS[l.tipo as TipoLinha];
    const saida: LinhaEntrada = { tipo: l.tipo, descricao: (l.descricao ?? '').trim() };
    for (const campo of [...regras.obrigatorios, ...regras.opcionais]) {
      const v = l[campo];
      if (v === undefined || v === null || v === '') {
        if (regras.obrigatorios.includes(campo)) faltas.push({ campo: `linhas.${i}.${campo}`, mensagem: `linha ${i + 1}: ${campo} é obrigatório` });
        continue;
      }
      saida[campo] = TEXTO.has(campo) ? v : String(v);
    }
    if (l.tipo === 'frete' && saida.valor === undefined && (saida.km === undefined || saida.valorKm === undefined)) {
      faltas.push({ campo: `linhas.${i}.valor`, mensagem: `linha ${i + 1}: informe o valor do frete ou km e valorKm` });
    }
    return saida;
  });
  if (faltas.length) {
    throw invalido(`Algumas linhas estão incompletas: ${faltas.slice(0, 3).map((f) => f.mensagem).join('; ')}. Complete e calcule de novo.`, faltas);
  }
  return limpas;
}

/** Completa custo-hora e rateio das linhas de operação e mão de obra a partir da Tabela de Custos referenciada. */
export function resolverLinhas(linhas: LinhaEntrada[], tabela: ResultadoTabela): LinhaOrcamento[] {
  return linhas.map((l, i) => {
    if (l.tipo !== 'operacao' && l.tipo !== 'maoDeObra') return l as unknown as LinhaOrcamento;
    const nome = l.descricao || `linha ${i + 1}`;
    if (!l.centroId) {
      if (l.custoHora === undefined) {
        throw regra('LINHA_SEM_CENTRO', `A linha "${nome}" precisa de um centro de trabalho para buscarmos o custo-hora. Escolha o centro e calcule de novo.`);
      }
      return l as unknown as LinhaOrcamento;
    }
    const c = tabela.centros.find((c) => c.id === l.centroId);
    if (!c) {
      throw regra(
        'CENTRO_FORA_DA_TABELA',
        `O centro da linha "${nome}" não está na Tabela de Custos usada por este orçamento. Escolha outro centro ou atualize os custos para a tabela vigente.`,
        { linha: i, centroId: l.centroId }
      );
    }
    return { ...l, custoHora: c.cheioHora, rateioHora: c.rateioHora } as unknown as LinhaOrcamento;
  });
}

export interface Precificacao {
  lote: number;
  impostos: string;
  comissao: string;
  margemAlvo: string;
  margemMinima: string;
  desconto: string;
  metodo: MetodoPreco;
}

export function calcular(linhas: LinhaEntrada[], tabela: ResultadoTabela, p: Precificacao) {
  const resolvidas = resolverLinhas(normalizarLinhas(linhas), tabela);
  return { linhas: resolvidas, resultado: calcularOrcamento({ ...p, linhas: resolvidas }) };
}

/** Colunas derivadas do resultado do motor, gravadas para listas e painel. */
export const colunasDoResultado = (r: ResultadoOrcamento) => ({
  resultado: json(r),
  precoFinalLote: pd(r.precoFinalLote),
  margemEfetiva: pd(r.margemEfetiva),
  situacaoMargem: r.situacaoMargem,
  exigeAprovacao: r.exigeAprovacao
});

export const colunasDePrecificacao = (p: Precificacao) => ({
  lote: p.lote,
  impostos: pd(p.impostos),
  comissao: pd(p.comissao),
  margemAlvo: pd(p.margemAlvo),
  margemMinima: pd(p.margemMinima),
  desconto: pd(p.desconto),
  metodo: p.metodo
});
