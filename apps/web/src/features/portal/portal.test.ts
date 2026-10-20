import { describe, expect, it } from 'vitest';
import { curvaLote, diasAte, etapasOS, faixaNps, gruposComposicao, linkWhatsapp, mensagemErro, percentuais } from './portal';

describe('percentuais', () => {
  it('soma 100 com maiores restos', () => {
    expect(percentuais([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentuais([115.15, 678.12])).toEqual([15, 85]);
  });
  it('total zero vira zeros', () => {
    expect(percentuais([0, 0])).toEqual([0, 0]);
  });
});

describe('gruposComposicao', () => {
  it('normaliza objeto na ordem fixa, com rótulos e sem grupos zerados', () => {
    const g = gruposComposicao({ composicao: { terceiros: 0, maoDeObra: '678.12', material: { valor: '115.15' } } });
    expect(g.map((x) => x.chave)).toEqual(['material', 'maoDeObra']);
    expect(g.map((x) => x.rotulo)).toEqual(['Material e peças', 'Mão de obra e máquina']);
    expect(g.reduce((a, x) => a + x.pct, 0)).toBe(100);
    expect(g[1]!.valor).toBeCloseTo(678.12);
  });

  it('aceita lista e soma chaves do mesmo grupo', () => {
    const g = gruposComposicao({
      composicao: [
        { grupo: 'TERCEIROS', valor: 30 },
        { grupo: 'FRETE', valor: 20 },
        { grupo: 'MATERIAL_PECAS', valor: 50 },
        { grupo: 'MAO_DE_OBRA_MAQUINA', valor: 100 }
      ]
    });
    expect(g.map((x) => [x.chave, x.valor, x.pct])).toEqual([
      ['material', 50, 25],
      ['maoDeObra', 100, 50],
      ['terceiros', 50, 25]
    ]);
  });

  it('sem composição devolve lista vazia', () => {
    expect(gruposComposicao({})).toEqual([]);
    expect(gruposComposicao(null)).toEqual([]);
  });
});

describe('curvaLote', () => {
  it('ordena por quantidade e marca o lote atual', () => {
    const c = curvaLote({ lote: 10, curvaLote: [{ quantidade: 100, precoUnitario: '33.55' }, { quantidade: 10, precoUnitario: '79.33' }, { quantidade: 50, precoUnitario: '38.64' }] });
    expect(c.map((p) => p.quantidade)).toEqual([10, 50, 100]);
    expect(c[0]!.atual).toBe(true);
  });
});

describe('ajudantes', () => {
  it('mensagens de erro na voz do cliente', () => {
    expect(mensagemErro('LINK_INVALIDO')).toMatch(/novo/);
    expect(mensagemErro('XYZ')).toMatch(/vendedor/);
  });
  it('dias até a validade', () => {
    expect(diasAte('2026-10-26', new Date(2026, 9, 12))).toBe(14);
    expect(diasAte(null)).toBeNull();
  });
  it('link do WhatsApp com DDI', () => {
    expect(linkWhatsapp('(47) 99999-0000')).toBe('https://wa.me/5547999990000');
    expect(linkWhatsapp('')).toBeNull();
  });
  it('faixa do NPS', () => {
    expect([0, 6, 7, 8, 9, 10].map(faixaNps)).toEqual(['detrator', 'detrator', 'neutro', 'neutro', 'promotor', 'promotor']);
  });
  it('etapas: a primeira não concluída é a atual', () => {
    const e = etapasOS({ etapas: [{ rotulo: 'Aprovado', data: '2026-10-13' }, { rotulo: 'Material', concluida: true }, { rotulo: 'Máquina' }, { rotulo: 'Inspeção' }] });
    expect(e.map((x) => x.estado)).toEqual(['feita', 'feita', 'atual', 'futura']);
  });
  it('formato da API: a última etapa alcançada é a atual; entregue fecha tudo', () => {
    const etapas = [{ etapa: 'APROVADO', rotulo: 'Aprovado', data: '2026-10-19', concluida: true }, { etapa: 'NA_MAQUINA', rotulo: 'Na máquina', data: '2026-10-20', concluida: true }, { etapa: 'INSPECAO', rotulo: 'Inspeção', data: null, concluida: false }];
    expect(etapasOS({ status: 'EM_EXECUCAO', etapas }).map((x) => x.estado)).toEqual(['feita', 'atual', 'futura']);
    expect(etapasOS({ status: 'ENTREGUE', entregueEm: '2026-10-21', etapas }).map((x) => x.estado)).toEqual(['feita', 'feita', 'feita']);
  });
});
