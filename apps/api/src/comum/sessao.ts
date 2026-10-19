import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Papel } from '@prisma/client';

export interface Sessao {
  id: string;
  tenantId: string;
  papel: Papel;
  nome: string;
}

export const PUBLICO = 'promec:publico';
export const PAPEIS = 'promec:papeis';

export const Publico = () => SetMetadata(PUBLICO, true);
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);

export const SessaoAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Sessao => ctx.switchToHttp().getRequest().sessao);
