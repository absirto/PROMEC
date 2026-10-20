import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';
import { CATEGORIAS_CUSTO } from './custo';

export const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'] as const;
export const MOTIVOS_PAUSA = ['FALTA_PECA', 'AGUARDANDO_CLIENTE', 'QUEBRA', 'FALTA_OPERADOR', 'OUTRO'] as const;

export class ConverterDto {
  @IsOptional() @IsDateString()
  prazo?: string;
}

export class OperacaoOsDto {
  @IsString() @IsNotEmpty()
  descricao: string;

  @IsString() @IsNotEmpty()
  centroId: string;

  @IsOptional() @IsString()
  colaboradorId?: string | null;

  @Dec({ naoNegativo: true })
  setupOrcadoHoras: string;

  @Dec({ naoNegativo: true })
  cicloOrcadoHorasPorPeca: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sequencia?: number;

  @IsOptional() @IsString()
  justificativa?: string;
}

export class AtualizarOperacaoDto extends PartialType(OperacaoOsDto) {}

export class CustoOsDto {
  @IsString() @IsNotEmpty()
  descricao: string;

  @IsIn(CATEGORIAS_CUSTO)
  categoria: string;

  @Dec({ naoNegativo: true, opcional: true })
  orcado?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Dec({ naoNegativo: true })
  real?: string | null;

  @IsOptional() @IsString()
  justificativa?: string;
}

export class AtualizarCustoDto extends PartialType(CustoOsDto) {}

export class CriarOsDto {
  @IsString() @IsNotEmpty()
  clienteId: string;

  @IsString() @IsNotEmpty()
  titulo: string;

  @IsIn(['OFICINA', 'USINAGEM', 'CALDEIRARIA'])
  segmento: 'OFICINA' | 'USINAGEM' | 'CALDEIRARIA';

  @Type(() => Number) @IsInt() @Min(1)
  lote: number;

  @IsDateString()
  prazo: string;

  @IsOptional() @IsIn(PRIORIDADES)
  prioridade?: (typeof PRIORIDADES)[number];

  @IsOptional() @IsObject()
  objeto?: Record<string, unknown>;

  @IsOptional() @IsString()
  observacoes?: string;

  @Dec({ naoNegativo: true })
  precoFinalLote: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => OperacaoOsDto)
  operacoes: OperacaoOsDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CustoOsDto)
  custos?: CustoOsDto[];
}

export class AtualizarOsDto {
  @IsOptional() @IsString() @IsNotEmpty()
  titulo?: string;

  @IsOptional() @IsDateString()
  prazo?: string;

  @IsOptional() @IsIn(PRIORIDADES)
  prioridade?: (typeof PRIORIDADES)[number];

  @IsOptional() @IsObject()
  objeto?: Record<string, unknown>;

  @IsOptional() @IsString()
  observacoes?: string;

  @IsOptional() @IsString()
  motivoReprogramacao?: string;

  @IsOptional() @IsString()
  planoInspecaoId?: string | null;
}

export class IniciarDto {
  @IsString() @IsNotEmpty()
  colaboradorId: string;

  @IsIn(['SETUP', 'PRODUCAO'])
  tipo: 'SETUP' | 'PRODUCAO';
}

export class PararDto {
  @IsOptional() @IsString()
  colaboradorId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  quantidadeBoa?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  refugo?: number;

  @IsOptional() @IsString()
  observacao?: string;

  @IsOptional() @IsBoolean()
  encerrarSetup?: boolean;

  @IsOptional() @IsBoolean()
  encerrarOperacao?: boolean;
}

export class PausarDto {
  @IsIn(MOTIVOS_PAUSA)
  motivo: (typeof MOTIVOS_PAUSA)[number];

  @IsOptional() @IsString()
  observacao?: string;

  @IsOptional() @IsString()
  itemId?: string;

  @Dec({ naoNegativo: true, opcional: true })
  quantidade?: string;
}

export class ItemInspecaoDto {
  @IsOptional() @IsString()
  planoItemId?: string;

  @IsString() @IsNotEmpty()
  descricao: string;

  @IsOptional() @IsString()
  esperado?: string;

  @IsOptional()
  medido?: string | number;

  @IsOptional() @IsBoolean()
  conforme?: boolean;
}

export class InspecaoDto {
  @IsOptional() @IsBoolean()
  aprovada?: boolean;

  @IsOptional() @IsString()
  inspetor?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemInspecaoDto)
  itens: ItemInspecaoDto[];

  @IsOptional() @IsString()
  observacao?: string;

  @IsOptional() @IsString()
  centroRetrabalhoId?: string;
}

export class EntregarDto {
  @IsString() @IsNotEmpty()
  recebidoPor: string;

  @IsOptional() @IsString()
  documento?: string;

  @IsOptional() @IsString()
  observacao?: string;
}

export class CancelarDto {
  @IsString() @IsNotEmpty()
  motivo: string;
}
