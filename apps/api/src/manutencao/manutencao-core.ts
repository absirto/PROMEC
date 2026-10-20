import { PlanoManutencao, Prisma } from '@prisma/client';
import { dec, planejar, situacaoPreventiva, soma, txt, type Dec } from '@promec/motor';
import { tt } from '../comum/decimal';
import { notificar } from '../notificacoes/notificacoes-core';
import { proximoNumero } from '../orcamentos/numeracao';
import { dataBanco, hojeLocal, local, somarDias, textoData } from '../planejamento/calendario';
import { montarPlanejamento } from '../planejamento/entrada';
import { Db } from '../tabelas-custos/entrada';

export const ABERTAS = ['ABERTA', 'EM_EXECUCAO'];

/** Contador de uso: horas apontadas no centro desde a última execução (mais o ajuste do horímetro inicial). */
export async function horasDoPlano(db: Db, p: PlanoManutencao) {
  const desde = p.contadorDesde ?? (p.ultimaExecucao ? new Date(`${textoData(p.ultimaExecucao)}T00:00:00-03:00`) : p.criadoEm);
  const r = await db.apontamento.aggregate({ where: { tenantId: p.tenantId, fim: { gt: desde }, operacao: { centroId: p.centroId } }, _sum: { horas: true } });
  return txt(dec(tt(p.horasAjuste)).plus(r._sum.horas ? tt(r._sum.horas) : 0));
}

export async function situacaoDoPlano(db: Db, p: PlanoManutencao) {
  const horas = await horasDoPlano(db, p);
  const situacao =
    p.tipo === 'HORAS'
      ? situacaoPreventiva({ tipo: 'HORAS', intervaloHoras: tt(p.intervaloHoras ?? new Prisma.Decimal(0)), horasDesdeUltima: horas })
      : situacaoPreventiva({ tipo: 'CALENDARIO', intervaloDias: p.intervaloDias ?? 30, ultimaExecucao: textoData(p.ultimaExecucao ?? p.criadoEm), hoje: hojeLocal() });
  return { horasDesdeUltima: horas, situacao };
}

/** Dia útil de menor carga do centro nos próximos 10 dias, pelo planejamento em capacidade finita. */
export async function diaDeMenorCarga(db: Db, tenantId: string, centroId: string) {
  const { entrada } = await montarPlanejamento(db, tenantId, { horizonte: 12 });
  const centro = planejar(entrada).centros.find((c) => c.id === centroId);
  const hoje = hojeLocal();
  const dias = (centro?.dias ?? []).filter((d) => d.data > hoje && d.data <= somarDias(hoje, 10) && dec(d.capacidade).gt(0));
  const melhor = dias.sort((a, b) => dec(a.carga).comparedTo(dec(b.carga)) || (a.data < b.data ? -1 : 1))[0];
  return melhor?.data ?? somarDias(hoje, 1);
}

export async function criarOrdem(
  db: Db,
  tenantId: string,
  o: { centroId: string; tipo: 'PREVENTIVA' | 'CORRETIVA'; origem: string; planoId?: string | null; execucao?: string; fornecedorId?: string | null; descricao: string; prevista?: string | null; bloqueiaAgenda?: boolean; status?: string; inicio?: Date | null }
) {
  const numero = await proximoNumero(db, tenantId, 'OM');
  const ordem = await db.ordemManutencao.create({
    data: {
      tenantId,
      numero,
      centroId: o.centroId,
      tipo: o.tipo,
      origem: o.origem,
      planoId: o.planoId ?? null,
      execucao: o.execucao ?? 'INTERNA',
      fornecedorId: o.fornecedorId ?? null,
      descricao: o.descricao,
      prevista: o.prevista ? dataBanco(o.prevista) : null,
      bloqueiaAgenda: !!o.bloqueiaAgenda,
      status: o.status ?? 'ABERTA',
      inicio: o.inicio ?? null
    }
  });
  if (o.bloqueiaAgenda && o.prevista) {
    const parada = await db.paradaCentro.create({
      data: { tenantId, centroId: o.centroId, inicio: dataBanco(o.prevista), fim: dataBanco(o.prevista), motivo: `${numero} · ${o.descricao}`, ordemManutencaoId: ordem.id }
    });
    return db.ordemManutencao.update({ where: { id: ordem.id }, data: { paradaId: parada.id } });
  }
  return ordem;
}

/** Rotina diária: ordem preventiva para cada plano `proxima` ou `vencida`, sem duplicar a ordem aberta. */
export async function gerarPreventivas(db: Db, tenantId: string) {
  const planos = await db.planoManutencao.findMany({ where: { tenantId, ativo: true } });
  let geradas = 0;
  for (const p of planos) {
    const { situacao } = await situacaoDoPlano(db, p);
    if (situacao.situacao === 'ok') continue;
    if (await db.ordemManutencao.findFirst({ where: { tenantId, planoId: p.id, status: { in: ABERTAS } } })) continue;
    const prevista = await diaDeMenorCarga(db, tenantId, p.centroId);
    const o = await criarOrdem(db, tenantId, { centroId: p.centroId, tipo: 'PREVENTIVA', origem: 'PLANO', planoId: p.id, descricao: p.nome, prevista, bloqueiaAgenda: true });
    await notificar(db, tenantId, {
      permissoes: ['manutencao.visualizar'],
      tipo: situacao.situacao === 'vencida' ? 'ATENCAO' : 'INFO',
      titulo: `Preventiva ${situacao.situacao === 'vencida' ? 'vencida' : 'próxima'}: ${p.nome}`,
      mensagem: `${o.numero} foi aberta para ${prevista.split('-').reverse().join('/')}, o dia de menor carga do centro nos próximos 10 dias.`,
      link: `/manutencao/ordens/${o.id}`,
      chave: `preventiva-${o.id}`
    });
    geradas++;
  }
  return geradas;
}

/** Custo de manutenção do centro por competência: custos das ordens + títulos de custo direto lançados à parte. */
export async function custoManutencaoPorMes(db: Db, tenantId: string, centroId: string, competencias: string[]) {
  const [custos, centrosCusto] = await Promise.all([
    db.custoManutencao.findMany({ where: { tenantId, ordem: { centroId }, data: { gte: new Date(`${competencias[0]}-01T00:00:00-03:00`) } } }),
    db.centroCusto.findMany({ where: { tenantId, custoDiretoCentro: { not: Prisma.DbNull } } })
  ]);
  const meus = centrosCusto.filter((c) => (c.custoDiretoCentro as { centroTrabalhoId: string; componente: string }).centroTrabalhoId === centroId && (c.custoDiretoCentro as { componente: string }).componente === 'manutencao');
  const titulos = meus.length
    ? await db.titulo.findMany({ where: { tenantId, tipo: 'PAGAR', centroCustoId: { in: meus.map((c) => c.id) }, competencia: { in: competencias }, origemTipo: { not: 'MANUTENCAO' }, status: { notIn: ['CANCELADO', 'RENEGOCIADO'] } } })
    : [];
  return new Map<string, Dec>(
    competencias.map((c) => [
      c,
      soma([...custos.filter((x) => local(x.data).data.slice(0, 7) === c).map((x) => dec(tt(x.valor))), ...titulos.filter((t) => t.competencia === c).map((t) => dec(tt(t.valor)))])
    ])
  );
}
