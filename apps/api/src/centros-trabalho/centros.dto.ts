import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';

export const TIPOS_CENTRO = ['maquina', 'automatica', 'box', 'bancada', 'celulaSolda', 'movel', 'maoDeObra', 'externa'] as const;
export const STATUS_CENTRO = ['ativo', 'manutencao', 'desativado'] as const;

export class OperadorCentroDto {
  @IsString() @IsNotEmpty()
  colaboradorId: string;

  @Dec({ fracao: true })
  alocacao: string;
}

export class CriarCentroDto {
  @IsString() @IsNotEmpty()
  codigo: string;

  @IsString() @IsNotEmpty()
  nome: string;

  @IsIn(TIPOS_CENTRO)
  tipo: string;

  @IsOptional() @IsIn(STATUS_CENTRO)
  status?: string;

  @Dec({ naoNegativo: true })
  horasExpediente: string;

  @Dec({ fracao: true })
  eficiencia: string;

  @Dec({ naoNegativo: true, opcional: true }) manutencao?: string;
  @Dec({ naoNegativo: true, opcional: true }) insumos?: string;
  @Dec({ naoNegativo: true, opcional: true }) outros?: string;
  @Dec({ naoNegativo: true, opcional: true }) valorAquisicao?: string;
  @Dec({ naoNegativo: true, opcional: true }) valorResidual?: string;

  @IsOptional() @IsInt() @Min(0)
  vidaUtilMeses?: number;

  @Dec({ naoNegativo: true, opcional: true }) potenciaKw?: string;
  @Dec({ fracao: true, opcional: true }) fatorCarga?: string;
  @Dec({ naoNegativo: true, opcional: true }) tarifaKwh?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Dec({ fracao: true })
  pesoManual?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Dec({ naoNegativo: true })
  areaM2?: string | null;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OperadorCentroDto)
  operadores?: OperadorCentroDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  diasSemana?: number[];
}

export class AtualizarCentroDto extends PartialType(CriarCentroDto) {}
