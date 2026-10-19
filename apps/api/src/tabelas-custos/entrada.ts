import { Prisma, PrismaClient, TabelaCustos } from '@prisma/client';
import type { CriterioRateio, EntradaTabela, ResultadoTabela, StatusCentro, TipoCentro } from '@promec/motor';
import { tt } from '../comum/decimal';

export type Db = PrismaClient | Prisma.TransactionClient;

export const resultadoDe = (t: Pick<TabelaCustos, 'resultado'>) => t.resultado as unknown as ResultadoTabela;
export const entradaDe = (t: Pick<TabelaCustos, 'entrada'>) => t.entrada as unknown as EntradaTabela;
export const json = (v: unknown) => v as Prisma.InputJsonValue;

export const buscarVigente = (db: Db, tenantId: string) => db.tabelaCustos.findFirst({ where: { tenantId, status: 'VIGENTE' } });

/** Foto dos cadastros atuais no formato de entrada do motor. */
export async function montarEntrada(db: Db, tenantId: string, competencia: string): Promise<EntradaTabela> {
  const [param, custoFixo, centros] = await Promise.all([
    db.parametros.findUnique({ where: { tenantId } }),
    db.lancamentoCustoFixo.aggregate({ where: { tenantId, competencia }, _sum: { valor: true } }),
    db.centroTrabalho.findMany({
      where: { tenantId, status: { not: 'desativado' } },
      orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }],
      include: { operadores: { where: { colaborador: { ativo: true } }, include: { colaborador: true }, orderBy: { colaborador: { nome: 'asc' } } } }
    })
  ]);

  return {
    custoFixoTotal: custoFixo._sum.valor ? tt(custoFixo._sum.valor) : '0',
    criterioRateio: (param?.criterioRateio ?? 'horas') as CriterioRateio,
    centros: centros.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo as TipoCentro,
      status: c.status as StatusCentro,
      horasExpediente: tt(c.horasExpediente),
      eficiencia: tt(c.eficiencia),
      maoDeObra: c.operadores.map((o) => ({
        colaboradorId: o.colaboradorId,
        nome: o.colaborador.nome,
        salario: tt(o.colaborador.salario),
        encargos: tt(o.colaborador.encargos),
        beneficios: tt(o.colaborador.beneficios),
        alocacao: tt(o.alocacao)
      })),
      manutencao: tt(c.manutencao),
      insumos: tt(c.insumos),
      outros: tt(c.outros),
      ...(c.valorAquisicao.gt(0) || c.vidaUtilMeses > 0
        ? { ativo: { valorAquisicao: tt(c.valorAquisicao), valorResidual: tt(c.valorResidual), vidaUtilMeses: c.vidaUtilMeses } }
        : {}),
      ...(c.potenciaKw.gt(0) ? { energia: { potenciaKw: tt(c.potenciaKw), fatorCarga: tt(c.fatorCarga), tarifaKwh: tt(c.tarifaKwh) } } : {}),
      ...(c.pesoManual !== null ? { pesoManual: tt(c.pesoManual) } : {}),
      ...(c.areaM2 !== null ? { areaM2: tt(c.areaM2) } : {})
    }))
  };
}

/** Cadastro que alimenta custo mudou: a vigente deixa de refletir a realidade até a próxima publicação. */
export const marcarDesatualizada = (db: Db, tenantId: string, competencia?: string) =>
  db.tabelaCustos.updateMany({
    where: { tenantId, status: 'VIGENTE', desatualizada: false, ...(competencia ? { competencia } : {}) },
    data: { desatualizada: true }
  });
