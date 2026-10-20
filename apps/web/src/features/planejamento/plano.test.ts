import { describe, expect, it } from 'vitest';
import { planejar, type EntradaPlanejamento } from '@promec/motor';
import { diasEntre, moverItem, previaReordenada, rotuloSemana, semanaDe, tomOcupacao } from './plano';
import { mascaraPlaca, placaMercosul, placaValida } from '../../lib/documento';

describe('planejamento', () => {
  it('cores de ocupação', () => {
    expect(tomOcupacao('0.75')).toBe('ok');
    expect(tomOcupacao('0.76')).toBe('warn');
    expect(tomOcupacao('0.9')).toBe('warn');
    expect(tomOcupacao('0.91')).toBe('bad');
    expect(tomOcupacao(0)).toBe('ok');
  });

  it('agrupa por semana começando na segunda', () => {
    expect(semanaDe('2026-10-20')).toBe('2026-10-19');
    expect(semanaDe('2026-10-25')).toBe('2026-10-19');
    expect(semanaDe('2026-10-26')).toBe('2026-10-26');
    expect(rotuloSemana('2026-10-26')).toBe('26/10 – 01/11');
    expect(diasEntre('2026-10-20', '2026-10-23')).toBe(3);
  });

  it('arrastar recalcula as datas no navegador', () => {
    const e: EntradaPlanejamento = {
      hoje: '2026-10-19',
      centros: [{ id: 'torno', nome: 'Torno', horasExpedienteMes: '176', eficiencia: '1' }],
      ordens: [
        { id: 'A', prazo: '2026-10-20', operacoes: [{ id: 'a1', centroId: 'torno', sequencia: 1, horasRestantes: '16' }] },
        { id: 'B', prazo: '2026-10-30', operacoes: [{ id: 'b1', centroId: 'torno', sequencia: 1, horasRestantes: '8' }] }
      ]
    };
    const antes = planejar(e);
    expect(antes.ordens.map((o) => o.id)).toEqual(['A', 'B']);
    const depois = previaReordenada(e, moverItem(['A', 'B'], 1, 0));
    expect(depois.ordens.map((o) => o.id)).toEqual(['B', 'A']);
    const fim = (r: typeof antes, id: string) => r.ordens.find((o) => o.id === id)!.fim;
    expect(fim(depois, 'B')! < fim(antes, 'B')!).toBe(true);
    expect(fim(depois, 'A')! > fim(antes, 'A')!).toBe(true);
    expect(depois.ordens.find((o) => o.id === 'A')!.atrasada).toBe(true);
  });

  it('placa antiga e Mercosul', () => {
    expect(placaValida('ABC1D23')).toBe(true);
    expect(placaMercosul('abc-1d23')).toBe(true);
    expect(placaValida('ABC-1234')).toBe(true);
    expect(placaMercosul('ABC1234')).toBe(false);
    expect(placaValida('AB12345')).toBe(false);
    expect(mascaraPlaca('abc1d23')).toBe('ABC1D23');
    expect(mascaraPlaca('abc1234')).toBe('ABC-1234');
    expect(mascaraPlaca('a1')).toBe('A');
  });
});
