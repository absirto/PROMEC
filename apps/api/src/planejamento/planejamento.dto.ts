import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';

export class FilaDto {
  @IsArray() @IsString({ each: true })
  ordem: string[];
}

export class OperacaoPromessaDto {
  @IsString() @IsNotEmpty()
  centroId: string;

  @Dec({ naoNegativo: true })
  horas: string;
}

export class PromessaDto {
  @IsOptional() @IsString()
  orcamentoId?: string;

  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OperacaoPromessaDto)
  operacoes?: OperacaoPromessaDto[];
}

export class FeriadoDto {
  @IsDateString()
  data: string;

  @IsString() @IsNotEmpty()
  descricao: string;
}

export class ParadaDto {
  @IsDateString()
  inicio: string;

  @IsDateString()
  fim: string;

  @IsString() @IsNotEmpty()
  motivo: string;
}
