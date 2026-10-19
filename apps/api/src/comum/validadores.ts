import { registerDecorator, ValidationOptions } from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { IsOptional } from 'class-validator';

const RE = /^-?\d+(\.\d+)?$/;

/** Número decimal como texto ("117.78") ou número; opcionalmente fração de 0 a 1 ou não negativo. */
export function Dec(opcoes: { fracao?: boolean; naoNegativo?: boolean; opcional?: boolean } = {}, v?: ValidationOptions) {
  const validador: PropertyDecorator = (alvo, prop) =>
    registerDecorator({
      name: opcoes.fracao ? 'fracao' : opcoes.naoNegativo ? 'naoNegativo' : 'decimal',
      target: alvo.constructor,
      propertyName: String(prop),
      options: v,
      validator: {
        validate(valor: unknown) {
          if (typeof valor !== 'string' && typeof valor !== 'number') return false;
          const s = String(valor).trim();
          if (!RE.test(s) || !Number.isFinite(Number(s))) return false;
          const n = Number(s);
          if (opcoes.fracao) return n >= 0 && n <= 1;
          if (opcoes.naoNegativo) return n >= 0;
          return true;
        }
      }
    });
  return opcoes.opcional ? applyDecorators(IsOptional(), validador) : validador;
}
