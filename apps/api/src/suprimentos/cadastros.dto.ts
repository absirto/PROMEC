import { PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length, Min, ValidateIf } from 'class-validator';
import { Dec } from '../comum/validadores';

export const TIPOS_ITEM = ['MATERIA_PRIMA', 'PECA_REPOSICAO', 'INSUMO', 'FERRAMENTA_GERAL', 'FERRAMENTA_ESPECIFICA', 'PRODUTO_ACABADO', 'SERVICO_EXTERNO'] as const;

export class ItemDto {
  @IsString() @IsNotEmpty()
  codigo: string;

  @IsString() @IsNotEmpty()
  descricao: string;

  @IsIn(TIPOS_ITEM)
  tipo: (typeof TIPOS_ITEM)[number];

  @IsString() @IsNotEmpty()
  unidadeCompra: string;

  @IsString() @IsNotEmpty()
  unidadeConsumo: string;

  @Dec({ naoNegativo: true, opcional: true }) fatorConversao?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined) @Dec({ naoNegativo: true }) pesoPorMetroKg?: string | null;
  @Dec({ naoNegativo: true, opcional: true }) custoMedio?: string;
  @ValidateIf((_, v) => v !== null && v !== undefined) @Dec({ naoNegativo: true }) precoVenda?: string | null;
  @ValidateIf((_, v) => v !== null && v !== undefined) @Dec({ fracao: true }) margemPeca?: string | null;
  @Dec({ naoNegativo: true, opcional: true }) estoqueMinimo?: string;
  @Dec({ naoNegativo: true, opcional: true }) estoqueMaximo?: string;

  @IsOptional() @IsString()
  fornecedorPreferidoId?: string | null;

  @IsOptional() @IsBoolean()
  rastreavel?: boolean;

  @IsOptional() @IsString()
  categoriaDespesa?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class AtualizarItemDto extends PartialType(ItemDto) {}

export class FornecedorDto {
  @IsIn(['PF', 'PJ'])
  tipo: 'PF' | 'PJ';

  @IsString() @IsNotEmpty()
  documento: string;

  @IsString() @IsNotEmpty()
  nome: string;

  @IsOptional() @IsString() fantasia?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() @Length(0, 2) uf?: string;

  @IsOptional() @IsArray() @IsIn(TIPOS_ITEM, { each: true })
  categorias?: string[];

  @IsOptional() @IsInt() @Min(0)
  prazoMedioDias?: number;

  @IsOptional() @IsString()
  condicaoPagamento?: string;

  @IsOptional() @IsIn(['ATIVO', 'BLOQUEADO', 'INATIVO'])
  status?: 'ATIVO' | 'BLOQUEADO' | 'INATIVO';

  @IsOptional() @IsString()
  observacoes?: string;
}

export class AtualizarFornecedorDto extends PartialType(FornecedorDto) {}
