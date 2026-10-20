import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
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

  @Dec({ naoNegativo: true, opcional: true })
  salario?: string;

  @Dec({ naoNegativo: true, opcional: true })
  encargos?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Dec({ fracao: true })
  encargosPercentual?: string | null;

  @IsOptional() @IsString()
  turno?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  diasSemana?: number[];

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
