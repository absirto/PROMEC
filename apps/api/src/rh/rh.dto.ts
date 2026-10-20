import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TIPOS_AUSENCIA } from './rh-core';

export class AusenciaDto {
  @IsString() @IsNotEmpty() colaboradorId: string;
  @IsIn(TIPOS_AUSENCIA) tipo: (typeof TIPOS_AUSENCIA)[number];
  @IsDateString() inicio: string;
  @IsDateString() fim: string;
  @IsOptional() @IsString() observacao?: string;
}

export class AtualizarAusenciaDto {
  @IsOptional() @IsIn(TIPOS_AUSENCIA) tipo?: (typeof TIPOS_AUSENCIA)[number];
  @IsOptional() @IsDateString() inicio?: string;
  @IsOptional() @IsDateString() fim?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class HabilitacaoDto {
  @IsString() @IsNotEmpty() colaboradorId: string;
  @IsString() @IsNotEmpty() centroId: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsDateString() emissao: string;
  @IsDateString() validade: string;
  @IsOptional() @IsString() documento?: string;
}

export class AtualizarHabilitacaoDto {
  @IsOptional() @IsString() @IsNotEmpty() descricao?: string;
  @IsOptional() @IsDateString() emissao?: string;
  @IsOptional() @IsDateString() validade?: string;
  @IsOptional() @IsString() documento?: string;
}
