import { describe, expect, it } from 'vitest';
import { arredondar, ordenarFila, planejar, prometerPrazo, type CalendarioCentro, type EntradaPlanejamento } from '../src/index.js';

// Outubro/2026 tem 22 dias úteis: 220 h × 75% ÷ 22 = 7,5 h reais por dia, a mesma base da Tabela de Custos.
const centro = (id: string, over: Partial<CalendarioCentro> = {}): CalendarioCentro => ({
  id,
  nome: id,
  horasExpedienteMes: 220,
  eficiencia: 0.75,
  ...over
});

const base = (over: Partial<EntradaPlanejamento> = {}): EntradaPlanejamento => ({
  hoje: '2026-10-20',
  centros: [centro('torno'), centro('fresa')],
  ordens: [],
  ...over
});

describe('capacidade', () => {
  it('usa as horas reais da Tabela de Custos divididas pelos dias úteis do mês', () => {
    const r = planejar(base());
    const torno = r.centros.find((c) => c.id === 'torno')!;
    expect(arredondar(torno.dias.find((d) => d.data === '2026-10-20')!.capacidade)).toBe('7.50');
    expect(torno.dias.find((d) => d.data === '2026-10-24')!.capacidade).toBe('0'); // sábado
    // semana de 19/10 a partir de terça: 4 dias × 7,5 h
    expect(arredondar(torno.semanas[0].capacidade)).toBe('30.00');
  });

  it('feriado tira o dia e redistribui as horas do mês; bloqueio só tira o dia', () => {
    const r = planejar(
      base({
        feriados: ['2026-10-12'],
        centros: [centro('torno', { bloqueios: [{ inicio: '2026-10-21', fim: '2026-10-21', motivo: 'Preventiva' }] })]
      })
    );
    const dias = r.centros[0].dias;
    expect(arredondar(dias.find((d) => d.data === '2026-10-20')!.capacidade)).toBe('7.86'); // 165 ÷ 21
    expect(dias.find((d) => d.data === '2026-10-21')!.capacidade).toBe('0');
  });
});

describe('programação em capacidade finita', () => {
  it('a bucha da OS-2026-00041 cabe hoje no torno', () => {
    const r = planejar(base({ ordens: [{ id: 'os41', prazo: '2026-10-30', operacoes: [{ id: 'op', centroId: 'torno', sequencia: 10, horasRestantes: '4.35' }] }] }));
    expect(r.ordens[0]).toMatchObject({ inicio: '2026-10-20', fim: '2026-10-20', atrasada: false });
  });

  it('respeita a sequência do roteiro entre centros e pula o fim de semana', () => {
    const r = planejar(
      base({
        ordens: [
          {
            id: 'eixo',
            operacoes: [
              { id: 'a', centroId: 'torno', sequencia: 10, horasRestantes: 30 },
              { id: 'b', centroId: 'fresa', sequencia: 20, horasRestantes: 10 }
            ]
          }
        ]
      })
    );
    const [a, b] = r.ordens[0].operacoes;
    expect([a.inicio, a.fim]).toEqual(['2026-10-20', '2026-10-23']); // 4 × 7,5 h
    expect([b.inicio, b.fim]).toEqual(['2026-10-23', '2026-10-26']); // começa no dia em que o torno termina
    expect(r.ordens[0].fim).toBe('2026-10-26');
  });

  it('ordena por posição manual, depois atrasadas, prioridade e prazo; provisórias atrás', () => {
    const fila = ordenarFila(
      [
        { id: 'normal', prioridade: 'NORMAL', prazo: '2026-10-25', operacoes: [] },
        { id: 'urgente', prioridade: 'URGENTE', prazo: '2026-11-10', operacoes: [] },
        { id: 'atrasada', prioridade: 'BAIXA', prazo: '2026-10-15', operacoes: [] },
        { id: 'reserva', prioridade: 'URGENTE', provisoria: true, operacoes: [] },
        { id: 'manual', prioridade: 'BAIXA', posicao: 1, operacoes: [] }
      ],
      '2026-10-20'
    );
    expect(fila.map((o) => o.id)).toEqual(['manual', 'atrasada', 'urgente', 'normal', 'reserva']);
  });

  it('a segunda OS no mesmo centro vai para depois da primeira e acusa atraso', () => {
    const r = planejar(
      base({
        ordens: [
          { id: 'a', prioridade: 'URGENTE', operacoes: [{ id: 'a1', centroId: 'torno', sequencia: 10, horasRestantes: 15 }] },
          { id: 'b', prazo: '2026-10-21', operacoes: [{ id: 'b1', centroId: 'torno', sequencia: 10, horasRestantes: 3 }] }
        ]
      })
    );
    expect(r.ordens.map((o) => [o.id, o.fim])).toEqual([
      ['a', '2026-10-21'],
      ['b', '2026-10-22']
    ]);
    expect(r.ordens[1]).toMatchObject({ atrasada: true, atrasoDias: 1 });
    expect(r.alertas.some((x) => x.tipo === 'atraso' && x.ordemId === 'b')).toBe(true);
  });

  it('agenda fixa da oficina ocupa horas antes da fila', () => {
    const r = planejar(
      base({
        ocupacaoFixa: [{ centroId: 'torno', data: '2026-10-20', horas: 6 }],
        ordens: [{ id: 'x', operacoes: [{ id: 'x1', centroId: 'torno', sequencia: 10, horasRestantes: 3 }] }]
      })
    );
    expect(r.ordens[0].operacoes[0].alocacao.map((a) => [a.data, arredondar(a.horas)])).toEqual([
      ['2026-10-20', '1.50'],
      ['2026-10-21', '1.50']
    ]);
  });

  it('sobrecarga acima de 90% na semana e centro inexistente', () => {
    const r = planejar(
      base({
        ordens: [
          { id: 'cheia', operacoes: [{ id: 'c1', centroId: 'torno', sequencia: 10, horasRestantes: 28 }] },
          { id: 'orfa', operacoes: [{ id: 'o1', centroId: 'solda', sequencia: 10, horasRestantes: 2 }] }
        ]
      })
    );
    expect(r.alertas.some((a) => a.tipo === 'sobrecarga' && a.centroId === 'torno' && a.semana === '2026-10-19')).toBe(true);
    expect(r.semDestino).toEqual([{ ordemId: 'orfa', operacaoId: 'o1', motivo: 'CENTRO_INEXISTENTE' }]);
  });
});

describe('promessa de prazo', () => {
  it('coloca o roteiro novo depois da fila atual', () => {
    const e = base({ ordens: [{ id: 'a', operacoes: [{ id: 'a1', centroId: 'torno', sequencia: 10, horasRestantes: 15 }] }] });
    const p = prometerPrazo(e, [{ centroId: 'torno', sequencia: 10, horasRestantes: 4 }]);
    expect(p.fim).toBe('2026-10-22');
    expect(Number(p.ocupacaoMaxima)).toBeGreaterThan(0.6);
  });
});
