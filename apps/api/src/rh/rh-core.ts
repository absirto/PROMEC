import { Colaborador, Prisma } from '@prisma/client';
import { custoColaborador, disponibilidadeNoMes } from '@promec/motor';
import { tt } from '../comum/decimal';
import { naoEncontrado, regra } from '../comum/erros';
import { dataBanco, hojeLocal, somarDias, textoData } from '../planejamento/calendario';
import { Db } from '../tabelas-custos/entrada';

export const ENCARGOS_PADRAO: Record<string, string> = { CLT: '0.64', HORISTA: '0.64', PJ: '0', SOCIO: '0' };
export const TIPOS_AUSENCIA = ['FERIAS', 'AFASTAMENTO', 'TREINAMENTO', 'FALTA', 'FOLGA'] as const;
const ROTULO_AUSENCIA: Record<string, string> = { FERIAS: 'de férias', AFASTAMENTO: 'afastado', TREINAMENTO: 'em treinamento', FALTA: 'com falta registrada', FOLGA: 'de folga' };

const ultimoDia = (c: string) => {
  const [a, m] = c.split('-').map(Number);
  return `${c}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** Horas disponíveis do colaborador na competência, descontando ausências e feriados do tenant. */
export async function disponibilidadeDo(db: Db, tenantId: string, c: Pick<Colaborador, 'id' | 'jornadaHoras' | 'diasSemana'>, competencia: string) {
  const [ausencias, feriados] = await Promise.all([
    db.ausencia.findMany({ where: { tenantId, colaboradorId: c.id, inicio: { lte: dataBanco(ultimoDia(competencia)) }, fim: { gte: dataBanco(`${competencia}-01`) } }, orderBy: { inicio: 'asc' } }),
    db.feriado.findMany({ where: { tenantId } })
  ]);
  const r = disponibilidadeNoMes({
    competencia,
    jornadaHoras: tt(c.jornadaHoras),
    ausencias: ausencias.map((a) => ({ inicio: textoData(a.inicio), fim: textoData(a.fim), tipo: a.tipo })),
    feriados: feriados.map((f) => textoData(f.data)),
    diasSemana: c.diasSemana
  });
  return { ...r, ausencias };
}

/** Custo mensal e custo-hora pelo motor, com as horas disponíveis do mês corrente. */
export async function custoDoColaborador(db: Db, tenantId: string, c: Colaborador, competencia = hojeLocal().slice(0, 7)) {
  const d = await disponibilidadeDo(db, tenantId, c, competencia);
  return {
    disponibilidade: d,
    ...custoColaborador({
      salario: tt(c.salario),
      ...(c.encargosPercentual !== null ? { encargosPercentual: tt(c.encargosPercentual) } : { encargos: tt(c.encargos) }),
      beneficios: tt(c.beneficios),
      horasDisponiveis: d.horasDisponiveis
    })
  };
}

/** Percentual de encargos do vínculo nos parâmetros do tenant. */
export async function encargosDoVinculo(db: Db, tenantId: string, vinculo: string) {
  const p = await db.parametros.findUnique({ where: { tenantId } });
  const tabela = { ...ENCARGOS_PADRAO, ...((p?.encargosPorVinculo as Record<string, string> | null) ?? {}) };
  return tabela[vinculo] ?? '0';
}

export const situacaoHabilitacao = (validade: Date, hoje = hojeLocal()) => {
  const v = textoData(validade);
  return v < hoje ? 'vencida' : v <= somarDias(hoje, 30) ? 'vencendo' : 'ok';
};

/** Colaborador pode trabalhar no centro naquela data: presente e com habilitação válida. */
export async function conferirColaboradorNoDia(db: Db, tenantId: string, colaboradorId: string, centroId: string, data: string) {
  const colaborador = await db.colaborador.findFirst({ where: { id: colaboradorId, tenantId } });
  if (!colaborador) throw naoEncontrado('esse colaborador');
  const ausencia = await db.ausencia.findFirst({ where: { tenantId, colaboradorId, inicio: { lte: dataBanco(data) }, fim: { gte: dataBanco(data) } } });
  if (ausencia) {
    throw regra(
      'COLABORADOR_AUSENTE',
      `${colaborador.nome} está ${ROTULO_AUSENCIA[ausencia.tipo] ?? 'ausente'} de ${textoData(ausencia.inicio).split('-').reverse().join('/')} a ${textoData(ausencia.fim).split('-').reverse().join('/')}. Escolha outro colaborador ou outra data.`,
      { ausenciaId: ausencia.id, tipo: ausencia.tipo }
    );
  }
  await conferirHabilitacao(db, tenantId, colaborador, centroId, data, true);
}

/** Habilitação válida no centro; `usoNoDia` distingue vencida (apontamento e agenda) de inexistente (alocação). */
export async function conferirHabilitacao(db: Db, tenantId: string, colaborador: Pick<Colaborador, 'id' | 'nome'>, centroId: string, data = hojeLocal(), usoNoDia = false) {
  const habs = await db.habilitacao.findMany({ where: { tenantId, colaboradorId: colaborador.id, centroId }, orderBy: { validade: 'desc' } });
  if (habs.some((h) => textoData(h.validade) >= data && textoData(h.emissao) <= data)) return;
  const centro = await db.centroTrabalho.findFirst({ where: { id: centroId, tenantId }, select: { nome: true } });
  if (usoNoDia && habs.length) {
    throw regra(
      'HABILITACAO_VENCIDA',
      `A habilitação de ${colaborador.nome} para ${centro?.nome ?? 'o centro'} venceu em ${textoData(habs[0].validade).split('-').reverse().join('/')}. Renove a habilitação antes de escalar o colaborador.`,
      { colaboradorId: colaborador.id, centroId, validade: textoData(habs[0].validade) }
    );
  }
  throw regra(
    'SEM_HABILITACAO',
    `${colaborador.nome} não tem habilitação válida para ${centro?.nome ?? 'o centro'}. Cadastre a habilitação em RH antes de alocar ou escalar.`,
    { colaboradorId: colaborador.id, centroId }
  );
}

export const D = (v: Prisma.Decimal | null | undefined) => (v ? tt(v) : '0');
