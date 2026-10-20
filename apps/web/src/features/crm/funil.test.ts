import { describe, expect, it } from 'vitest';
import { agruparAgenda, funilDe, moverNaLista, normalizarIndicadores, taxaConversao, tomNps, totaisFunil, type Oportunidade } from './funil';

const op = (id: string, etapa: Oportunidade['etapa'], valorEstimado: string | number | null): Oportunidade => ({ id, titulo: id, etapa, valorEstimado });
const itens = [op('a', 'LEAD', '1500.50'), op('b', 'LEAD', 2000), op('c', 'NEGOCIACAO', '8000'), op('d', 'GANHO', '12000'), op('e', 'PERDIDO', null), op('f', 'GANHO', '0.1')];

describe('funil do CRM', () => {
  it('soma quantidade e valor por etapa', () => {
    const t = totaisFunil(itens);
    expect(t.LEAD).toEqual({ quantidade: 2, valor: 3500.5 });
    expect(t.CONTATO).toEqual({ quantidade: 0, valor: 0 });
    expect(t.GANHO).toEqual({ quantidade: 2, valor: 12000.1 });
    expect(t.PERDIDO).toEqual({ quantidade: 1, valor: 0 });
  });

  it('usa o funil do servidor e cai no cálculo quando falta', () => {
    expect(funilDe({ itens, total: 6 }).NEGOCIACAO).toEqual({ quantidade: 1, valor: 8000 });
    const srv = funilDe({ itens, total: 6, funil: { LEAD: { quantidade: '40', valor: '99000.00' } } });
    expect(srv.LEAD).toEqual({ quantidade: 40, valor: 99000 });
    expect(srv.GANHO.quantidade).toBe(2);
  });

  it('taxa de conversão sobre as decididas', () => {
    expect(taxaConversao(totaisFunil(itens))).toBeCloseTo(2 / 3);
    expect(taxaConversao(totaisFunil([op('x', 'LEAD', 1)]))).toBeNull();
  });

  it('mover ajusta o item e os totais', () => {
    const d = moverNaLista({ itens, total: 6 }, 'c', 'GANHO');
    expect(d.itens.find((x) => x.id === 'c')?.etapa).toBe('GANHO');
    expect(d.funil?.NEGOCIACAO).toEqual({ quantidade: 0, valor: 0 });
    expect(d.funil?.GANHO?.quantidade).toBe(3);
    expect(moverNaLista({ itens, total: 6 }, 'zz', 'GANHO').itens).toBe(itens);
  });

  it('agrupa a agenda por atrasadas, hoje e próximos dias', () => {
    const g = agruparAgenda(
      [
        { id: '1', tipo: 'LIGACAO', assunto: 'x', data: '2026-10-21' },
        { id: '2', tipo: 'VISITA', assunto: 'y', data: '2026-10-19' },
        { id: '3', tipo: 'TAREFA', assunto: 'z', data: '2026-10-20' }
      ],
      '2026-10-20'
    );
    expect(g.atrasadas.map((a) => a.id)).toEqual(['2']);
    expect(g.hoje.map((a) => a.id)).toEqual(['3']);
    expect(g.proximos.map((a) => a.id)).toEqual(['1']);
  });

  it('lê indicadores com formatos variados', () => {
    const i = normalizarIndicadores({
      porVendedor: [{ nome: 'Ana', ganhos: 3, total: 4 }],
      porSegmento: { USINAGEM: { taxa: 40, ganhos: 2, total: 5 } },
      motivosPerda: [{ motivo: 'PRAZO', quantidade: 1, valor: '500' }, { motivo: 'PRECO', quantidade: 3, valor: '9000' }],
      precoAceitoSobreOfertado: '0.87',
      cicloMedioDias: 12,
      nps: { valor: 42, promotores: 6, detratores: 1 }
    });
    expect(i.porVendedor[0]).toMatchObject({ rotulo: 'Ana', taxa: 0.75 });
    expect(i.porSegmento[0]).toMatchObject({ rotulo: 'Usinagem', taxa: 0.4 });
    expect(i.perdas[0]!.motivo).toBe('PRECO');
    expect(i.precoAceito).toBeCloseTo(0.87);
    expect(i.cicloDias).toBe(12);
    expect(i.nps?.valor).toBe(42);
    expect(normalizarIndicadores(null)).toMatchObject({ porVendedor: [], precoAceito: null, nps: null });
    expect(tomNps(-5)).toBe('bad');
  });
  it('lê o formato real da API', () => {
    const i = normalizarIndicadores({
      conversaoPorVendedor: [{ vendedor: { id: 'u1', nome: 'Paulo' }, decididos: 8, ganhos: 7, taxa: '0.875' }, { vendedor: null, decididos: 2, ganhos: 1, taxa: '0.5' }],
      conversaoPorSegmento: [{ segmento: 'OFICINA', decididos: 4, ganhos: 2, taxa: '0.5' }],
      motivosPerda: [{ motivo: 'PRECO', quantidade: 2, valor: '14600.00' }],
      precoAceitoSobreOfertado: '0.86', cicloMedioDias: '4', nps: '100', npsRespostas: 2
    });
    expect(i.porVendedor.map((v) => [v.rotulo, v.total, v.ganhos])).toEqual([['Paulo', 8, 7], ['Sem vendedor', 2, 1]]);
    expect(i.porSegmento[0]).toMatchObject({ rotulo: 'Oficina', taxa: 0.5 });
    expect(i.nps).toMatchObject({ valor: 100, respostas: 2 });
  });
});
