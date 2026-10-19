import { ValidationError, ValidationPipe } from '@nestjs/common';
import { invalido } from './erros';

const TEXTOS: Record<string, string> = {
  isNotEmpty: 'é obrigatório',
  isDefined: 'é obrigatório',
  isString: 'precisa ser texto',
  isEmail: 'precisa ser um e-mail válido',
  isIn: 'tem um valor fora das opções aceitas',
  isEnum: 'tem um valor fora das opções aceitas',
  isInt: 'precisa ser um número inteiro',
  isBoolean: 'precisa ser verdadeiro ou falso',
  isArray: 'precisa ser uma lista',
  arrayMinSize: 'precisa ter pelo menos um item',
  isDateString: 'precisa ser uma data no formato AAAA-MM-DD',
  min: 'está abaixo do mínimo aceito',
  max: 'está acima do máximo aceito',
  minLength: 'está curto demais',
  maxLength: 'está longo demais',
  matches: 'está fora do formato esperado',
  decimal: 'precisa ser um número (use ponto como separador decimal)',
  fracao: 'precisa ser uma fração entre 0 e 1 (ex.: 0.15 para 15%)',
  naoNegativo: 'precisa ser um número igual ou maior que zero',
  nestedValidation: 'tem itens com formato inválido'
};

function achatar(erros: ValidationError[], prefixo = ''): { campo: string; mensagem: string }[] {
  return erros.flatMap((e) => {
    const campo = prefixo ? `${prefixo}.${e.property}` : e.property;
    const proprios = Object.keys(e.constraints ?? {})
      .filter((k) => k !== 'nestedValidation' || !e.children?.length)
      .map((k) => ({ campo, mensagem: `${campo} ${TEXTOS[k] ?? 'é inválido'}` }));
    return [...proprios.slice(0, 1), ...achatar(e.children ?? [], campo)];
  });
}

export const pipeValidacao = () =>
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (erros) => {
      const detalhes = achatar(erros);
      const lista = detalhes.slice(0, 3).map((d) => d.mensagem).join('; ');
      return invalido(`Alguns dados precisam de ajuste: ${lista}. Corrija e envie de novo.`, detalhes);
    }
  });
