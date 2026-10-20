import { describe, expect, it } from 'vitest';
import { encargosNaData, escalaFluxo, formatarLinhaDRE, previaBaixa, previaParcelas } from './fin';

describe('financeiro', () => {
  it('prévia de parcelas', () => {
    expect(previaParcelas('30/60/90', '793.27', '2026-10-20').texto).toBe('3 parcelas: R$ 264,43 em 19/11/2026 · R$ 264,42 em 19/12/2026 · R$ 264,42 em 18/01/2027');
    expect(previaParcelas('à vista', '100', '2026-10-20').texto).toBe('1 parcela: R$ 100,00 em 20/10/2026');
    expect(previaParcelas('entrada + 30', '', '2026-10-20').texto).toBe('2 parcelas: à vista, 30 dias');
    expect(previaParcelas('qualquer coisa', '100', '2026-10-20').erro).toMatch(/Não entendi/);
  });
  it('encargos pela data do pagamento', () => {
    expect(encargosNaData({ saldo: '1000', vencimento: '2026-10-01', dataPagamento: '2026-10-01' }).total).toBe('1000.00');
    const e = encargosNaData({ saldo: '1000', vencimento: '2026-10-01', dataPagamento: '2026-10-31' });
    expect(e).toMatchObject({ diasAtraso: 30, multa: '20.00', juros: '10.00', total: '1030.00' });
  });
  it('prévia da baixa parcial divide sem cobrar encargo duas vezes', () => {
    const b = previaBaixa({ saldo: '1380', vencimento: '2026-09-05', dataPagamento: '2026-10-20', valor: '600' });
    expect(b.texto).toBe('Recebe R$ 600,00 = principal R$ 579,71 + multa R$ 11,59 + juros R$ 8,70');
    expect(b.situacao).toBe('Fica um saldo de R$ 800,29.');
    const total = previaBaixa({ saldo: '1380', vencimento: '2026-09-05', dataPagamento: '2026-10-20' });
    expect(total).toMatchObject({ devidoTotal: '1428.30', quita: true, situacao: 'Quita o título.' });
    expect(previaBaixa({ saldo: '1380', vencimento: '2026-09-05', dataPagamento: '2026-10-20', valor: '1500' }).erro).toMatch(/Passa do devido/);
  });
  it('escala do fluxo inclui o zero com saldo negativo', () => {
    const s = escalaFluxo([500, -250, 1000], 200);
    expect(s.y(s.max)).toBe(0);
    expect(s.y(s.min)).toBeCloseTo(200);
    expect(s.zero).toBeGreaterThan(s.y(1000));
    expect(s.zero).toBeLessThan(s.y(-250));
    expect(escalaFluxo([100, 200], 100).y(0)).toBeCloseTo(100);
  });
  it('linhas da DRE', () => {
    expect(formatarLinhaDRE({ chave: 'custoFixo', rotulo: 'Custo fixo', valor: '22000.00', pct: '0.4', nivel: 0 })).toMatchObject({ valor: '− R$ 22.000,00', pct: '40,0%', total: true, custo: true });
    expect(formatarLinhaDRE({ chave: 'resultado', rotulo: 'Resultado', valor: '-1500.50', pct: '-0.03', nivel: 0 })).toMatchObject({ valor: '-R$ 1.500,50', negativo: true, pct: '-3,0%' });
    expect(formatarLinhaDRE({ chave: 'receitaServicos', rotulo: 'Serviços', valor: '40000', pct: '0.8', nivel: 1 })).toMatchObject({ valor: 'R$ 40.000,00', total: false });
  });
});
