import { no, type NoExplicacao } from './explicacao.js';
import { dec, fracao, soma, txt, UM, ZERO, type Dec, type Num } from './numero.js';

export type SituacaoDesvio = 'ok' | 'atencao' | 'perigo';

export interface EntradaOperacaoReal {
  id: string;
  descricao: string;
  custoHora: Num;
  setupOrcadoHoras: Num;
  cicloOrcadoHorasPorPeca: Num;
  setupRealHoras: Num;
  producaoRealHoras: Num;
  quantidadeBoa: number;
  refugo?: number;
  setupConcluido?: boolean;
  concluida?: boolean;
  /** Retrabalho não estava no orçado: entra no real e é custo da não-qualidade. */
  retrabalho?: boolean;
}

export interface EntradaCustoAvulso {
  id: string;
  descricao: string;
  categoria: 'material' | 'ferramental' | 'terceiros' | 'frete';
  orcado: Num;
  /** null enquanto não houve consumo; a projeção usa o orçado. */
  real: Num | null;
}

export interface EntradaCustoReal {
  lote: number;
  precoFinalLote: Num;
  impostos: Num;
  comissao: Num;
  /** Tolerância de desvio (padrão 20%). Até 2× é atenção; acima, perigo. */
  tolerancia?: Num;
  operacoes: EntradaOperacaoReal[];
  custos: EntradaCustoAvulso[];
}

export interface ResultadoOperacaoReal {
  id: string;
  descricao: string;
  horasOrcadas: string;
  horasReais: string;
  horasProjetadas: string;
  custoOrcado: string;
  custoReal: string;
  custoProjetado: string;
  /** (projetado − orçado) ÷ orçado, sobre horas. */
  desvio: string;
  situacao: SituacaoDesvio;
  estouro: boolean;
  progresso: string;
}

export interface ResultadoCustoAvulso {
  id: string;
  descricao: string;
  categoria: EntradaCustoAvulso['categoria'];
  orcado: string;
  real: string;
  projetado: string;
  desvio: string;
  situacao: SituacaoDesvio;
}

export interface ResultadoCustoReal {
  operacoes: ResultadoOperacaoReal[];
  custos: ResultadoCustoAvulso[];
  horasOrcadas: string;
  horasReais: string;
  horasProjetadas: string;
  custoOrcado: string;
  custoReal: string;
  custoProjetado: string;
  custoNaoQualidade: string;
  desvioCusto: string;
  situacao: SituacaoDesvio;
  margemOrcada: string;
  margemProjetada: string;
  progresso: string;
  explicacao: NoExplicacao;
}

const maior = (a: Dec, b: Dec): Dec => (a.gte(b) ? a : b);
const menor = (a: Dec, b: Dec): Dec => (a.lte(b) ? a : b);

const desvioDe = (orcado: Dec, projetado: Dec): Dec =>
  orcado.isZero() ? (projetado.isZero() ? ZERO : UM) : projetado.minus(orcado).div(orcado);

const situacaoDe = (desvio: Dec, tol: Dec): SituacaoDesvio =>
  desvio.lte(tol) ? 'ok' : desvio.lte(tol.times(2)) ? 'atencao' : 'perigo';

/**
 * Custo real e projetado de uma OS contra o orçado, com o custo-hora da versão do orçamento.
 * Projeção: operação concluída usa o real; em andamento, o setup vale o maior entre real e orçado
 * (ou o real, se encerrado) e a produção extrapola o tempo por peça boa para o lote inteiro.
 */
