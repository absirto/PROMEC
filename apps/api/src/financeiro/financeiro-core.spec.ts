import { ErroApi } from '../comum/erros';
import { diasAtraso, prazosDe, vencimentoNaCompetencia } from './financeiro-core';

describe('financeiro', () => {
  it('condição de pagamento pelo motor, inválida vira 422', () => {
    expect(prazosDe('30/60/90')).toEqual([30, 60, 90]);
    expect(prazosDe('à vista')).toEqual([0]);
    expect(() => prazosDe('quando der')).toThrow(ErroApi);
  });

  it('vencimento da recorrência respeita o fim do mês', () => {
    expect(vencimentoNaCompetencia('2027-02', 30)).toBe('2027-02-28');
    expect(vencimentoNaCompetencia('2026-10', 5)).toBe('2026-10-05');
  });

  it('dias de atraso só para título em aberto com saldo', () => {
    const t = { valor: { toFixed: () => '100' }, valorPago: { toFixed: () => '0' }, status: 'ABERTO', vencimento: new Date('2026-10-01T00:00:00Z') } as never;
    expect(diasAtraso(t, '2026-10-11')).toBe(10);
    expect(diasAtraso({ ...(t as object), status: 'PAGO' } as never, '2026-10-11')).toBe(0);
  });
});
