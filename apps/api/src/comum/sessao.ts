import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Papel } from '@prisma/client';

export interface Sessao {
  id: string;
  tenantId: string;
  papel: Papel;
  nome: string;
  permissoes: string[];
}

export const PUBLICO = 'promec:publico';
export const PAPEIS = 'promec:papeis';

export const MODULO = 'promec:modulo';
export const PERMISSAO = 'promec:permissao';
export const SEM_PERMISSAO = 'promec:sem-permissao';

export const Publico = () => SetMetadata(PUBLICO, true);
/** Módulo(s) da rota: GET exige `<modulo>.visualizar`, o resto `<modulo>.gerenciar` (basta um dos módulos). */
export const Modulo = (...modulos: string[]) => SetMetadata(MODULO, modulos);
/** Permissão explícita da rota (basta uma da lista); vence o módulo. */
export const Permissao = (...chaves: string[]) => SetMetadata(PERMISSAO, chaves);
/** Só exige login. */
export const SemPermissao = () => SetMetadata(SEM_PERMISSAO, true);
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);

export const SessaoAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Sessao => ctx.switchToHttp().getRequest().sessao);
