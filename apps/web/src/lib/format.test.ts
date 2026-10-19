import { describe, expect, it } from 'vitest';
import { brl, competenciaLonga, data, hhmm, horas, num, paraCampo, parseBR, pct, somarMes } from './format';

describe('formatadores pt-BR', () => {
  it('dinheiro, percentual e horas', () => {
    expect(brl('1234.56')).toBe('R$ 1.234,56');
    expect(brl('793.2666')).toBe('R$ 793,27');
    expect(pct('0.165')).toBe('16,5%');
    expect(pct('0.14')).toBe('14,0%');
    expect(horas('3.4')).toBe('3,40 h');
    expect(hhmm('0.1')).toBe('00:06');
    expect(num('117.7777777778')).toBe('117,78');
  });
  it('datas e competências', () => {
    expect(data('2026-10-26T12:00:00Z')).toBe('26/10/2026');
    expect(competenciaLonga('2026-10')).toBe('outubro de 2026');
    expect(somarMes('2026-01', -1)).toBe('2025-12');
  });
  it('lê o que a pessoa digita', () => {
    expect(parseBR('1.234,5')).toBe('1234.5');
    expect(parseBR('8')).toBe('8');
    expect(parseBR('')).toBe('');
    expect(paraCampo('117.5')).toBe('117,5');
  });
});
