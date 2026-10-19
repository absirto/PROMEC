import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';

export class AlocacaoColaboradorDto {
  @IsString() @IsNotEmpty()
  centroId: string;

  @Dec({ fracao: true })
  alocacao: string;
}

export class CriarColaboradorDto {
  @IsString() @IsNotEmpty()
  nome: string;

  @IsOptional() @IsString()
  funcao?: string;

  @IsOptional() @IsIn(['CLT', 'PJ', 'HORISTA', 'SOCIO'])
  vinculo?: 'CLT' | 'PJ' | 'HORISTA' | 'SOCIO';

  @Dec({ naoNegativo: true })
  salario: string;

  @Dec({ naoNegativo: true, opcional: true })
  encargos?: string;

  @Dec({ naoNegativo: true, opcional: true })
  beneficios?: string;

  @Dec({ naoNegativo: true, opcional: true })
  jornadaHoras?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlocacaoColaboradorDto)
  alocacoes?: AlocacaoColaboradorDto[];
}

export class AtualizarColaboradorDto extends PartialType(CriarColaboradorDto) {}
