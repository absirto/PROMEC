import { describe, expect, it } from 'vitest';
import {
  calcularOrcamento,
  calcularTabelaCustos,
  precoDaHora,
  reais,
  type EntradaCentro,
  type EntradaOrcamento
} from '../src/index.js';

// Parâmetros da planilha PRECIFICAÇÃO EM USINAGEM: 3 centros iguais, 220 h, 75%,
// depreciação em 60 meses, energia zero, custo fixo de R$ 22.000.
const torno = (id: string, nome: string): EntradaCentro => ({
  id,
  nome,
  tipo: 'maquina',
  horasExpediente: 220,
  eficiencia: 0.75,
  maoDeObra: [{ nome: 'Operador', salario: 5000, encargos: 3200, beneficios: 0, alocacao: 1 }],
  manutencao: 700,
  insumos: 700,
  ativo: { valorAquisicao: 150000, valorResidual: 0, vidaUtilMeses: 60 }
});

const tabelaPlanilha = () =>
  calcularTabelaCustos({
    custoFixoTotal: 22000,
    criterioRateio: 'horas',
    centros: [torno('torno-cnc', 'Torno CNC de entrada'), torno('fresa-01', 'Fresa CNC 01'), torno('cu-02', 'Centro de usinagem 02')]
  });

const bucha = (desconto = 0): EntradaOrcamento => ({
  lote: 10,
  impostos: 0.14,
  comissao: 0,
  margemAlvo: 0.2,
  margemMinima: 0.15,
  desconto,
  linhas: [
    { tipo: 'material', descricao: 'Barra de latão C360 Ø25', base: 'peca', quantidade: 1, custoUnitario: 8 },
    {
      tipo: 'operacao',
      descricao: 'Torneamento',
      centroId: 'torno-cnc',
      custoHora: tabelaPlanilha().centros[0].cheioHora,
      cicloHorasPorPeca: 0.1,
      setupHorasPorLote: 3
    }
  ]
});

describe('critério de aceite: reproduz a planilha ao centavo', () => {
  it('taxa de rateio, custo específico e custo-hora cheio', () => {
    const t = tabelaPlanilha();
    expect(t.bloqueios).toEqual([]);
    for (const c of t.centros) {
      expect(reais(c.horasReais)).toBe('165.00');
      expect(reais(c.rateioHora)).toBe('44.44');
      expect(reais(c.especificoHora)).toBe('73.33');
      expect(reais(c.cheioHora)).toBe('117.78');
      expect(reais(c.marginalHora)).toBe('73.33');
      expect(reais(c.custoDiretoMensal)).toBe('12100.00');
    }
  });

  it('preço de 1 hora de máquina (simulador da planilha)', () => {
    const ch = tabelaPlanilha().centros[0].cheioHora;
    expect(reais(precoDaHora(ch, { impostos: 0.14, comissao: 0, margem: 0.2 }))).toBe('178.45');
  });
});

describe('orçamento da bucha de latão H7, lote de 10', () => {
  it('custo e preço do lote', () => {
    const o = calcularOrcamento(bucha());
    expect(reais(o.custoLote)).toBe('551.11');
    expect(reais(o.precoLote)).toBe('835.02');
    expect(reais(o.precoUnitario)).toBe('83.50');
    expect(o.situacaoMargem).toBe('ok');
  });

  it('5% de desconto leva a margem efetiva para 16,5% (atenção)', () => {
    const o = calcularOrcamento(bucha(0.05));
    expect(reais(o.precoFinalLote)).toBe('793.27');
    expect(reais(o.precoFinalUnitario)).toBe('79.33');
    expect(Number(o.margemEfetiva).toFixed(3)).toBe('0.165');
    expect(o.situacaoMargem).toBe('atencao');
  });

  it('curva de lote com setup diluído', () => {
    const o = calcularOrcamento(bucha());
    expect(o.curvaLote.map((p) => [p.quantidade, reais(p.precoUnitario)])).toEqual([
      [1, '565.32'],
      [10, '83.50'],
      [50, '40.67'],
      [100, '35.32']
    ]);
  });

  it('composição na ordem fixa e explicação do preço', () => {
    const o = calcularOrcamento(bucha());
    const comp = Object.fromEntries(o.composicao.map((c) => [c.categoria, reais(c.valor)]));
    expect(comp.material).toBe('80.00');
    expect(comp.horaMaquina).toBe('117.78');
    expect(comp.setup).toBe('353.33');
    expect(comp.impostos).toBe('116.90');
    expect(comp.margem).toBe('167.00');
    expect(o.explicacao.rotulo).toBe('Preço do lote');
    expect(o.explicacao.filhos?.length).toBeGreaterThan(0);
  });
});