export function calcularCustoReal(e: EntradaCustoReal): ResultadoCustoReal {
  if (!Number.isInteger(e.lote) || e.lote < 1) throw new RangeError('O lote precisa ser de pelo menos 1 peça.');
  const tol = fracao(e.tolerancia ?? '0.2', 'Tolerância');
  const i = fracao(e.impostos, 'Impostos');
  const c = fracao(e.comissao, 'Comissão');
  const preco = dec(e.precoFinalLote);
  const lote = dec(e.lote);

  const operacoes = e.operacoes.map((o) => {
    const ch = dec(o.custoHora);
    const setupOrc = o.retrabalho ? ZERO : dec(o.setupOrcadoHoras);
    const prodOrc = o.retrabalho ? ZERO : dec(o.cicloOrcadoHorasPorPeca).times(lote);
    const orcadas = setupOrc.plus(prodOrc);
    const setupReal = dec(o.setupRealHoras);
    const prodReal = dec(o.producaoRealHoras);
    const reais = setupReal.plus(prodReal);

    let projetadas: Dec;
    if (o.concluida || o.retrabalho) {
      projetadas = reais;
    } else {
      const setupProj = o.setupConcluido ? setupReal : maior(setupReal, setupOrc);
      const prodProj =
        o.quantidadeBoa > 0
          ? maior(prodReal, prodReal.div(o.quantidadeBoa).times(lote))
          : maior(prodReal, prodOrc);
      projetadas = setupProj.plus(prodProj);
    }
    const desvio = desvioDe(orcadas, projetadas);
    const progresso = o.concluida ? UM : menor(UM, dec(o.quantidadeBoa).div(lote));
    return {
      o,
      orcadas,
      reais,
      projetadas,
      custoOrcado: orcadas.times(ch),
      custoReal: reais.times(ch),
      custoProjetado: projetadas.times(ch),
      desvio,
      progresso
    };
  });

  const custos = e.custos.map((x) => {
    const orcado = dec(x.orcado);
    const real = x.real === null ? ZERO : dec(x.real);
    const projetado = x.real === null ? orcado : real;
    return { x, orcado, real, projetado, desvio: desvioDe(orcado, projetado) };
  });

  const custoOrcado = soma([...operacoes.map((o) => o.custoOrcado), ...custos.map((x) => x.orcado)]);
  const custoReal = soma([...operacoes.map((o) => o.custoReal), ...custos.map((x) => x.real)]);
  const custoProjetado = soma([...operacoes.map((o) => o.custoProjetado), ...custos.map((x) => x.projetado)]);
  const naoQualidade = soma(operacoes.filter((o) => o.o.retrabalho).map((o) => o.custoReal));
  const margem = (custo: Dec) => (preco.isZero() ? ZERO : UM.minus(i).minus(c).minus(custo.div(preco)));
  const desvioCusto = desvioDe(custoOrcado, custoProjetado);

  const horasOrc = soma(operacoes.map((o) => o.orcadas));
  const progresso = horasOrc.isZero()
    ? ZERO
    : soma(operacoes.map((o) => o.orcadas.times(o.progresso))).div(horasOrc);

  const explicacao = no('Custo projetado da OS', custoProjetado, {
    unidade: 'R$',
    formula: 'horas projetadas × custo-hora da versão + materiais e terceiros (real ou orçado)',
    filhos: [
      ...operacoes.map((o) =>
        no(o.o.descricao, o.custoProjetado, {
          unidade: 'R$',
          formula: `${o.projetadas.toDecimalPlaces(2).toFixed()} h × custo-hora`,
          filhos: [no('Horas orçadas', o.orcadas, { unidade: 'h' }), no('Horas apontadas', o.reais, { unidade: 'h' })]
        })
      ),
      ...custos.map((x) => no(x.x.descricao, x.projetado, { unidade: 'R$' }))
    ]
  });

  return {
    operacoes: operacoes.map((o) => ({
      id: o.o.id,
      descricao: o.o.descricao,
      horasOrcadas: txt(o.orcadas),
      horasReais: txt(o.reais),
      horasProjetadas: txt(o.projetadas),
      custoOrcado: txt(o.custoOrcado),
      custoReal: txt(o.custoReal),
      custoProjetado: txt(o.custoProjetado),
      desvio: txt(o.desvio),
      situacao: o.o.retrabalho ? 'perigo' : situacaoDe(o.desvio, tol),
      estouro: !o.o.retrabalho && o.reais.gt(o.orcadas.times(UM.plus(tol))),
      progresso: txt(o.progresso)
    })),
    custos: custos.map((x) => ({
      id: x.x.id,
      descricao: x.x.descricao,
      categoria: x.x.categoria,
      orcado: txt(x.orcado),
      real: txt(x.real),
      projetado: txt(x.projetado),
      desvio: txt(x.desvio),
      situacao: situacaoDe(x.desvio, tol)
    })),
    horasOrcadas: txt(horasOrc),
    horasReais: txt(soma(operacoes.map((o) => o.reais))),
    horasProjetadas: txt(soma(operacoes.map((o) => o.projetadas))),
    custoOrcado: txt(custoOrcado),
    custoReal: txt(custoReal),
    custoProjetado: txt(custoProjetado),
    custoNaoQualidade: txt(naoQualidade),
    desvioCusto: txt(desvioCusto),
    situacao: situacaoDe(desvioCusto, tol),
    margemOrcada: txt(margem(custoOrcado)),
    margemProjetada: txt(margem(custoProjetado)),
    progresso: txt(progresso),
    explicacao
  };
}
