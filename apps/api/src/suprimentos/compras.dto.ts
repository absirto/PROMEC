import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';
import { CertificadoDto } from './estoque.dto';

export class ItemQuantidadeDto {
  @IsString() @IsNotEmpty()
  itemId: string;

  @Dec({ naoNegativo: true })
  quantidade: string;
}

export class RequisicaoDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemQuantidadeDto)
  itens: ItemQuantidadeDto[];

  @IsOptional() @IsString() osId?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class CotacaoDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  requisicaoIds: string[];

  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  fornecedorIds: string[];
}

export class PrecoItemDto {
  @IsString() @IsNotEmpty()
  itemId: string;

  @Dec({ naoNegativo: true })
  precoUnitario: string;
}

export class RespostaDto {
  @IsString() @IsNotEmpty()
  fornecedorId: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PrecoItemDto)
  itens: PrecoItemDto[];

  @Dec({ naoNegativo: true, opcional: true })
  frete?: string;

  @Type(() => Number) @IsInt() @Min(0)
  prazoDias: number;
}

export class EscolherDto {
  @IsString() @IsNotEmpty()
  fornecedorId: string;

  @IsOptional() @IsString()
  justificativa?: string;
}

export class ItemPedidoDto {
  @IsString() @IsNotEmpty()
  itemId: string;

  @Dec({ naoNegativo: true })
  quantidade: string;

  @Dec({ naoNegativo: true })
  precoUnitario: string;
}

export class PedidoDto {
  @IsString() @IsNotEmpty()
  fornecedorId: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[];

  @Dec({ naoNegativo: true, opcional: true })
  frete?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  prazoDias?: number;

  @IsOptional() @IsString()
  observacao?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  requisicaoIds?: string[];
}

export class LoteRecebidoDto {
  @IsString() @IsNotEmpty()
  codigo: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => CertificadoDto)
  certificado?: CertificadoDto;
}

export class ItemRecebidoDto {
  @IsString() @IsNotEmpty()
  itemId: string;

  @Dec({ naoNegativo: true })
  quantidade: string;

  @Dec({ naoNegativo: true })
  precoUnitario: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => LoteRecebidoDto)
  lote?: LoteRecebidoDto;
}

export class RecebimentoDto {
  @IsString() @IsNotEmpty()
  localId: string;

  @IsOptional() @IsString()
  notaFiscal?: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemRecebidoDto)
  itens: ItemRecebidoDto[];

  @IsOptional() @IsString()
  observacao?: string;
}
