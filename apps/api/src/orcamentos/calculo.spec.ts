import { calcularTabelaCustos, reais } from '@promec/motor';
import { ErroApi } from '../comum/erros';
import { calcular, normalizarLinhas } from './calculo';

const centro = (id: string) => ({
  id,
  nome: id,
  tipo: 'maquina' as const,
  horasExpediente: 220,
  eficiencia: 0.75,
  maoDeObra: [{ nome: 'Operador', salario: 5000, encargos: 3200, beneficios: 0, alocacao: 1 }],
  manutencao: 700,
  insumos: 700,
  ativo: { valorAquisicao: 150000, vidaUtilMeses: 60 }
});
const tabela = calcularTabelaCustos({ custoFixoTotal: 22000, criterioRateio: 'horas', centros: [centro('torno'), centro('fresa'), centro('cu')] });
const p = { lote: 10, impostos: '0.14', comissao: '0', margemAlvo: '0.2', margemMinima: '0.15', desconto: '0.05', metodo: 'divisor' as const };

describe('cálculo do orçamento', () => {
  it('completa o custo-hora pelo centro e fecha a bucha em 793,27', () => {
    const { linhas, resultado } = calcular(
      [
        { tipo: 'material', descricao: 'Latão', quantidade: 1, custoUnitario: '8', ignorado: 'x' },
        { tipo: 'operacao', descricao: 'Torneamento', centroId: 'torno', cicloHorasPorPeca: '0.1', setupHorasPorLote: 3, custoHora: '1' }
      ],
      tabela,
      p
    );
    expect(linhas[0]).toEqual({ tipo: 'material', descricao: 'Latão', quantidade: '1', custoUnitario: '8' });
    expect(linhas[1]).toMatchObject({ custoHora: tabela.centros[0].cheioHora, rateioHora: tabela.centros[0].rateioHora });
    expect(reais(resultado.custoLote)).toBe('551.11');
    expect(reais(resultado.precoFinalLote)).toBe('793.27');
  });

  it('recusa centro fora da tabela e linha incompleta', () => {
    expect(() => calcular([{ tipo: 'operacao', descricao: 'X', centroId: 'outro', cicloHorasPorPeca: '1' }], tabela, p)).toThrow(ErroApi);
    expect(() => normalizarLinhas([{ tipo: 'material', descricao: 'Sem custo', quantidade: '1' }])).toThrow(/custoUnitario/);
  });
});
