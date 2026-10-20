import { Apontamento, Prisma, TipoApontamento } from '@prisma/client';
import { calcularCustoReal, dec, soma, txt, type EntradaCustoAvulso, type LinhaOrcamento, type ResultadoOrcamento } from '@promec/motor';
import { tt } from '../comum/decimal';
import { regra } from '../comum/erros';

export const incluirOs = {
  cliente: { select: { id: true, nome: true } },
  orcamento: { select: { id: true, numero: true } },
  tabelaCustos: { select: { id: true, competencia: true, versao: true, resultado: true } },
  operacoes: {
    orderBy: { sequencia: 'asc' },
    include: {
      centro: { select: { id: true, nome: true } },
      colaborador: { select: { id: true, nome: true } },
      apontamentos: { orderBy: { inicio: 'asc' }, include: { colaborador: { select: { nome: true } } } }
    }
  },
  custos: { orderBy: { criadoEm: 'asc' } },
  ocorrencias: { where: { fim: null } }
} satisfies Prisma.OrdemServicoInclude;

export type OsCompleta = Prisma.OrdemServicoGetPayload<{ include: typeof incluirOs }>;
type OperacaoCompleta = OsCompleta['operacoes'][number];

export const CATEGORIAS_CUSTO = ['material', 'ferramental', 'terceiros', 'frete'] as const;

export const OBJETO_VAZIO = {
  desenho: null,
  revisao: null,
  material: null,
  placa: null,
  veiculo: null,
  kmEntrada: null,
  kmSaida: null,
  projeto: null
} as Record<string, string | number | null>;

/** Mantém só as chaves conhecidas do objeto da OS. */
export const mesclarObjeto = (atual: unknown, novo?: Record<string, unknown>) => {
  const base = { ...OBJETO_VAZIO, ...((atual as object) ?? {}) };
  for (const k of Object.keys(OBJETO_VAZIO)) if (novo && k in novo) base[k] = (novo[k] as string | number | null) ?? null;
  return base;
};

export const horasEntre = (inicio: Date, fim: Date) => txt(dec(fim.getTime() - inicio.getTime()).div(3_600_000));

export const horasDe = (aps: Pick<Apontamento, 'tipo' | 'horas' | 'fim'>[], tipo: TipoApontamento) =>
  txt(soma(aps.filter((a) => a.tipo === tipo && a.fim && a.horas).map((a) => dec(tt(a.horas!)))));

const quantidades = (aps: Pick<Apontamento, 'quantidadeBoa' | 'refugo'>[]) => ({
  quantidadeBoa: aps.reduce((n, a) => n + a.quantidadeBoa, 0),
  refugo: aps.reduce((n, a) => n + a.refugo, 0)
});

/** Orçado × real × projetado da OS, sempre pelo motor. */
export function custoRealDa(os: Pick<OsCompleta, 'lote' | 'precoFinalLote' | 'impostos' | 'comissao' | 'operacoes' | 'custos'>) {
  return calcularCustoReal({
    lote: os.lote,
    precoFinalLote: tt(os.precoFinalLote),
    impostos: tt(os.impostos),
    comissao: tt(os.comissao),
    operacoes: os.operacoes.map((o) => ({
      id: o.id,
      descricao: o.descricao,
      custoHora: tt(o.custoHora),
      setupOrcadoHoras: tt(o.setupOrcadoHoras),
      cicloOrcadoHorasPorPeca: tt(o.cicloOrcadoHorasPorPeca),
      setupRealHoras: horasDe(o.apontamentos, 'SETUP'),
      producaoRealHoras: horasDe(o.apontamentos, 'PRODUCAO'),
      ...quantidades(o.apontamentos),
      setupConcluido: o.setupConcluido,
      concluida: o.status === 'CONCLUIDA',
      retrabalho: o.retrabalho
    })),
    custos: os.custos.map((c) => ({
      id: c.id,
      descricao: c.descricao,
      categoria: c.categoria as EntradaCustoAvulso['categoria'],
      orcado: tt(c.orcado),
      real: c.real === null ? null : tt(c.real)
    }))
  });
}

