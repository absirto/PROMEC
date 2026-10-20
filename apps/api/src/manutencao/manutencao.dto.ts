import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';

export class PlanoDto {
  @IsString() @IsNotEmpty() centroId: string;
  @IsString() @IsNotEmpty() nome: string;
  @IsIn(['HORAS', 'CALENDARIO']) tipo: 'HORAS' | 'CALENDARIO';
  @Dec({ naoNegativo: true, opcional: true }) intervaloHoras?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervaloDias?: number;
  @Dec({ naoNegativo: true, opcional: true }) duracaoHoras?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) checklist?: string[];
  @IsOptional() @IsDateString() ultimaExecucao?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class AtualizarPlanoDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsIn(['HORAS', 'CALENDARIO']) tipo?: 'HORAS' | 'CALENDARIO';
  @Dec({ naoNegativo: true, opcional: true }) intervaloHoras?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervaloDias?: number;
  @Dec({ naoNegativo: true, opcional: true }) duracaoHoras?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) checklist?: string[];
  @IsOptional() @IsDateString() ultimaExecucao?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class OrdemDto {
  @IsString() @IsNotEmpty() centroId: string;
  @IsIn(['PREVENTIVA', 'CORRETIVA']) tipo: 'PREVENTIVA' | 'CORRETIVA';
  @IsOptional() @IsIn(['INTERNA', 'EXTERNA']) execucao?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsDateString() prevista?: string;
  @IsOptional() @IsBoolean() bloqueiaAgenda?: boolean;
  @IsOptional() @IsString() planoId?: string;
}

export class AtualizarOrdemDto {
  @IsOptional() @IsString() @IsNotEmpty() descricao?: string;
  @IsOptional() @IsDateString() prevista?: string;
  @IsOptional() @IsIn(['INTERNA', 'EXTERNA']) execucao?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsBoolean() bloqueiaAgenda?: boolean;
}

export class ItemChecklistDto {
  @IsString() @IsNotEmpty() item: string;
  @IsBoolean() ok: boolean;
}

export class ConcluirOrdemDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ItemChecklistDto) checklist?: ItemChecklistDto[];
  @IsOptional() @IsString() observacao?: string;
  @Dec({ naoNegativo: true, opcional: true }) horasParado?: string;
}

export class CancelarOrdemDto {
  @IsString() @IsNotEmpty() motivo: string;
}

export class CustoOrdemDto {
  @IsIn(['PECA', 'MAO_DE_OBRA', 'TERCEIRO']) tipo: 'PECA' | 'MAO_DE_OBRA' | 'TERCEIRO';
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() itemId?: string;
  @Dec({ naoNegativo: true, opcional: true }) quantidade?: string;
  @IsOptional() @IsString() localId?: string;
  @IsOptional() @IsString() loteId?: string;
  @IsOptional() @IsString() colaboradorId?: string;
  @Dec({ naoNegativo: true, opcional: true }) horas?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @Dec({ naoNegativo: true, opcional: true }) valor?: string;
  @IsOptional() @IsDateString() vencimento?: string;
}

export class QuebraDto {
  @IsString() @IsNotEmpty() centroId: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsString() inicio?: string;
}

export class CentroPropostaDto {
  @IsString() @IsNotEmpty() centroId: string;
  @Dec({ naoNegativo: true, opcional: true }) manutencao?: string;
  @Dec({ naoNegativo: true, opcional: true }) horasExpediente?: string;
}

export class AceitarPropostaDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CentroPropostaDto) centros: CentroPropostaDto[];
}
