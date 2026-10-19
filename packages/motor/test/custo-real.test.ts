import { describe, expect, it } from 'vitest';
import { calcularCustoReal, reais, type EntradaCustoReal } from '../src/index.js';

const CH = '117.7777777778';

// OS-2026-00041, gerada do orçamento da bucha (lote 10, R$ 793,27, impostos 14%).
const os41 = (over: Partial<EntradaCustoReal['operacoes'][number]> = {}): EntradaCustoReal => ({
  lote: 10,
  precoFinalLote: '793.2659932660',
  impostos: 0.14,
  comissao: 0,
  operacoes: [
    {
      id: 'op1',
      descricao: 'Torneamento',
      custoHora: CH,
      setupOrcadoHoras: 3,
      cicloOrcadoHorasPorPeca: 0.1,
      setupRealHoras: 3.4,
      producaoRealHoras: 0.38,
      quantidadeBoa: 4,
      setupConcluido: true,
      ...over
    }
  ],
  custos: [{ id: 'm1', descricao: 'Barra de latão C360 Ø25', categoria: 'material', orcado: 80, real: 80 }]
});

describe('custo real × orçado da OS', () => {
  it('projeta setup real + produção extrapolada pelas peças boas', () => {
    const r = calcularCustoReal(os41());
    const op = r.operacoes[0];
    expect(reais(op.horasOrcadas)).toBe('4.00');
    expect(reais(op.horasReais)).toBe('3.78');
    expect(reais(op.horasProjetadas)).toBe('4.35'); // 3,40 + 0,38 ÷ 4 × 10
    expect(Number(op.desvio).toFixed(4)).toBe('0.0875');
    expect(op.situacao).toBe('ok');
    expect(reais(r.custoOrcado)).toBe('551.11');
    expect(reais(r.custoProjetado)).toBe('592.33');
    expect(Number(r.margemOrcada).toFixed(3)).toBe('0.165');
    expect(Number(r.margemProjetada).toFixed(3)).toBe('0.113');
    expect(Number(r.progresso).toFixed(2)).toBe('0.40');
  });

  it('estouro acima da tolerância e situação por faixa', () => {
    const r = calcularCustoReal(os41({ setupRealHoras: 5, producaoRealHoras: 0, quantidadeBoa: 0, setupConcluido: false }));
    expect(r.operacoes[0].estouro).toBe(true); // 5 h > 4 h × 1,2
    expect(r.operacoes[0].situacao).toBe('perigo'); // 5 + 1 = 6 h projetadas: +50%, acima de 2× a tolerância

    const a = calcularCustoReal(os41({ setupRealHoras: 4.2, producaoRealHoras: 0, quantidadeBoa: 0, setupConcluido: false }));
    expect(a.operacoes[0].estouro).toBe(false); // 4,2 h ≤ 4,8 h
    expect(a.operacoes[0].situacao).toBe('atencao'); // 5,2 h projetadas: +30%
  });

  it('retrabalho entra como custo da não-qualidade', () => {
    const base = os41({ concluida: true, producaoRealHoras: 0.95, quantidadeBoa: 10 });
    base.operacoes.push({
      id: 'rt', descricao: 'Retrabalho do furo H7', custoHora: CH, setupOrcadoHoras: 0, cicloOrcadoHorasPorPeca: 0,
      setupRealHoras: 0, producaoRealHoras: 0.5, quantidadeBoa: 2, retrabalho: true, concluida: true
    });
    const r = calcularCustoReal(base);
    expect(reais(r.custoNaoQualidade)).toBe('58.89');
    expect(r.operacoes[1].situacao).toBe('perigo');
  });

  it('material ainda não consumido projeta pelo orçado', () => {
    const e = os41();
    e.custos[0].real = null;
    const r = calcularCustoReal(e);
    expect(reais(r.custos[0].projetado)).toBe('80.00');
    expect(reais(r.custos[0].real)).toBe('0.00');
  });
});
