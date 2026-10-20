import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { Dec } from '../comum/validadores';

export class CriarClienteDto {
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

  @IsOptional() @IsString() @Length(0, 2)
  uf?: string;

  @IsOptional() @IsIn(['ATIVO', 'BLOQUEADO', 'INATIVO'])
  status?: 'ATIVO' | 'BLOQUEADO' | 'INATIVO';

  @IsOptional() @IsString() observacoes?: string;

  @IsOptional() @IsString()
  condicaoPagamento?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Dec({ naoNegativo: true })
  limiteCredito?: string | null;

  @IsOptional() @IsDateString()
  liberadoAte?: string;
}

export class AtualizarClienteDto extends PartialType(CriarClienteDto) {}
