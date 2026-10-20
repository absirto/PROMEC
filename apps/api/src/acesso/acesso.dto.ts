import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UsuarioDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() perfilId: string;
  @IsOptional() @IsString() colaboradorId?: string | null;
  @IsOptional() @IsString() telefone?: string;
}

export class AtualizarUsuarioDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsString() perfilId?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() colaboradorId?: string | null;
  @IsOptional() @IsString() telefone?: string;
}

export class TrocarSenhaDto {
  @IsString() @IsNotEmpty() senhaAtual: string;
  @IsString() @IsNotEmpty() novaSenha: string;
}

export class PerfilDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsArray() @IsString({ each: true }) permissoes: string[];
}

export class AtualizarPerfilDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissoes?: string[];
}
