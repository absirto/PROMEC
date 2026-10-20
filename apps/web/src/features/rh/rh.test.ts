import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import {
  ausentesEm, celulaComPior, contarHabilitacoes, custoAoVivo, diasDoMes, encargosDoVinculo, erroRh, estadoCelula, faixaNoMes, fraseCentro, fraseDisponibilidade, horasNoMes, previaEncargos
} from './rh';

const limpa = (s: string) => s.replace(/\s/g, ' ');

describe('encargos em %', () => {
  it('usa o padrão do vínculo quando os parâmetros não trazem', () => {
    expect(encargosDoVinculo('CLT')).toBe('0.64');
    expect(encargosDoVinculo('PJ')).toBe('0');
    expect(encargosDoVinculo('CLT', { CLT: '0.7' })).toBe('0.7');
    expect(encargosDoVinculo('HORISTA', { CLT: '0.7' })).toBe('0.64');
  });

  it('mostra a prévia em R$ a partir do %', () => {
    const p = previaEncargos({ salario: '5000', percentual: encargosDoVinculo('CLT'), vinculo: 'CLT' });
    expect(Number(p.valor)).toBe(3200);
    expect(limpa(p.texto)).toBe('CLT: 64% = R$ 3.200,00');
    expect(limpa(previaEncargos({ salario: '1000', percentual: '0.675' }).texto)).toBe('67,5% = R$ 675,00');
  });

  it('não quebra com % acima de 100 e calcula o custo-hora', () => {
    expect(Number(previaEncargos({ salario: '1000', percentual: '3' }).valor)).toBe(1000);
    const c = custoAoVivo({ salario: '5000', encargos: '', percentual: '0.64', beneficios: '0', horasDisponiveis: '176' });
    expect(Number(c.custoMensal)).toBe(8200);
    expect(Number(c.custoHora)).toBeCloseTo(46.59, 2);
    expect(custoAoVivo({ salario: '5000', encargos: '3200', percentual: null, beneficios: '', horasDisponiveis: 0 }).custoHora).toBeNull();
  });
});

describe('matriz de habilitações', () => {
  const hab = (situacao: 'ok' | 'vencendo' | 'vencida') => ({ validade: '2026-12-01', situacao });
  it('classifica a célula', () => {
    expect(estadoCelula({ alocacao: '0.5', habilitacao: hab('ok') })).toEqual({ estado: 'ok', alocado: true, atencao: false });
    expect(estadoCelula({ alocacao: '1', habilitacao: hab('vencendo') })).toMatchObject({ estado: 'vencendo', atencao: true });
    expect(estadoCelula({ alocacao: '1', habilitacao: hab('vencida') })).toMatchObject({ estado: 'vencida', atencao: true });
    expect(estadoCelula({ alocacao: null, habilitacao: hab('vencida') })).toMatchObject({ estado: 'vencida', alocado: false, atencao: false });
  });
  it('alocado sem habilitação pede atenção; sem nada é neutro', () => {
    expect(estadoCelula({ alocacao: '0.4', habilitacao: null })).toEqual({ estado: 'sem_habilitacao', alocado: true, atencao: true });
    expect(estadoCelula({ alocacao: null, habilitacao: null }).estado).toBe('nenhum');
    expect(estadoCelula(undefined).estado).toBe('nenhum');
  });
  it('conta vencendo e vencidas', () => {
    expect(contarHabilitacoes([{ situacao: 'ok' }, { situacao: 'vencendo' }, { situacao: 'vencida' }, { situacao: 'vencida' }])).toEqual({ vencendo: 1, vencidas: 2 });
  });
});

