import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';
import { ETAPAS, MOTIVOS_PERDA, ORIGENS } from './crm-core';

const TIPOS_ATIVIDADE = ['LIGACAO', 'VISITA', 'MENSAGEM', 'EMAIL', 'TAREFA'] as const;

export class OportunidadeDto {
  @IsString() @IsNotEmpty() titulo: string;
  @IsOptional() @IsString() clienteId?: string | null;
  @IsOptional() @IsString() contato?: string;
  @IsOptional() @IsIn(ORIGENS) origem?: string;
  @IsOptional() @IsIn(ETAPAS) etapa?: 'LEAD' | 'CONTATO' | 'ORCAMENTO_ENVIADO' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';
  @Dec({ naoNegativo: true, opcional: true }) valorEstimado?: string;
  @IsOptional() @IsString() responsavelId?: string | null;
  @IsOptional() @IsString() orcamentoId?: string | null;
  @IsOptional() @IsString() observacao?: string;
}

export class AtualizarOportunidadeDto {
  @IsOptional() @IsString() @IsNotEmpty() titulo?: string;
  @IsOptional() @IsString() clienteId?: string | null;
  @IsOptional() @IsString() contato?: string;
  @IsOptional() @IsIn(ORIGENS) origem?: string;
  @Dec({ naoNegativo: true, opcional: true }) valorEstimado?: string;
  @IsOptional() @IsString() responsavelId?: string | null;
  @IsOptional() @IsString() orcamentoId?: string | null;
  @IsOptional() @IsString() observacao?: string;
}

export class MoverDto {
  @IsIn(ETAPAS) etapa: 'LEAD' | 'CONTATO' | 'ORCAMENTO_ENVIADO' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';
}

export class PerdaDto {
  @IsIn(MOTIVOS_PERDA) motivo: (typeof MOTIVOS_PERDA)[number];
  @IsOptional() @IsString() concorrente?: string;
  @Dec({ naoNegativo: true, opcional: true }) precoAceito?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class AtividadeDto {
  @IsIn(TIPOS_ATIVIDADE) tipo: string;
  @IsString() @IsNotEmpty() assunto: string;
  @IsDateString() data: string;
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() oportunidadeId?: string;
  @IsOptional() @IsString() orcamentoId?: string;
  @IsString() @IsNotEmpty() responsavelId: string;
  @IsOptional() @IsString() observacao?: string;
}

export class AtualizarAtividadeDto {
  @IsOptional() @IsIn(TIPOS_ATIVIDADE) tipo?: string;
  @IsOptional() @IsString() @IsNotEmpty() assunto?: string;
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() clienteId?: string | null;
  @IsOptional() @IsString() oportunidadeId?: string | null;
  @IsOptional() @IsString() orcamentoId?: string | null;
  @IsOptional() @IsString() responsavelId?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class ProximoPassoDto {
  @IsIn(TIPOS_ATIVIDADE) tipo: string;
  @IsDateString() data: string;
  @IsString() @IsNotEmpty() assunto: string;
}

export class ConcluirAtividadeDto {
  @IsString() @IsNotEmpty() resultado: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ProximoPassoDto) proximoPasso?: ProximoPassoDto;
}
