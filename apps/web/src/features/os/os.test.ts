import { describe, expect, it } from 'vitest';
import { calcularCustoReal, reais } from '@promec/motor';
import { cronometro, desvioBadge, etapaOS, normalizarFila, segundosDesde, STATUS_OS } from './os';

describe('OS', () => {
  it('mapeia status nas cores e variantes da identidade', () => {
    expect(STATUS_OS.ABERTA).toMatchObject({ tom: 'neutral', variante: 'tracejado' });
    expect(STATUS_OS.EM_EXECUCAO).toMatchObject({ tom: 'run', variante: 'pulsando' });
    expect(STATUS_OS.PAUSADA.tom).toBe('warn');
    expect(STATUS_OS.CONTROLE_QUALIDADE.tom).toBe('info');
    expect(STATUS_OS.CONCLUIDA.variante).toBe('contorno');
    expect(STATUS_OS.ENTREGUE.variante).toBe('solido');
    expect(STATUS_OS.CANCELADA).toMatchObject({ tom: 'bad', variante: 'riscado' });
    expect(etapaOS('PAUSADA')).toBe(etapaOS('EM_EXECUCAO'));
  });

  it('formata o tempo decorrido', () => {
    expect(cronometro(0)).toBe('00:00:00');
    expect(cronometro(3725)).toBe('01:02:05');
    expect(segundosDesde('2026-10-19T10:00:00Z', Date.parse('2026-10-19T10:06:30Z'))).toBe(390);
    expect(segundosDesde('2026-10-19T10:00:00Z', Date.parse('2026-10-19T09:00:00Z'))).toBe(0);
  });

  it('classifica o desvio pela tolerância de 20%', () => {
    expect(desvioBadge('0')).toEqual({ tom: 'ok', rotulo: 'no orçado' });
    expect(desvioBadge('0.13')).toEqual({ tom: 'ok', rotulo: '+13%' });
    expect(desvioBadge('0.3').tom).toBe('warn');
    expect(desvioBadge('0.45').tom).toBe('bad');
    expect(desvioBadge('-0.1')).toEqual({ tom: 'ok', rotulo: '−10%' });
  });

  it('aceita a fila do operador achatada', () => {
    const f = normalizarFila({ id: 'op1', descricao: 'Torneamento', osId: 'os1', osNumero: 'OS-2026-00041', apontamentoAberto: null });
    expect(f.os.numero).toBe('OS-2026-00041');
    expect(f.operacao.descricao).toBe('Torneamento');
  });

  it('projeta a bucha da OS-2026-00041 em 4,35 h', () => {
    const r = calcularCustoReal({
      lote: 10, precoFinalLote: '793.27', impostos: '0.14', comissao: '0',
      operacoes: [{ id: 'o', descricao: 'Torno', custoHora: '117.7777777778', setupOrcadoHoras: '3', cicloOrcadoHorasPorPeca: '0.1', setupRealHoras: '3.4', producaoRealHoras: '0.38', quantidadeBoa: 4, setupConcluido: true }],
      custos: [{ id: 'm', descricao: 'Latão', categoria: 'material', orcado: '80', real: null }]
    });
    expect(reais(r.horasProjetadas)).toBe('4.35');
    expect(Number(r.margemProjetada)).toBeCloseTo(0.113, 2);
  });
});
