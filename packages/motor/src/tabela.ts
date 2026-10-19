import { no, type NoExplicacao } from './explicacao.js';
import { dec, fracao, soma, txt, ZERO, type Dec, type Num } from './numero.js';

export type TipoCentro = 'maquina' | 'automatica' | 'box' | 'bancada' | 'celulaSolda' | 'movel' | 'maoDeObra' | 'externa';
export type StatusCentro = 'ativo' | 'manutencao' | 'desativado';
export type CriterioRateio = 'horas' | 'valorAtivo' | 'area' | 'faturamento' | 'manual';

export interface EntradaMaoDeObra {
  colaboradorId?: string;
  nome: string;
  salario: Num;
  encargos: Num;
  beneficios: Num;
  /** Fração do tempo do colaborador dedicada a este centro (0 a 1). */
  alocacao: Num;
}

export interface EntradaCentro {
  id: string;
  nome: string;
  tipo: TipoCentro;
  status?: StatusCentro;
  /** Horas de expediente no mês, já descontadas as indisponibilidades programadas. */
  horasExpediente: Num;
  eficiencia: Num;
  maoDeObra: EntradaMaoDeObra[];
  manutencao: Num;
  insumos: Num;
  outros?: Num;
  ativo?: { valorAquisicao: Num; valorResidual?: Num; vidaUtilMeses: Num };
  energia?: { potenciaKw: Num; fatorCarga: Num; tarifaKwh: Num };
  pesoManual?: Num;
  areaM2?: Num;
  faturamento?: Num;
}

export interface EntradaTabela {
  custoFixoTotal: Num;
  criterioRateio: CriterioRateio;
  centros: EntradaCentro[];
}

export interface Ocorrencia {
  codigo: string;
  mensagem: string;
  centroId?: string;
  colaboradorId?: string;
}

export interface ComposicaoCentro {
  maoDeObra: string;
  manutencao: string;
  insumos: string;
  depreciacao: string;
  energia: string;
  outros: string;
  rateio: string;
}

export interface ResultadoCentro {
  id: string;
  nome: string;
  tipo: TipoCentro;
  horasReais: string;
  custoDiretoMensal: string;
  rateioMensal: string;
  pesoRateio: string;
  especificoHora: string;
  rateioHora: string;
  cheioHora: string;
  marginalHora: string;
  /** Valores mensais por componente. */
  composicao: ComposicaoCentro;
  /** Mesmos componentes em R$/h. */
  composicaoHora: ComposicaoCentro;
  explicacao: NoExplicacao;
}

export interface ResultadoTabela {
  custoFixoTotal: string;
  criterioRateio: CriterioRateio;
  horasReaisTotais: string;
  centros: ResultadoCentro[];
  /** Impedem publicar a versão. */
  bloqueios: Ocorrencia[];
  /** Pedem atenção, mas não impedem. */
  avisos: Ocorrencia[];
}

export interface EntradaCapacidade {
  diasUteis: Num;
  turnos: Num;
  horasPorTurno: Num;
  horasIndisponiveis?: Num;
  eficiencia: Num;
}

/** Horas de expediente do mês (dias × turnos × horas − indisponibilidades). */
export const horasExpediente = (e: Omit<EntradaCapacidade, 'eficiencia'>): string =>
  txt(dec(e.diasUteis).times(dec(e.turnos)).times(dec(e.horasPorTurno)).minus(dec(e.horasIndisponiveis)));

/** H_reais = (D × T × h − H_indisp) × η */
export const horasReais = (e: EntradaCapacidade): string =>
  txt(dec(horasExpediente(e)).times(fracao(e.eficiencia, 'Eficiência')));

const SEM_OPERADOR_PERMITIDO: TipoCentro[] = ['automatica', 'externa'];

const pesoBruto = (c: EntradaCentro, criterio: CriterioRateio, horas: Dec): Dec => {
  switch (criterio) {
    case 'horas':
      return horas;
    case 'valorAtivo':
      return dec(c.ativo?.valorAquisicao);
    case 'area':
      return dec(c.areaM2);
    case 'faturamento':
      return dec(c.faturamento);
    case 'manual':
      return dec(c.pesoManual);
  }
};

