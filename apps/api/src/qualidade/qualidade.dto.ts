import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';

export class ItemPlanoDto {
  @IsOptional() @IsString() id?: string;

  @IsString() @IsNotEmpty()
  descricao: string;

  @IsIn(['DIMENSIONAL', 'VISUAL', 'SOLDA', 'CHECK'])
  tipo: 'DIMENSIONAL' | 'VISUAL' | 'SOLDA' | 'CHECK';

  @ValidateIf((o) => o.tipo === 'DIMENSIONAL') @Dec() nominal?: string;
  @ValidateIf((o) => o.tipo === 'DIMENSIONAL' && o.tolInferior !== undefined) @Dec() tolInferior?: string;
  @ValidateIf((o) => o.tipo === 'DIMENSIONAL' && o.tolSuperior !== undefined) @Dec() tolSuperior?: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @IsString() instrumento?: string;
}

export class PlanoDto {
  @IsString() @IsNotEmpty()
  nome: string;

  @IsIn(['OFICINA', 'USINAGEM', 'CALDEIRARIA'])
  segmento: 'OFICINA' | 'USINAGEM' | 'CALDEIRARIA';

  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsBoolean() exigeInspecao?: boolean;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemPlanoDto)
  itens: ItemPlanoDto[];
}

export class AtualizarPlanoDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsIn(['OFICINA', 'USINAGEM', 'CALDEIRARIA']) segmento?: 'OFICINA' | 'USINAGEM' | 'CALDEIRARIA';
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsBoolean() exigeInspecao?: boolean;

  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemPlanoDto)
  itens?: ItemPlanoDto[];
}

export const ORIGENS_NC = ['MATERIAL', 'PROCESSO', 'OPERADOR', 'PROJETO', 'FORNECEDOR'] as const;

export class NcDto {
  @IsIn(ORIGENS_NC)
  origem: (typeof ORIGENS_NC)[number];

  @IsString() @IsNotEmpty()
  descricao: string;

  @IsOptional() @IsString() osId?: string;
  @IsOptional() @IsString() centroId?: string;
  @IsOptional() @IsString() loteId?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsString() colaboradorId?: string;
}

export class TratarNcDto {
  @IsOptional() @IsString() causa?: string;
  @IsOptional() @IsString() acaoCorretiva?: string;
  @IsOptional() @IsString() responsavelId?: string;
  @IsOptional() @IsDateString() prazo?: string;
}

export class EncerrarNcDto {
  @IsBoolean()
  eficaz: boolean;
}

export class GarantiaDto {
  @IsString() @IsNotEmpty()
  osId: string;

  @IsString() @IsNotEmpty()
  relato: string;
}

export class DecidirGarantiaDto {
  @IsBoolean()
  procedente: boolean;

  @IsString() @IsNotEmpty()
  analise: string;
}