describe('disponibilidade', () => {
  it('fala em português o efeito das ausências', () => {
    expect(fraseDisponibilidade({ nome: 'Anderson Lima', jornada: '176', diasUteis: 22, diasAusente: 5, horasDisponiveis: '136' })).toBe('Anderson fica 5 dias fora: 176 h → 136 h');
    expect(fraseDisponibilidade({ nome: 'Jonas', jornada: '176', diasUteis: 21, diasAusente: 1, horasDisponiveis: '167.619' })).toBe('Jonas fica 1 dia fora: 176 h → 167,6 h');
    expect(fraseDisponibilidade({ nome: 'Diego', jornada: '220', diasUteis: 22, diasAusente: 0, horasDisponiveis: '220' })).toBe('Diego trabalha os 22 dias úteis: 220 h');
    expect(fraseDisponibilidade({ nome: 'Ana', jornada: '220', diasUteis: 22, diasAusente: 22, horasDisponiveis: '0' })).toBe('Ana fica o mês todo fora: 220 h → 0 h');
  });
  it('compara o centro com o cadastro', () => {
    expect(fraseCentro({ nome: 'Torno CNC', cadastro: '176', reais: '140' })).toBe('Torno CNC tem 36 h a menos que o cadastro: 176 h → 140 h');
    expect(fraseCentro({ nome: 'Fresa', cadastro: '176', reais: '176' })).toBe('Fresa bate com o cadastro: 176 h');
    expect(fraseCentro({ nome: 'Solda', cadastro: '100', reais: '120' })).toBe('Solda tem 20 h a mais que o cadastro: 100 h → 120 h');
  });
  it('calcula horas no navegador pelo motor', () => {
    const r = horasNoMes({ competencia: '2026-11', jornadaHoras: '220', ausencias: [{ inicio: '2026-11-09', fim: '2026-11-13' }] });
    expect(r.diasUteis).toBe(21);
    expect(r.diasAusente).toBe(5);
  });
});

describe('calendário de ausências', () => {
  it('monta os dias do mês com fim de semana', () => {
    const d = diasDoMes('2026-11');
    expect(d).toHaveLength(30);
    expect(d[0]).toMatchObject({ data: '2026-11-01', fimDeSemana: true });
    expect(d[1]!.fimDeSemana).toBe(false);
  });
  it('recorta a ausência no mês', () => {
    expect(faixaNoMes({ inicio: '2026-11-09', fim: '2026-11-13' }, '2026-11')).toEqual({ coluna: 9, dias: 5, continuaAntes: false, continuaDepois: false });
    expect(faixaNoMes({ inicio: '2026-10-28', fim: '2026-11-03' }, '2026-11')).toEqual({ coluna: 1, dias: 3, continuaAntes: true, continuaDepois: false });
    expect(faixaNoMes({ inicio: '2026-12-01', fim: '2026-12-03' }, '2026-11')).toBeNull();
  });
  it('conta pessoas ausentes no dia', () => {
    const as = [
      { colaboradorId: 'a', inicio: '2026-11-09', fim: '2026-11-13' },
      { colaboradorId: 'b', inicio: '2026-11-10', fim: '2026-11-10' },
      { colaboradorId: 'a', inicio: '2026-11-20', fim: '2026-11-20' }
    ];
    expect(ausentesEm(as, '2026-11-10')).toBe(2);
    expect(ausentesEm(as, '2026-11-15')).toBe(0);
  });
});

describe('erros do RH', () => {
  it('dá título humano para os códigos conhecidos', () => {
    const e = erroRh(new ApiError(409, 'Já existe uma ausência (ferias) de 09/11/2026 a 13/11/2026.', 'AUSENCIA_SOBREPOSTA'));
    expect(e.titulo).toBe('Essas datas batem com outra ausência');
    expect(e.codigo).toBe('AUSENCIA_SOBREPOSTA');
    expect(erroRh(new ApiError(422, 'x', 'SEM_HABILITACAO')).titulo).toBe('Falta habilitação para esse centro');
    expect(erroRh(new Error('boom')).titulo).toBe('Não deu para salvar');
  });
});

describe('celulaComPior', () => {
  it('mostra a pior habilitação do par (NR-12 vencendo ao lado de uma em dia)', () => {
    const c = { colaboradorId: 'd', centroId: 'f', alocacao: '1', habilitacao: { validade: '2030-12-31', situacao: 'ok' as const } };
    const todas = [
      { colaboradorId: 'd', centroId: 'f', situacao: 'ok' as const, validade: '2030-12-31' },
      { colaboradorId: 'd', centroId: 'f', situacao: 'vencendo' as const, validade: '2026-11-09' }
    ];
    expect(celulaComPior(c, todas)?.habilitacao).toMatchObject({ situacao: 'vencendo', validade: '2026-11-09' });
    expect(estadoCelula(celulaComPior(c, todas))).toMatchObject({ estado: 'vencendo', atencao: true });
    expect(celulaComPior(c, [])).toBe(c);
  });
});
