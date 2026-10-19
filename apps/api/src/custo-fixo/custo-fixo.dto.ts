import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { Dec } from '../comum/validadores';

export const CATEGORIAS = [
  'agua', 'alarme', 'aluguel', 'contabilidade', 'luz', 'pessoalAdm', 'pessoalComercial', 'proLabore',
  'seguros', 'sistemas', 'tarifas', 'taxasBancarias', 'telefone', 'treinamentos', 'outros'
] as const;

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CriarLancamentoDto {
  @Matches(COMPETENCIA)
  competencia: string;

  @IsIn(CATEGORIAS)
  categoria: string;

  @IsOptional() @IsString()
  descricao?: string;

  @Dec({ naoNegativo: true })
  valor: string;
}

export class AtualizarLancamentoDto extends PartialType(CriarLancamentoDto) {}

export class CopiarDto {
  @Matches(COMPETENCIA)
  de: string;

  @Matches(COMPETENCIA)
  para: string;
}
