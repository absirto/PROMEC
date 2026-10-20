import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';

export class LocalDto {
  @IsString() @IsNotEmpty()
  nome: string;

  @IsIn(['ALMOXARIFADO', 'PECAS', 'MATERIA_PRIMA', 'FERRAMENTARIA'])
  tipo: 'ALMOXARIFADO' | 'PECAS' | 'MATERIA_PRIMA' | 'FERRAMENTARIA';

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class AtualizarLocalDto extends PartialType(LocalDto) {}

export class CertificadoDto {
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() corrida?: string;
  @IsOptional() @IsString() norma?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class NovoLoteDto {
  @IsString() @IsNotEmpty()
  codigo: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => CertificadoDto)
  certificado?: CertificadoDto;
}

export const TIPOS_MOVIMENTO_MANUAL = ['ENTRADA_AVULSA', 'SAIDA_CENTRO', 'AJUSTE', 'TRANSFERENCIA', 'PERDA', 'DEVOLUCAO'] as const;

export class MovimentoDto {
  @IsIn(TIPOS_MOVIMENTO_MANUAL)
  tipo: (typeof TIPOS_MOVIMENTO_MANUAL)[number];

  @IsString() @IsNotEmpty()
  itemId: string;

  @IsString() @IsNotEmpty()
  localId: string;

  @Dec()
  quantidade: string;

  @Dec({ naoNegativo: true, opcional: true }) custoUnitario?: string;
  @IsOptional() @IsString() centroId?: string;
  @IsOptional() @IsString() localDestinoId?: string;
  @IsOptional() @IsString() osId?: string;
  @IsOptional() @IsString() loteId?: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => NovoLoteDto)
  lote?: NovoLoteDto;

  @IsOptional() @IsString() justificativa?: string;
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class ItemContadoDto {
  @IsString() @IsNotEmpty()
  itemId: string;

  @IsOptional() @IsString()
  loteId?: string;

  @Dec({ naoNegativo: true })
  contado: string;
}

export class InventarioDto {
  @IsString() @IsNotEmpty()
  localId: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemContadoDto)
  itens: ItemContadoDto[];

  @IsOptional() @IsString()
  observacao?: string;
}

export class ConsumoDto {
  @IsString() @IsNotEmpty()
  itemId: string;

  @Dec({ naoNegativo: true })
  quantidade: string;

  @IsOptional() @IsString() loteId?: string;
  @IsOptional() @IsString() custoId?: string;
  @IsOptional() @IsString() localId?: string;
  @IsOptional() @IsString() justificativa?: string;
}
