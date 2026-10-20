import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Dec } from '../comum/validadores';

export const CRITERIOS = ['horas', 'valorAtivo', 'area', 'faturamento', 'manual'] as const;
export const METODOS = ['divisor', 'markup'] as const;

export class ParametrosDto {
  @IsOptional() @IsString() @IsNotEmpty()
  nomeEmpresa?: string;

  @IsOptional() @IsIn(CRITERIOS)
  criterioRateio?: string;

  @IsOptional() @IsIn(METODOS)
  metodoPreco?: string;

  @Dec({ fracao: true, opcional: true })
  impostosPadrao?: string;

  @Dec({ fracao: true, opcional: true })
  comissaoPadrao?: string;

  @Dec({ fracao: true, opcional: true })
  margemAlvo?: string;

  @Dec({ fracao: true, opcional: true })
  margemMinima?: string;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  validadeOrcamentoDias?: number;

  @Dec({ naoNegativo: true, opcional: true })
  limiteServicoRapido?: string;

  @Dec({ naoNegativo: true, opcional: true })
  limiteAprovacaoCompra?: string;

  @IsOptional() @IsInt() @Min(0) @Max(3650)
  garantiaDias?: number;
}
