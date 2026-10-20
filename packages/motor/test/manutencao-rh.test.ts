import { describe, expect, it } from 'vitest';
import {
  arredondar,
  compararSubstituicao,
  custoColaborador,
  disponibilidadeNoMes,
  fatorPresenca,
  indicadoresManutencao,
  mediaMovel,
  planejar,
  produtividade,
  situacaoPreventiva
} from '../src/index.js';

describe('manutenção', () => {
  it('média móvel de 6 meses', () => {
    expect(mediaMovel([500, 700, 900, 600, 800, 700, 700], 6)).toBe('733.3333333333');
  });

  it('MTBF, MTTR, disponibilidade e custo por hora produzida', () => {
    const r = indicadoresManutencao({ horasOperacao: 480, quebras: [{ horasParado: 6 }, { horasParado: 10 }], custoManutencao: 2400 });
    expect(r.mtbf).toBe('240');
    expect(r.mttr).toBe('8');
    expect(arredondar(r.disponibilidade, 4)).toBe('0.9677');
    expect(r.custoPorHoraProduzida).toBe('5');
  });

  it('preventiva por horas e por calendário', () => {
    expect(situacaoPreventiva({ tipo: 'HORAS', intervaloHoras: 500, horasDesdeUltima: 470 }).situacao).toBe('proxima');
    expect(situacaoPreventiva({ tipo: 'HORAS', intervaloHoras: 500, horasDesdeUltima: 520 }).situacao).toBe('vencida');
    const c = situacaoPreventiva({ tipo: 'CALENDARIO', intervaloDias: 90, ultimaExecucao: '2026-08-01', hoje: '2026-10-20' });
    expect(c).toMatchObject({ situacao: 'ok', proximaData: '2026-10-30', falta: '10' });
  });

  it('trocar a máquina compensa quando o novo custa menos por mês', () => {
    const r = compararSubstituicao({ manutencaoAtualMes: 1800, depreciacaoAtualMes: 0, valorNovo: 150000, vidaUtilNovoMeses: 120, manutencaoNovoMes: 300 });
    expect(r).toMatchObject({ novoMes: '1550', economiaMes: '250', vale: true });
  });
});

describe('RH', () => {
  it('férias descontam horas do mês', () => {
    const r = disponibilidadeNoMes({ competencia: '2026-11', jornadaHoras: 220, ausencias: [{ inicio: '2026-11-09', fim: '2026-11-13' }], feriados: ['2026-11-02', '2026-11-20'] });
    expect(r.diasUteis).toBe(19);
    expect(r.diasAusente).toBe(5);
    expect(arredondar(r.horasDisponiveis)).toBe('162.11');
  });

  it('encargos por percentual do vínculo reproduzem a planilha', () => {
    const r = custoColaborador({ salario: 5000, encargosPercentual: '0.64', beneficios: 0, horasDisponiveis: 220 });
    expect(r.custoMensal).toBe('8200');
    expect(arredondar(r.custoHora!)).toBe('37.27');
  });

  it('produtividade abaixo da eficiência por 2 meses pede recalibração', () => {
    const r = produtividade({ meses: [{ horasApontadas: 170, horasDisponiveis: 220 }, { horasApontadas: 150, horasDisponiveis: 220 }, { horasApontadas: 155, horasDisponiveis: 220 }], eficienciaTabela: 0.75 });
    expect(r.recalibrar).toBe(true);
  });

  it('operador de férias reduz a capacidade do centro no planejamento', () => {
    const fator = fatorPresenca([{ alocacao: 1, ausente: true }]);
    expect(fator).toBe('0');
    const r = planejar({
      hoje: '2026-10-20',
      centros: [{ id: 'torno', nome: 'Torno', horasExpedienteMes: 220, eficiencia: 0.75, reducoes: [{ data: '2026-10-20', fator }] }],
      ordens: [{ id: 'x', operacoes: [{ id: 'o', centroId: 'torno', sequencia: 10, horasRestantes: 2 }] }]
    });
    expect(r.ordens[0].inicio).toBe('2026-10-21');
  });
});
