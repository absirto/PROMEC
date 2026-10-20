import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mergeMap } from 'rxjs';
import { Sessao } from '../comum/sessao';
import { PrismaService } from '../prisma/prisma.service';
import { Db } from '../tabelas-custos/entrada';

const RAIZ: Record<string, string> = {
  'tabelas-custos': 'TabelaCustos',
  'custo-fixo': 'CustoFixo',
  'centros-trabalho': 'CentroTrabalho',
  colaboradores: 'Colaborador',
  parametros: 'Parametros',
  orcamentos: 'Orcamento',
  'ordens-servico': 'OrdemServico',
  usuarios: 'Usuario',
  perfis: 'Perfil',
  itens: 'Item',
  fornecedores: 'Fornecedor',
  clientes: 'Cliente'
};
const SUB: Record<string, string> = {
  titulos: 'Titulo',
  'baixas-lote': 'Titulo',
  contas: 'ContaFinanceira',
  transferencias: 'Transferencia',
  'centros-custo': 'CentroCusto',
  recorrencias: 'Recorrencia',
  comissoes: 'Comissao',
  rotina: 'Rotina',
  pedidos: 'Pedido',
  requisicoes: 'Requisicao',
  cotacoes: 'Cotacao',
  movimentos: 'Movimento',
  inventarios: 'Inventario',
  locais: 'LocalEstoque',
  planos: 'PlanoInspecao',
  ncs: 'NaoConformidade',
  garantias: 'Garantia'
};
const COM_SUB = new Set(['financeiro', 'compras', 'estoque', 'qualidade']);
const PESADOS = new Set(['resultado', 'explicacao', 'curvaLote', 'historico', 'entrada', 'comparativo', 'apontamentos', 'consumos', 'baixas', 'linhas']);
const SIGILO = /senha|token/i;

/** Estado gravado: sem segredos e sem os blocos calculados mais pesados. */
export function enxugar(v: unknown, nivel = 0): unknown {
  if (Array.isArray(v)) return nivel > 2 ? `[${v.length} itens]` : v.slice(0, 50).map((x) => enxugar(x, nivel + 1));
  if (!v || typeof v !== 'object' || v instanceof Date) return v;
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !SIGILO.test(k) && !(nivel === 0 && PESADOS.has(k)))
      .map(([k, x]) => [k, enxugar(x, nivel + 1)])
  );
}

export async function auditar(
  db: Db,
  a: { tenantId: string; usuarioId?: string | null; entidade: string; entidadeId?: string | null; acao: string; rota?: string; depois?: unknown; antes?: unknown }
) {
  const anterior =
    a.antes === undefined && a.entidadeId
      ? await db.auditLog.findFirst({ where: { tenantId: a.tenantId, entidade: a.entidade, entidadeId: a.entidadeId }, orderBy: { data: 'desc' } })
      : null;
  const json = (x: unknown) => (x === undefined || x === null ? Prisma.DbNull : (JSON.parse(JSON.stringify(enxugar(x))) as Prisma.InputJsonValue));
  await db.auditLog.create({
    data: {
      tenantId: a.tenantId,
      usuarioId: a.usuarioId ?? null,
      entidade: a.entidade,
      entidadeId: a.entidadeId ?? null,
      acao: a.acao,
      rota: a.rota,
      antes: a.antes !== undefined ? json(a.antes) : anterior?.depois ? (anterior.depois as Prisma.InputJsonValue) : Prisma.DbNull,
      depois: json(a.depois)
    }
  });
}

/** Registra criar, alterar, excluir e ações de estado das rotas auditadas; o "antes" é o último estado registrado. */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const sessao: Sessao | undefined = req.sessao;
    if (req.method === 'GET' || !sessao) return next.handle();
    const caminho: string[] = String(req.route?.path ?? req.path)
      .replace(/^\/?api\/v1\/?/, '')
      .split('/')
      .filter(Boolean);
    const [raiz, segundo] = caminho;
    const entidade = COM_SUB.has(raiz) ? SUB[segundo] : RAIZ[raiz];
    if (!entidade) return next.handle();
    const literais = caminho.filter((p, i) => i > 0 && !p.startsWith(':') && !(COM_SUB.has(raiz) && i === 1));
    const temId = caminho.some((p) => p === ':id');
    const acao =
      req.method === 'DELETE'
        ? 'excluir'
        : req.method === 'PUT' || req.method === 'PATCH'
          ? literais.length && !temId ? literais[literais.length - 1] : 'alterar'
          : literais.length
            ? literais[literais.length - 1]
            : 'criar';
    if (acao === 'simular') return next.handle();
    return next.handle().pipe(
      mergeMap(async (corpo) => {
        const entidadeId = req.params?.id ?? (corpo && typeof corpo === 'object' && 'id' in corpo ? String((corpo as { id: unknown }).id) : null);
        await auditar(this.prisma, { tenantId: sessao.tenantId, usuarioId: sessao.id, entidade, entidadeId, acao, rota: `${req.method} ${req.originalUrl ?? req.url}`, depois: corpo });
        return corpo;
      })
    );
  }
}
