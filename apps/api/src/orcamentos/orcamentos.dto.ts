import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';
import { TIPOS_LINHA } from './calculo';

export class LinhaDto {
  @IsIn(TIPOS_LINHA)
  tipo: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsOptional() @IsIn(['peca', 'lote'])
  base?: string;

  @IsOptional() @IsString()
  centroId?: string;

  @Dec({ naoNegativo: true, opcional: true }) quantidade?: string;
  @Dec({ naoNegativo: true, opcional: true }) custoUnitario?: string;
  @Dec({ naoNegativo: true, opcional: true }) comprimentoMm?: string;
  @Dec({ naoNegativo: true, opcional: true }) sobraMm?: string;
  @Dec({ naoNegativo: true, opcional: true }) pesoPorMetroKg?: string;
  @Dec({ naoNegativo: true, opcional: true }) precoKg?: string;
  @Dec({ naoNegativo: true, opcional: true }) custo?: string;
  @Dec({ naoNegativo: true, opcional: true }) custoHora?: string;
  @Dec({ naoNegativo: true, opcional: true }) rateioHora?: string;
  @Dec({ naoNegativo: true, opcional: true }) cicloHorasPorPeca?: string;
  @Dec({ naoNegativo: true, opcional: true }) setupHorasPorLote?: string;
  @Dec({ naoNegativo: true, opcional: true }) tempoPadraoHoras?: string;
  @Dec({ naoNegativo: true, opcional: true }) fatorDificuldade?: string;
  @Dec({ naoNegativo: true, opcional: true }) markup?: string;
  @Dec({ naoNegativo: true, opcional: true }) valor?: string;
  @Dec({ naoNegativo: true, opcional: true }) km?: string;
  @Dec({ naoNegativo: true, opcional: true }) valorKm?: string;
}

export class SimularDto {
  @IsOptional() @IsString()
  clienteId?: string;

  @IsOptional() @IsString()
  titulo?: string;

  @IsOptional() @IsIn(['OFICINA', 'USINAGEM', 'CALDEIRARIA'])
  segmento?: 'OFICINA' | 'USINAGEM' | 'CALDEIRARIA';

  @Type(() => Number) @IsInt() @Min(1)
  lote: number;

  @IsOptional() @IsDateString()
  validade?: string;

  @Dec({ fracao: true, opcional: true }) impostos?: string;
  @Dec({ fracao: true, opcional: true }) comissao?: string;
  @Dec({ fracao: true, opcional: true }) margemAlvo?: string;
  @Dec({ fracao: true, opcional: true }) margemMinima?: string;
  @Dec({ fracao: true, opcional: true }) desconto?: string;

  @IsOptional() @IsIn(['divisor', 'markup'])
  metodo?: 'divisor' | 'markup';

  @IsOptional() @IsString()
  observacoes?: string;

  @IsOptional() @IsString()
  tabelaCustosId?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => LinhaDto)
  linhas: LinhaDto[];
}

export class OrcamentoDto extends SimularDto {
  @IsString() @IsNotEmpty()
  clienteId: string;

  @IsString() @IsNotEmpty()
  titulo: string;
}

export class LiberarMargemDto {
  @IsString() @MinLength(5)
  justificativa: string;
}

export class RecusarDto {
  @IsString() @IsNotEmpty()
  motivo: string;
}
