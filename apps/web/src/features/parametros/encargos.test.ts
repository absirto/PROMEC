import { describe, expect, it } from 'vitest';
import { fracaoParaPercentual, percentualParaFracao } from './encargos';

describe('encargos por vínculo', () => {
  it('converte fração e percentual nos dois sentidos', () => {
    expect(fracaoParaPercentual('0.64')).toBe('64');
    expect(fracaoParaPercentual('0.645')).toBe('64.5');
    expect(percentualParaFracao('64')).toBe('0.64');
    expect(percentualParaFracao('64,5')).toBe('0.645');
    expect(percentualParaFracao('0')).toBe('0');
  });
});
