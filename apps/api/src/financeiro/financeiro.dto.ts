import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Dec } from '../comum/validadores';
import { CATEGORIAS } from '../custo-fixo/custo-fixo.dto';

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ContaDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsIn(['BANCO', 'CAIXA']) tipo: 'BANCO' | 'CAIXA';
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() numero?: string;
  @Dec({ opcional: true }) saldoInicial?: string;
  @IsOptional() @IsDateString() dataSaldoInicial?: string;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

export class AtualizarContaDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsIn(['BANCO', 'CAIXA']) tipo?: 'BANCO' | 'CAIXA';
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() numero?: string;
  @Dec({ opcional: true }) saldoInicial?: string;
  @IsOptional() @IsDateString() dataSaldoInicial?: string;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

export class TransferenciaDto {
  @IsString() @IsNotEmpty() origemId: string;
  @IsString() @IsNotEmpty() destinoId: string;
  @Dec({ naoNegativo: true }) valor: string;
  @IsDateString() data: string;
  @IsOptional() @IsString() observacao?: string;
}

export class CustoDiretoDto {
  @IsString() @IsNotEmpty() centroTrabalhoId: string;
  @IsIn(['manutencao', 'insumos', 'energia', 'outros']) componente: 'manutencao' | 'insumos' | 'energia' | 'outros';
}

export class CentroCustoDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsIn(['FIXO', 'VARIAVEL']) tipo: 'FIXO' | 'VARIAVEL';
  @IsOptional() @IsBoolean() compoeCustoFixo?: boolean;
  @IsOptional() @IsIn(CATEGORIAS) categoriaCustoFixo?: string | null;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CustoDiretoDto) custoDiretoCentro?: CustoDiretoDto | null;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class AtualizarCentroCustoDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsIn(['FIXO', 'VARIAVEL']) tipo?: 'FIXO' | 'VARIAVEL';
  @IsOptional() @IsBoolean() compoeCustoFixo?: boolean;
  @ValidateIf((_, v) => v !== null && v !== undefined) @IsIn(CATEGORIAS) categoriaCustoFixo?: string | null;
  @ValidateIf((_, v) => v !== null && v !== undefined) @IsObject() @ValidateNested() @Type(() => CustoDiretoDto) custoDiretoCentro?: CustoDiretoDto | null;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class PessoaDto {
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() fornecedorId?: string;
  @IsOptional() @IsString() nome?: string;
}

export class TituloDto {
  @IsIn(['RECEBER', 'PAGAR']) tipo: 'RECEBER' | 'PAGAR';
  @IsObject() @ValidateNested() @Type(() => PessoaDto) pessoa: PessoaDto;
  @IsString() @IsNotEmpty() descricao: string;
  @IsString() @IsNotEmpty() centroCustoId: string;
  @IsOptional() @Matches(COMPETENCIA) competencia?: string;
  @Dec({ naoNegativo: true }) valor: string;
  @IsOptional() @IsString() condicao?: string;
  @IsOptional() @IsDateString() dataBase?: string;
  @IsOptional() @IsDateString() vencimento?: string;
  @IsOptional() @IsString() documentoFiscal?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class AtualizarTituloDto {
  @IsOptional() @IsDateString() vencimento?: string;
  @IsOptional() @Matches(COMPETENCIA) competencia?: string;
  @IsOptional() @IsString() centroCustoId?: string;
  @IsOptional() @IsString() documentoFiscal?: string | null;
  @IsOptional() @IsString() observacao?: string | null;
}

export class BaixaDto {
  @IsDateString() data: string;
  @Dec({ naoNegativo: true }) valor: string;
  @IsString() @IsNotEmpty() contaId: string;
  @Dec({ naoNegativo: true, opcional: true }) multa?: string;
  @Dec({ naoNegativo: true, opcional: true }) juros?: string;
  @Dec({ naoNegativo: true, opcional: true }) desconto?: string;
  @IsOptional() @IsString() observacao?: string;
}

export class BaixaLoteDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) tituloIds: string[];
  @IsDateString() data: string;
  @IsString() @IsNotEmpty() contaId: string;
}

export class MotivoDto {
  @IsString() @IsNotEmpty() motivo: string;
}

export class RenegociarDto {
  @IsString() @IsNotEmpty() condicao: string;
  @IsDateString() dataBase: string;
  @Dec({ naoNegativo: true, opcional: true }) valor?: string;
}

export class RecorrenciaDto {
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsString() fornecedorId?: string | null;
  @IsString() @IsNotEmpty() centroCustoId: string;
  @Dec({ naoNegativo: true }) valor: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) diaVencimento: number;
  @IsString() @Matches(/^\d{4}-\d{2}(-\d{2})?$/) inicio: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}(-\d{2})?$/) fim?: string | null;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

export class AtualizarRecorrenciaDto {
  @IsOptional() @IsString() @IsNotEmpty() descricao?: string;
  @IsOptional() @IsString() fornecedorId?: string | null;
  @IsOptional() @IsString() centroCustoId?: string;
  @Dec({ naoNegativo: true, opcional: true }) valor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) diaVencimento?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}(-\d{2})?$/) inicio?: string;
  @ValidateIf((_, v) => v !== null && v !== undefined) @IsString() @Matches(/^\d{4}-\d{2}(-\d{2})?$/) fim?: string | null;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

export class CompetenciaDto {
  @Matches(COMPETENCIA) competencia: string;
}
