import { describe, expect, it } from 'vitest';
import { situacaoPreventiva } from '@promec/motor';
import {
  anelPreventiva, centrosParados, checklistInicial, clamp01, limparChecklist, mensagemConflito, moverItem, osPrevistasNaQuebra, rotuloStatusOrdem,
  tetoEixo, textoSituacao, tomStatusOrdem, type Ordem
} from './manutencao';

describe('anel da preventiva', () => {
  it('por horas: fração do uso, verde e "faltam"', () => {
    const s = situacaoPreventiva({ tipo: 'HORAS', intervaloHoras: '500', horasDesdeUltima: '352.5' });
    const a = anelPreventiva('HORAS', s);
    expect(a.fracao).toBeCloseTo(0.705);
    expect(a.tom).toBe('ok');
    expect(a.texto).toBe('faltam 147,5 h');
    expect(a.rotulo).toBe('Em dia: faltam 147,5 h');
  });

  it('próxima fica amarela; vencida enche o anel e fica vermelha', () => {
    const prox = anelPreventiva('HORAS', situacaoPreventiva({ tipo: 'HORAS', intervaloHoras: '500', horasDesdeUltima: '470' }));
    expect(prox.tom).toBe('warn');
    expect(prox.cor).toContain('signal');
    const venc = anelPreventiva('HORAS', situacaoPreventiva({ tipo: 'HORAS', intervaloHoras: '500', horasDesdeUltima: '512.5' }));
    expect(venc.tom).toBe('bad');
    expect(venc.fracao).toBe(1);
    expect(venc.texto).toBe('vencida há 12,5 h');
  });

  it('limita a fração entre 0 e 1', () => {
    expect(clamp01('1.4')).toBe(1);
    expect(clamp01('-0.2')).toBe(0);
    expect(clamp01('abc')).toBe(0);
    expect(anelPreventiva('CALENDARIO', { situacao: 'ok', falta: '80', proximaData: null, progresso: '-0.1' }).fracao).toBe(0);
  });

  it('por calendário: dias que faltam e dias de atraso', () => {
    const s = situacaoPreventiva({ tipo: 'CALENDARIO', intervaloDias: 90, ultimaExecucao: '2026-08-01', hoje: '2026-10-18' });
    expect(anelPreventiva('CALENDARIO', s).texto).toBe('vence em 12 dias');
    expect(textoSituacao('CALENDARIO', { situacao: 'proxima', falta: '1' })).toBe('vence amanhã');
    expect(textoSituacao('CALENDARIO', { situacao: 'vencida', falta: '0' })).toBe('vence hoje');
    expect(textoSituacao('CALENDARIO', { situacao: 'vencida', falta: '-1' })).toBe('vencida há 1 dia');
    const v = anelPreventiva('CALENDARIO', situacaoPreventiva({ tipo: 'CALENDARIO', intervaloDias: 30, ultimaExecucao: '2026-09-15', hoje: '2026-10-18' }));
    expect(v.texto).toBe('vencida há 3 dias');
    expect(v.tom).toBe('bad');
  });

  it('horas: singular e intervalo cheio', () => {
    expect(textoSituacao('HORAS', { situacao: 'proxima', falta: '1' })).toBe('falta 1 h');
    expect(textoSituacao('HORAS', { situacao: 'vencida', falta: '0' })).toBe('chegou ao intervalo');
  });
});

describe('ordens', () => {
  it('rótulos e tons de status', () => {
    expect(rotuloStatusOrdem('EM_EXECUCAO')).toBe('Em execução');
    expect(rotuloStatusOrdem('CONCLUIDA')).toBe('Concluída');
    expect(tomStatusOrdem('CANCELADA')).toBe('neutral');
    expect(rotuloStatusOrdem('OUTRO')).toBe('OUTRO');
    expect(tomStatusOrdem('OUTRO')).toBe('neutral');
  });

  it('checklist inicial vem da ordem ou do plano', () => {
    expect(checklistInicial(null, ['Trocar óleo', ' ', 'Limpar'])).toEqual([{ item: 'Trocar óleo', ok: false }, { item: 'Limpar', ok: false }]);
    expect(checklistInicial([{ item: 'A', ok: true }, 'B'], ['X'])).toEqual([{ item: 'A', ok: true }, { item: 'B', ok: false }]);
    expect(checklistInicial([], [])).toEqual([]);
  });

  it('move e limpa itens do checklist', () => {
    expect(moverItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moverItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    const l = ['a', 'b'];
    expect(moverItem(l, 0, -1)).toBe(l);
    expect(limparChecklist([' a ', '', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('OS previstas na quebra: apontamento aberto no centro ou centro atual', () => {
    const r = osPrevistasNaQuebra(
      { id: 'c1', nome: 'Torno' },
      [{ centroId: 'c1', os: { id: 'o2', numero: 'OS-2', status: 'EM_EXECUCAO' } }, { centroId: 'c2', os: { id: 'o9', numero: 'OS-9' } }],
      [{ id: 'o1', numero: 'OS-1', status: 'EM_EXECUCAO', centroAtual: 'Torno' }, { id: 'o2', numero: 'OS-2', status: 'EM_EXECUCAO', centroAtual: 'Torno' }, { id: 'o3', numero: 'OS-3', status: 'PAUSADA', centroAtual: 'Torno' }]
    );
    expect(r.map((x) => x.numero)).toEqual(['OS-1', 'OS-2']);
  });

  it('centros parados: quebra em execução ou preventiva do dia', () => {
    const base = { paradaId: 'p', bloqueiaAgenda: false, prevista: null } as Partial<Ordem>;
    const ordens = [
      { ...base, centroId: 'a', tipo: 'CORRETIVA', status: 'EM_EXECUCAO' },
      { ...base, centroId: 'a', tipo: 'CORRETIVA', status: 'EM_EXECUCAO' },
      { ...base, centroId: 'b', tipo: 'PREVENTIVA', status: 'ABERTA', bloqueiaAgenda: true, prevista: '2026-10-20' },
      { ...base, centroId: 'c', tipo: 'PREVENTIVA', status: 'ABERTA', bloqueiaAgenda: true, prevista: '2026-10-27' },
      { ...base, centroId: 'd', tipo: 'CORRETIVA', status: 'CONCLUIDA' }
    ] as Ordem[];
    expect(centrosParados(ordens, '2026-10-20')).toBe(2);
  });

  it('voz dos conflitos', () => {
    expect(mensagemConflito('ORDEM_COM_CUSTOS', 'x')).toMatch(/Remova esses custos/);
    expect(mensagemConflito('TITULO_COM_BAIXA', 'x')).toMatch(/Estorne a baixa/);
    expect(mensagemConflito('OUTRO', 'original')).toBe('original');
  });

  it('teto do eixo do gráfico', () => {
    expect(tetoEixo(0)).toBe(1);
    expect(tetoEixo(812)).toBe(1000);
    expect(tetoEixo(1400)).toBe(2000);
    expect(tetoEixo(2300)).toBe(2500);
  });
});
