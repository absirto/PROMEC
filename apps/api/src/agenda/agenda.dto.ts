import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Dec } from '../comum/validadores';

export class AgendamentoDto {
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() nomeCliente?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() placa?: string;
  @IsOptional() @IsString() veiculo?: string;

  @IsString() @IsNotEmpty()
  servico: string;

  @IsString() @IsNotEmpty()
  centroId: string;

  @IsOptional() @IsString()
  colaboradorId?: string | null;

  @IsString() @IsNotEmpty()
  inicio: string;

  @Dec({ naoNegativo: true })
  duracaoHoras: string;

  @IsOptional() @IsString()
  observacao?: string;
}

export class AtualizarAgendamentoDto extends PartialType(AgendamentoDto) {}

export class ChegouDto {
  @IsOptional() @IsBoolean()
  abrirOs?: boolean;
}
