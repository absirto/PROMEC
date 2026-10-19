import { describe, expect, it } from 'vitest';
import { calcularOrcamento, calcularTabelaCustos, horasReais, reais, type EntradaCentro } from '../src/index.js';

const base = (over: Partial<EntradaCentro> = {}): EntradaCentro => ({
  id: 'c1',
  nome: 'Centro',
  tipo: 'maquina',
  horasExpediente: 200,
  eficiencia: 0.8,
  maoDeObra: [],
  manutencao: 0,
  insumos: 0,
  ...over
});

describe('capacidade', () => {
  it('horas reais descontam indisponibilidades antes da eficiência', () => {
    expect(reais(horasReais({ diasUteis: 22, turnos: 1, horasPorTurno: 10, horasIndisponiveis: 20, eficiencia: 0.75 }))).toBe('150.00');
  });
});

describe('custo direto do centro', () => {
  it('depreciação usa valor residual e energia usa kW × carga × tarifa × horas reais', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 1000,
      criterioRateio: 'horas',
      centros: [
        base({
          ativo: { valorAquisicao: 120000, valorResidual: 24000, vidaUtilMeses: 120 },
          energia: { potenciaKw: 10, fatorCarga: 0.5, tarifaKwh: 0.9 }
        })
      ]
    });
    const c = t.centros[0];
    expect(reais(c.composicao.depreciacao)).toBe('800.00');
    expect(reais(c.composicao.energia)).toBe('720.00'); // 10 × 0,5 × 0,90 × 160 h
  });

  it('mão de obra entra pelo fator de alocação', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 1000,
      criterioRateio: 'horas',
      centros: [base({ maoDeObra: [{ nome: 'Soldador', salario: 4000, encargos: 2000, beneficios: 600, alocacao: 0.5 }] })]
    });
    expect(reais(t.centros[0].composicao.maoDeObra)).toBe('3300.00');
  });
});

describe('rateio', () => {
  it('peso manual distribui o custo fixo e soma 100%', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 10000,
      criterioRateio: 'manual',
      centros: [base({ id: 'a', pesoManual: 0.75 }), base({ id: 'b', pesoManual: 0.25 })]
    });
    // a: 10000 × 0,75 ÷ 160 h ; b: 10000 × 0,25 ÷ 160 h
    expect(reais(t.centros[0].rateioHora)).toBe('46.88');
    expect(reais(t.centros[1].rateioHora)).toBe('15.63');
    expect(t.bloqueios).toEqual([]);
  });

  it('pesos manuais que não somam 100% bloqueiam a publicação', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 10000,
      criterioRateio: 'manual',
      centros: [base({ id: 'a', pesoManual: 0.6 }), base({ id: 'b', pesoManual: 0.3 })]
    });
    expect(t.bloqueios.map((b) => b.codigo)).toContain('PESOS_RATEIO');
  });

  it('centro desativado sai do rateio e os demais absorvem', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 9600,
      criterioRateio: 'horas',
      centros: [base({ id: 'a' }), base({ id: 'b' }), base({ id: 'c', status: 'desativado' })]
    });
    expect(t.centros.map((c) => c.id)).toEqual(['a', 'b']);
    expect(reais(t.centros[0].rateioHora)).toBe('30.00');
  });

  it('valor do ativo como critério', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 3200,
      criterioRateio: 'valorAtivo',
      centros: [
        base({ id: 'a', ativo: { valorAquisicao: 300000, vidaUtilMeses: 60 } }),
        base({ id: 'b', ativo: { valorAquisicao: 100000, vidaUtilMeses: 60 } })
      ]
    });
    expect(reais(t.centros[0].rateioHora)).toBe('15.00');
    expect(reais(t.centros[1].rateioHora)).toBe('5.00');
  });
});

describe('bloqueios de publicação', () => {
  it('custo fixo zerado, eficiência 100% e vida útil ausente', () => {
    const t = calcularTabelaCustos({
      custoFixoTotal: 0,
      criterioRateio: 'horas',
      centros: [base({ eficiencia: 1, ativo: { valorAquisicao: 50000, vidaUtilMeses: 0 } })]
    });
    expect(t.bloqueios.map((b) => b.codigo).sort()).toEqual(['CUSTO_FIXO_ZERO', 'EFICIENCIA_100', 'VIDA_UTIL_AUSENTE']);
  });

  it('máquina sem operador gera aviso, não bloqueio', () => {
    const t = calcularTabelaCustos({ custoFixoTotal: 1000, criterioRateio: 'horas', centros: [base()] });
    expect(t.avisos.map((a) => a.codigo)).toContain('SEM_OPERADOR');
  });
});

describe('orçamento', () => {
  it('material por corte: comprimento × peso/m × R$/kg', () => {
    const o = calcularOrcamento({
      lote: 2,
      impostos: 0,
      comissao: 0,
      margemAlvo: 0,
      linhas: [{ tipo: 'materialCorte', descricao: 'Barra Ø45', comprimentoMm: 300, sobraMm: 5, pesoPorMetroKg: 12.48, precoKg: 9.5 }]
    });
    // (305 mm × 12,48 kg/m × 9,50) × 2 peças
    expect(reais(o.custoLote)).toBe('72.32');
  });

  it('mão de obra, terceiros com markup e frete por km', () => {
    const o = calcularOrcamento({
      lote: 1,
      impostos: 0,
      comissao: 0,
      margemAlvo: 0,
      linhas: [
        { tipo: 'maoDeObra', descricao: 'Revisão', custoHora: 80, tempoPadraoHoras: 1.5, fatorDificuldade: 1.2 },
        { tipo: 'terceiro', descricao: 'Retífica', custo: 200, markup: 0.1 },
        { tipo: 'frete', descricao: 'Entrega', km: 40, valorKm: 2.5 }
      ]
    });
    expect(reais(o.custoLote)).toBe('464.00');
  });

  it('método markup aplica a margem sobre o custo e impostos por dentro', () => {
    const o = calcularOrcamento({
      lote: 1,
      impostos: 0.1,
      comissao: 0,
      margemAlvo: 0.2,
      metodo: 'markup',
      linhas: [{ tipo: 'terceiro', descricao: 'Serviço', custo: 90 }]
    });
    expect(reais(o.precoLote)).toBe('120.00');
  });

  it('margem abaixo do mínimo fica em perigo e pede aprovação', () => {
    const o = calcularOrcamento({
      lote: 1,
      impostos: 0.14,
      comissao: 0,
      margemAlvo: 0.2,
      margemMinima: 0.15,
      desconto: 0.1,
      linhas: [{ tipo: 'terceiro', descricao: 'x', custo: 100 }]
    });
    expect(o.situacaoMargem).toBe('perigo');
    expect(o.exigeAprovacao).toBe(true);
  });

  it('impostos + comissão + margem ≥ 100% é rejeitado', () => {
    expect(() =>
      calcularOrcamento({ lote: 1, impostos: 0.5, comissao: 0.1, margemAlvo: 0.4, linhas: [] })
    ).toThrow(/100%/);
  });
});
