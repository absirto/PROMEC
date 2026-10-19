import { PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

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
}

export class AtualizarClienteDto extends PartialType(CriarClienteDto) {}
