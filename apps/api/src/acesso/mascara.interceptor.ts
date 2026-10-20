import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { Sessao } from '../comum/sessao';
import { temPermissao } from './permissoes';

const CAMPOS = new Set(['custoHora', 'rateioHora', 'cheioHora', 'especificoHora', 'marginalHora', 'custoHoraVigente', 'composicaoHora', 'cheioMedio', 'precoHora']);
const DE_CENTRO = ['cheioHora', 'especificoHora'];

const SALARIO = ['salario', 'encargos', 'encargosPercentual', 'beneficios', 'custoMensal', 'custoHora'];

/** Sem `rh.ver_salario`: objetos de colaborador (os que têm `salario`) perdem salário, encargos, benefícios e custo. */
export function mascararSalario(valor: unknown): { valor: unknown; mascarou: boolean } {
  let mascarou = false;
  const andar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(andar);
    if (!v || typeof v !== 'object' || v instanceof Date) return v;
    const o = v as Record<string, unknown>;
    const pessoa = 'salario' in o;
    return Object.fromEntries(
      Object.entries(o).map(([k, x]) => {
        if (pessoa && SALARIO.includes(k) && x !== null && x !== undefined) {
          mascarou = true;
          return [k, null];
        }
        return [k, andar(x)];
      })
    );
  };
  return { valor: andar(valor), mascarou };
}

/** Quem não tem `custo.ver_custo_hora` recebe os campos de custo-hora como null e `mascarado: true`. */
export function mascarar(valor: unknown): { valor: unknown; mascarou: boolean } {
  let mascarou = false;
  const andar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(andar);
    if (!v || typeof v !== 'object' || v instanceof Date) return v;
    const o = v as Record<string, unknown>;
    const centro = DE_CENTRO.some((k) => k in o);
    const pessoa = 'salario' in o;
    const saida: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) {
      if (!pessoa && (CAMPOS.has(k) || (centro && (k === 'explicacao' || k === 'composicao'))) && x !== null && x !== undefined) {
        saida[k] = null;
        mascarou = true;
      } else saida[k] = andar(x);
    }
    return saida;
  };
  return { valor: andar(valor), mascarou };
}

@Injectable()
export class MascaraInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const sessao: Sessao | undefined = ctx.switchToHttp().getRequest().sessao;
    if (!sessao) return next.handle();
    const custo = !temPermissao(sessao.permissoes, 'custo.ver_custo_hora');
    const salario = !temPermissao(sessao.permissoes, 'rh.ver_salario');
    if (!custo && !salario) return next.handle();
    return next.handle().pipe(
      map((corpo) => {
        const a = salario ? mascararSalario(corpo) : { valor: corpo, mascarou: false };
        const b = custo ? mascarar(a.valor) : { valor: a.valor, mascarou: false };
        return (a.mascarou || b.mascarou) && b.valor && typeof b.valor === 'object' && !Array.isArray(b.valor) ? { ...(b.valor as object), mascarado: true } : b.valor;
      })
    );
  }
}
