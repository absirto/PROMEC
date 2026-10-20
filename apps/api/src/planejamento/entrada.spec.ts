import type { LinhaOrcamento } from '@promec/motor';
import { lerHorario, local, segundaDa } from './calendario';
import { roteiroDoOrcamento } from './entrada';

describe('planejamento', () => {
  it('roteiro do orçamento em horas por centro', () => {
    const linhas = [
      { tipo: 'material', descricao: 'Latão', quantidade: 1, custoUnitario: 8 },
      { tipo: 'operacao', descricao: 'Torno', centroId: 't', custoHora: 1, cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' },
      { tipo: 'maoDeObra', descricao: 'Montagem', centroId: 'b', custoHora: 1, tempoPadraoHoras: '0.5', fatorDificuldade: '2', base: 'peca' }
    ] as unknown as LinhaOrcamento[];
    expect(roteiroDoOrcamento(linhas, 10)).toEqual([
      { centroId: 't', sequencia: 20, horasRestantes: '4' },
      { centroId: 'b', sequencia: 30, horasRestantes: '10' }
    ]);
  });

  it('horário sem fuso é de Brasília', () => {
    expect(lerHorario('2030-01-08T09:00').toISOString()).toBe('2030-01-08T12:00:00.000Z');
    expect(local(new Date('2030-01-08T02:30:00Z'))).toEqual({ data: '2030-01-07', minutos: 23 * 60 + 30 });
    expect(segundaDa('2026-10-25')).toBe('2026-10-19');
  });
});
