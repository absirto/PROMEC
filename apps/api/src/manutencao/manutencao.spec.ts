import { reducoesDoCentro } from '../planejamento/entrada';
import { mesesDesde } from './manutencao.service';
import { mascarar, mascararSalario } from '../acesso/mascara.interceptor';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const aloc = (v: string) => ({ toFixed: () => v });

describe('manutenção e RH', () => {
  it('ausência reduz a capacidade só nos dias e centros do colaborador, pela alocação dos presentes', () => {
    const ops = [
      { colaboradorId: 'a', alocacao: aloc('1') },
      { colaboradorId: 'b', alocacao: aloc('0.5') }
    ];
    const r = reducoesDoCentro(ops, [{ colaboradorId: 'a', inicio: d('2026-11-10'), fim: d('2026-11-11') }, { colaboradorId: 'x', inicio: d('2026-11-12'), fim: d('2026-11-12') }], '2026-11-09', 5);
    expect(r.map((x) => x.data)).toEqual(['2026-11-10', '2026-11-11']);
    expect(Number(r[0].fator)).toBeCloseTo(1 / 3, 9);
    expect(reducoesDoCentro(ops, [], '2026-11-09', 5)).toEqual([]);
  });

  it('salário some sem rh.ver_salario; custo-hora do colaborador não é confundido com o do centro', () => {
    const colaborador = { nome: 'Ricardo', salario: '5000', encargos: '3200', custoHora: '37.27', alocacoes: [] };
    expect(mascararSalario({ itens: [colaborador] }).valor).toEqual({ itens: [{ nome: 'Ricardo', salario: null, encargos: null, custoHora: null, alocacoes: [] }] });
    expect(mascarar({ itens: [colaborador], operacoes: [{ custoHora: '117.78' }] }).valor).toEqual({ itens: [colaborador], operacoes: [{ custoHora: null }] });
  });

  it('média móvel só considera os meses desde o início do histórico do centro', () => {
    const doze = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    expect(mesesDesde(doze, '2026-05')).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(mesesDesde(doze, null)).toEqual([]);
  });
});
