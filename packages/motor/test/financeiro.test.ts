import { describe, expect, it } from 'vitest';
import {
  arredondar,
  calcularDRE,
  comissaoSobre,
  distribuirBaixa,
  encargosDeAtraso,
  gerarParcelas,
  interpretarCondicao,
  projetarCaixa
} from '../src/index.js';

describe('condição de pagamento', () => {
  it('entende os formatos usados no balcão', () => {
    expect(interpretarCondicao('À vista')).toEqual([0]);
    expect(interpretarCondicao('28 dias')).toEqual([28]);
    expect(interpretarCondicao('30/60/90')).toEqual([30, 60, 90]);
    expect(interpretarCondicao('Entrada + 30/60')).toEqual([0, 30, 60]);
    expect(interpretarCondicao('3x')).toEqual([30, 60, 90]);
    expect(() => interpretarCondicao('quando der')).toThrow(/Não entendi/);
  });
});

describe('parcelas', () => {
  it('a bucha em 30/60/90 fecha nos centavos', () => {
    const p = gerarParcelas({ valor: '793.27', dataBase: '2026-10-20', prazos: [30, 60, 90] });
    expect(p).toEqual([
      { numero: 1, vencimento: '2026-11-19', valor: '264.43' },
      { numero: 2, vencimento: '2026-12-19', valor: '264.42' },
      { numero: 3, vencimento: '2027-01-18', valor: '264.42' }
    ]);
  });

  it('entrada percentual e saldo dividido', () => {
    const p = gerarParcelas({ valor: 1000, dataBase: '2026-10-20', prazos: [0, 30, 60], entrada: '0.3' });
    expect(p.map((x) => x.valor)).toEqual(['300.00', '350.00', '350.00']);
  });
});

describe('atraso', () => {
  it('multa de 2% e juros de 1% ao mês pró-rata', () => {
    expect(encargosDeAtraso({ valor: '264.43', vencimento: '2026-11-19', dataPagamento: '2026-11-29' })).toEqual({
      diasAtraso: 10,
      multa: '5.29',
      juros: '0.88',
      total: '270.60'
    });
    expect(encargosDeAtraso({ valor: 100, vencimento: '2026-11-19', dataPagamento: '2026-11-19' }).total).toBe('100.00');
  });
});

describe('fluxo de caixa', () => {
  it('acumula o previsto a partir do saldo e traz vencido para hoje', () => {
    const r = projetarCaixa({
      saldoInicial: 5000,
      hoje: '2026-10-20',
      ate: '2026-11-02',
      agrupamento: 'semana',
      lancamentos: [
        { data: '2026-10-10', valor: 800, realizado: false },
        { data: '2026-10-22', valor: -6500, realizado: false },
        { data: '2026-10-28', valor: 2000, realizado: false },
        { data: '2026-10-15', valor: 999, realizado: true }
      ]
    });
    expect(r.map((x) => [x.inicio, x.saldoFinal, x.negativo])).toEqual([
      ['2026-10-19', '-700.00', true],
      ['2026-10-26', '1300.00', false],
      ['2026-11-02', '1300.00', false]
    ]);
  });
});

describe('DRE gerencial', () => {
  it('margem de contribuição, resultado e ponto de equilíbrio', () => {
    const d = calcularDRE({
      receitaServicos: 52000,
      receitaPecas: 8000,
      material: 9000,
      terceiros: 3000,
      comissoes: 1200,
      impostos: 8400,
      custoFixo: 22000,
      naoQualidade: 400
    });
    expect(d.margemContribuicao).toBe('38000.00');
    expect(arredondar(d.margemContribuicaoPct, 4)).toBe('0.6333');
    expect(d.resultado).toBe('16000.00');
    expect(d.pontoEquilibrio).toBe('34736.84');
  });

  it('comissão sobre o recebido', () => {
    expect(comissaoSobre('264.43', '0.03')).toBe('7.93');
  });
});

describe('baixa parcial com encargos', () => {
  it('pagar em duas vezes custa o mesmo que pagar de uma vez', () => {
    const base = { vencimento: '2026-09-05', dataPagamento: '2026-10-20' }; // 45 dias: 2% + 1,5%
    const uma = distribuirBaixa({ ...base, saldo: 1380, valorRecebido: '1428.30' });
    expect(uma).toMatchObject({ principal: '1380.00', multa: '27.60', juros: '20.70', quita: true });

    const a = distribuirBaixa({ ...base, saldo: 1380, valorRecebido: 600 });
    expect(a).toMatchObject({ principal: '579.71', multa: '11.59', juros: '8.70', quita: false });
    const resto = (1380 - 579.71).toFixed(2);
    const b = distribuirBaixa({ ...base, saldo: resto, valorRecebido: distribuirBaixa({ ...base, saldo: resto, valorRecebido: '0.01' }).devidoTotal });
    expect(b.quita).toBe(true);
    expect((600 + Number(b.devidoTotal)).toFixed(2)).toBe('1428.30');
  });

  it('acima do devido é recusado', () => {
    expect(() => distribuirBaixa({ saldo: 100, valorRecebido: 101, vencimento: '2026-10-20', dataPagamento: '2026-10-20' })).toThrow(/passa do devido/);
  });
});