export function calcularTabelaCustos(entrada: EntradaTabela): ResultadoTabela {
  const bloqueios: Ocorrencia[] = [];
  const avisos: Ocorrencia[] = [];
  const cf = dec(entrada.custoFixoTotal);

  if (cf.lte(0)) {
    bloqueios.push({ codigo: 'CUSTO_FIXO_ZERO', mensagem: 'O custo fixo do mês está zerado. Sem ele, nenhuma hora paga o aluguel, a luz e o escritório.' });
  }

  const ativos = entrada.centros.filter((c) => (c.status ?? 'ativo') !== 'desativado');
  if (ativos.length === 0) {
    bloqueios.push({ codigo: 'SEM_CENTROS', mensagem: 'Cadastre pelo menos um centro de trabalho ativo para calcular o custo-hora.' });
  }

  const alocacaoPorColaborador = new Map<string, { nome: string; total: Dec }>();

  const base = ativos.map((c) => {
    const eta = fracao(c.eficiencia, `Eficiência de ${c.nome}`);
    if (eta.gte(1)) {
      bloqueios.push({
        codigo: 'EFICIENCIA_100',
        centroId: c.id,
        mensagem: `${c.nome} está com eficiência de 100%. Nenhuma máquina roda o tempo todo; use a média do apontamento.`
      });
    }
    const horas = dec(c.horasExpediente).times(eta);
    if (horas.lte(0)) {
      bloqueios.push({ codigo: 'SEM_HORAS', centroId: c.id, mensagem: `${c.nome} não tem horas disponíveis no mês.` });
    }

    const maoDeObra = soma(
      c.maoDeObra.map((m) => {
        const a = fracao(m.alocacao, `Alocação de ${m.nome}`);
        if (m.colaboradorId) {
          const atual = alocacaoPorColaborador.get(m.colaboradorId) ?? { nome: m.nome, total: ZERO };
          alocacaoPorColaborador.set(m.colaboradorId, { nome: m.nome, total: atual.total.plus(a) });
        }
        return dec(m.salario).plus(dec(m.encargos)).plus(dec(m.beneficios)).times(a);
      })
    );
    if (c.maoDeObra.length === 0 && c.tipo === 'maquina') {
      avisos.push({ codigo: 'SEM_OPERADOR', centroId: c.id, mensagem: `${c.nome} está sem operador alocado. Se alguém opera essa máquina, inclua para o custo-hora não sair baixo.` });
    } else if (c.maoDeObra.length === 0 && !SEM_OPERADOR_PERMITIDO.includes(c.tipo) && c.tipo !== 'maquina') {
      avisos.push({ codigo: 'SEM_OPERADOR', centroId: c.id, mensagem: `${c.nome} está sem ninguém alocado.` });
    }

    let depreciacao = ZERO;
    if (c.ativo) {
      const vida = dec(c.ativo.vidaUtilMeses);
      if (vida.lte(0)) {
        bloqueios.push({ codigo: 'VIDA_UTIL_AUSENTE', centroId: c.id, mensagem: `Falta a vida útil de ${c.nome}; sem ela não dá para calcular a depreciação.` });
      } else {
        depreciacao = dec(c.ativo.valorAquisicao).minus(dec(c.ativo.valorResidual)).div(vida);
      }
    }

    const energia = c.energia
      ? dec(c.energia.potenciaKw).times(dec(c.energia.fatorCarga)).times(dec(c.energia.tarifaKwh)).times(horas)
      : ZERO;

    const componentes = {
      maoDeObra,
      manutencao: dec(c.manutencao),
      insumos: dec(c.insumos),
      depreciacao,
      energia,
      outros: dec(c.outros)
    };
    return { c, horas, componentes, peso: pesoBruto(c, entrada.criterioRateio, horas) };
  });

  for (const [id, { nome, total }] of alocacaoPorColaborador) {
    if (total.gt(1)) {
      bloqueios.push({
        codigo: 'ALOCACAO_EXCEDIDA',
        mensagem: `${nome} está alocado em ${total.times(100).toFixed(0)}% somando os centros. O máximo é 100%.`,
        colaboradorId: id
      });
    }
  }

  const somaPesos = soma(base.map((b) => b.peso));
  if (entrada.criterioRateio === 'manual' && base.length > 0 && !somaPesos.minus(1).abs().lt('0.0001')) {
    bloqueios.push({
      codigo: 'PESOS_RATEIO',
      mensagem: `Os pesos de rateio somam ${somaPesos.times(100).toDecimalPlaces(2).toFixed()}%. Eles precisam fechar em 100%.`
    });
  }
  if (base.length > 0 && somaPesos.lte(0)) {
    bloqueios.push({ codigo: 'PESOS_RATEIO', mensagem: 'Nenhum centro tem peso para o rateio pelo critério escolhido.' });
  }

  const horasTotais = soma(base.map((b) => b.horas));

  const centros = base.map(({ c, horas, componentes, peso }): ResultadoCentro => {
    const fatia = somaPesos.gt(0) ? peso.div(somaPesos) : ZERO;
    const rateioMensal = cf.times(fatia);
    const porHora = (v: Dec) => (horas.gt(0) ? v.div(horas) : ZERO);
    const direto = soma(Object.values(componentes));
    const especifico = porHora(direto);
    const rateio = porHora(rateioMensal);
    const cheio = especifico.plus(rateio);

    const mensal: ComposicaoCentro = {
      maoDeObra: txt(componentes.maoDeObra),
      manutencao: txt(componentes.manutencao),
      insumos: txt(componentes.insumos),
      depreciacao: txt(componentes.depreciacao),
      energia: txt(componentes.energia),
      outros: txt(componentes.outros),
      rateio: txt(rateioMensal)
    };
    const hora = Object.fromEntries(Object.entries(mensal).map(([k, v]) => [k, txt(porHora(dec(v)))])) as unknown as ComposicaoCentro;

    const explicacao = no('Custo-hora cheio', cheio, {
      unidade: 'R$/h',
      formula: 'específico + rateio do custo fixo',
      filhos: [
        no('Custo específico', especifico, {
          unidade: 'R$/h',
          formula: 'custo direto do mês ÷ horas reais',
          filhos: [
            no('Mão de obra', componentes.maoDeObra, { unidade: 'R$', formula: '(salário + encargos + benefícios) × alocação' }),
            no('Manutenção média', componentes.manutencao, { unidade: 'R$' }),
            no('Insumos e ferramentaria geral', componentes.insumos, { unidade: 'R$' }),
            no('Depreciação', componentes.depreciacao, { unidade: 'R$', formula: '(valor − residual) ÷ vida útil' }),
            no('Energia', componentes.energia, { unidade: 'R$', formula: 'kW × fator de carga × tarifa × horas reais' }),
            no('Outros', componentes.outros, { unidade: 'R$' }),
            no('Horas reais', horas, { unidade: 'h', formula: 'expediente × eficiência' })
          ]
        }),
        no('Rateio do custo fixo', rateio, {
          unidade: 'R$/h',
          formula: 'custo fixo × peso ÷ horas reais',
          filhos: [no('Custo fixo do mês', cf, { unidade: 'R$' }), no('Peso no rateio', fatia.times(100), { unidade: '%' })]
        })
      ]
    });

    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      horasReais: txt(horas),
      custoDiretoMensal: txt(direto),
      rateioMensal: txt(rateioMensal),
      pesoRateio: txt(fatia),
      especificoHora: txt(especifico),
      rateioHora: txt(rateio),
      cheioHora: txt(cheio),
      marginalHora: txt(especifico),
      composicao: mensal,
      composicaoHora: hora,
      explicacao
    };
  });

  return {
    custoFixoTotal: txt(cf),
    criterioRateio: entrada.criterioRateio,
    horasReaisTotais: txt(horasTotais),
    centros,
    bloqueios,
    avisos
  };
}