/** Lançamento acima do orçado além da tolerância do motor precisa de justificativa. */
export function exigeJustificativa(orcado: string, real: string | null) {
  if (real === null) return false;
  const r = calcularCustoReal({
    lote: 1,
    precoFinalLote: '0',
    impostos: '0',
    comissao: '0',
    operacoes: [],
    custos: [{ id: 'x', descricao: '', categoria: 'material', orcado, real }]
  });
  return r.custos[0].situacao !== 'ok';
}

export const saidaApontamento = (a: Apontamento & { colaborador: { nome: string } }) => ({
  id: a.id,
  operacaoId: a.operacaoId,
  colaboradorId: a.colaboradorId,
  colaboradorNome: a.colaborador.nome,
  tipo: a.tipo,
  inicio: a.inicio,
  fim: a.fim,
  horas: a.horas === null ? null : tt(a.horas),
  quantidadeBoa: a.quantidadeBoa,
  refugo: a.refugo,
  observacao: a.observacao
});

export const saidaOperacao = (o: OperacaoCompleta) => ({
  id: o.id,
  sequencia: o.sequencia,
  descricao: o.descricao,
  centroId: o.centroId,
  centroNome: o.centro.nome,
  colaboradorId: o.colaboradorId,
  colaboradorNome: o.colaborador?.nome ?? null,
  custoHora: tt(o.custoHora),
  setupOrcadoHoras: tt(o.setupOrcadoHoras),
  cicloOrcadoHorasPorPeca: tt(o.cicloOrcadoHorasPorPeca),
  setupRealHoras: horasDe(o.apontamentos, 'SETUP'),
  producaoRealHoras: horasDe(o.apontamentos, 'PRODUCAO'),
  ...quantidades(o.apontamentos),
  setupConcluido: o.setupConcluido,
  status: o.status,
  retrabalho: o.retrabalho,
  orcada: o.orcada,
  justificativa: o.justificativa
});

const CATEGORIA_DA_LINHA: Partial<Record<LinhaOrcamento['tipo'], (typeof CATEGORIAS_CUSTO)[number]>> = {
  material: 'material',
  materialCorte: 'material',
  ferramental: 'ferramental',
  terceiro: 'terceiros',
  frete: 'frete'
};

/** Roteiro e custos orçados copiados das linhas do orçamento (o orçado vem do resultado do motor). */
export function roteiroDoOrcamento(linhas: LinhaOrcamento[], resultado: ResultadoOrcamento) {
  const operacoes: { sequencia: number; descricao: string; centroId: string; custoHora: string; setupOrcadoHoras: string; cicloOrcadoHorasPorPeca: string }[] = [];
  const custos: { descricao: string; categoria: string; orcado: string; itemId: string | null }[] = [];
  linhas.forEach((l, i) => {
    if (l.tipo === 'operacao' || l.tipo === 'maoDeObra') {
      const centroId = (l as { centroId?: string }).centroId;
      if (!centroId) {
        throw regra('LINHA_SEM_CENTRO', `A linha "${l.descricao}" do orçamento não tem centro de trabalho, então não vira operação da OS. Ajuste o orçamento antes de converter.`);
      }
      const base = { sequencia: (operacoes.length + 1) * 10, descricao: l.descricao, centroId, custoHora: String(l.custoHora) };
      if (l.tipo === 'operacao') {
        operacoes.push({ ...base, setupOrcadoHoras: String(l.setupHorasPorLote ?? '0'), cicloOrcadoHorasPorPeca: String(l.cicloHorasPorPeca) });
      } else {
        const horas = txt(dec(l.tempoPadraoHoras).times(dec(l.fatorDificuldade ?? 1)));
        const porPeca = (l.base ?? 'lote') === 'peca';
        operacoes.push({ ...base, setupOrcadoHoras: porPeca ? '0' : horas, cicloOrcadoHorasPorPeca: porPeca ? horas : '0' });
      }
    } else {
      custos.push({ descricao: l.descricao, categoria: CATEGORIA_DA_LINHA[l.tipo]!, orcado: resultado.linhas[i].custoLote, itemId: (l as { itemId?: string }).itemId ?? null });
    }
  });
  return { operacoes, custos };
}
