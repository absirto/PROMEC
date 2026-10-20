import { PrismaClient } from '@prisma/client';
import { dec } from '@promec/motor';
import { pd } from '../comum/decimal';
import { dataBanco, hojeLocal, inicioDoDia, segundaDa, somarDias } from '../planejamento/calendario';
import { json } from '../tabelas-custos/entrada';

const MESES = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
/** Custo mensal de manutenção por centro (setembro do torno é a corretiva). Torno ≈ 700/mês. */
const SERIE: Record<string, number[]> = {
  torno: [620, 710, 680, 640, 0, 570],
  fresa: [690, 720, 660, 705, 680, 710],
  cu: [700, 640, 760, 690, 720, 680]
};

/** Planos, histórico de ordens (incluindo a corretiva de setembro no torno), ausências e habilitações. */
export async function semearManutencao(db: PrismaClient, tenantId: string, id: (s: string) => string, r: { centros: Record<string, string>; box3: string }) {
  const hoje = hojeLocal();
  const segunda = segundaDa(hoje);

  // Ordens históricas (numeradas em ordem de data) e seus custos.
  const historico: { chave: string; centro: string; mes: string; tipo: 'PREVENTIVA' | 'CORRETIVA'; descricao: string; custos: { chave: string; tipo: string; descricao: string; valor: string; colaborador?: string; horas?: string }[]; quebra?: boolean; plano?: string }[] = [];
  for (const mes of MESES) {
    for (const centro of ['torno', 'fresa', 'cu']) {
      const valor = SERIE[centro][MESES.indexOf(mes)];
      if (centro === 'torno' && mes === '2026-09') {
        historico.push({
          chave: `${centro}-${mes}`,
          centro,
          mes,
          tipo: 'CORRETIVA',
          descricao: 'Ruído e vibração no cabeçote — rolamento danificado',
          quebra: true,
          custos: [
            { chave: 'peca', tipo: 'PECA', descricao: 'Rolamento do cabeçote 6206-2RS', valor: '180.00' },
            { chave: 'mo', tipo: 'MAO_DE_OBRA', descricao: 'Desmontagem e troca do rolamento', valor: '149.09', colaborador: 'ricardo', horas: '4' },
            { chave: 'terceiro', tipo: 'TERCEIRO', descricao: 'Retífica do eixo-árvore (serviço externo)', valor: '650.00' }
          ]
        });
        continue;
      }
      historico.push({
        chave: `${centro}-${mes}`,
        centro,
        mes,
        tipo: 'PREVENTIVA',
        descricao: centro === 'torno' && mes === '2026-08' ? 'Preventiva 500 h — lubrificação e folgas' : 'Manutenção preventiva mensal',
        plano: centro === 'torno' && mes === '2026-08' ? 'torno' : undefined,
        custos: [{ chave: 'servico', tipo: 'TERCEIRO', descricao: 'Lubrificação, ajustes e reposição de consumíveis', valor: valor.toFixed(2) }]
      });
    }
  }
  for (const [n, h] of historico.entries()) {
    const omId = id(`om-${h.chave}`);
    const inicio = h.quebra ? new Date('2026-09-16T08:00:00-03:00') : new Date(`${h.mes}-${h.chave.startsWith('torno-2026-08') ? '12' : '15'}T07:30:00-03:00`);
    const fim = h.quebra ? new Date('2026-09-16T14:00:00-03:00') : new Date(inicio.getTime() + 4 * 3_600_000);
    const dados = {
      tenantId,
      numero: `OM-2026-${String(n + 1).padStart(5, '0')}`,
      centroId: r.centros[h.centro],
      tipo: h.tipo,
      origem: h.quebra ? 'QUEBRA' : h.plano ? 'PLANO' : 'MANUAL',
      planoId: h.plano ? id(`plano-${h.plano}`) : null,
      execucao: h.quebra ? 'INTERNA' : 'EXTERNA',
      descricao: h.descricao,
      prevista: h.quebra ? null : dataBanco(inicio.toISOString().slice(0, 10)),
      inicio,
      fim,
      status: 'CONCLUIDA',
      bloqueiaAgenda: !h.quebra,
      horasParado: h.quebra ? pd('6') : null,
      checklist: json([]),
      observacao: h.quebra ? 'Rolamento trocado e eixo retificado; folga dentro do especificado.' : null,
      osAfetadas: json([]),
      criadoEm: inicio
    };
    await db.ordemManutencao.upsert({ where: { id: omId }, create: { id: omId, ...dados }, update: dados });
    for (const c of h.custos) {
      const cid = id(`omc-${h.chave}-${c.chave}`);
      const custo = { tenantId, ordemId: omId, tipo: c.tipo, descricao: c.descricao, valor: pd(c.valor), colaboradorId: c.colaborador ? id(`colab-${c.colaborador}`) : null, horas: c.horas ? pd(c.horas) : null, data: fim };
      await db.custoManutencao.upsert({ where: { id: cid }, create: { id: cid, ...custo }, update: custo });
    }
    if (h.quebra) {
      const parada = { tenantId, centroId: r.centros.torno, inicio: dataBanco('2026-09-16'), fim: dataBanco('2026-09-16'), motivo: 'Quebra · rolamento do cabeçote', ordemManutencaoId: omId };
      await db.paradaCentro.upsert({ where: { id: id('parada-quebra-torno') }, create: { id: id('parada-quebra-torno'), ...parada }, update: parada });
      await db.ordemManutencao.update({ where: { id: omId }, data: { paradaId: id('parada-quebra-torno') } });
    }
  }
  const seq = await db.sequencia.findUnique({ where: { tenantId_chave: { tenantId, chave: 'OM-2026' } } });
  if (!seq || seq.valor < historico.length) {
    await db.sequencia.upsert({ where: { tenantId_chave: { tenantId, chave: 'OM-2026' } }, create: { tenantId, chave: 'OM-2026', valor: historico.length }, update: { valor: historico.length } });
  }

  // Planos: torno por horas (352,5 h de 500), fresa por calendário (próxima) e inspeção mensal do elevador.
  const desdeTorno = inicioDoDia('2026-08-12');
  const apontadas = await db.apontamento.aggregate({ where: { tenantId, fim: { gt: desdeTorno }, operacao: { centroId: r.centros.torno } }, _sum: { horas: true } });
  const planos = [
    {
      chave: 'torno', centroId: r.centros.torno, nome: 'Preventiva 500 h — lubrificação e folgas', tipo: 'HORAS', intervaloHoras: '500', intervaloDias: null, duracaoHoras: '4',
      checklist: ['Trocar óleo do cabeçote', 'Verificar folga do carro', 'Limpar barramento'], ultimaExecucao: '2026-08-12', contadorDesde: desdeTorno,
      horasAjuste: dec('352.5').minus(apontadas._sum.horas ? apontadas._sum.horas.toFixed() : 0).toFixed()
    },
    {
      chave: 'fresa', centroId: r.centros.fresa, nome: 'Preventiva trimestral — fuso, guias e refrigeração', tipo: 'CALENDARIO', intervaloHoras: null, intervaloDias: 90, duracaoHoras: '6',
      checklist: ['Lubrificar fuso de esferas', 'Conferir folga das guias', 'Limpar e trocar fluido de corte'], ultimaExecucao: somarDias(hoje, -84), contadorDesde: inicioDoDia(somarDias(hoje, -84)), horasAjuste: '0'
    },
    {
      chave: 'box3', centroId: r.box3, nome: 'Inspeção do elevador automotivo', tipo: 'CALENDARIO', intervaloHoras: null, intervaloDias: 30, duracaoHoras: '1',
      checklist: ['Travas de segurança', 'Cabos e polias', 'Vazamento no cilindro hidráulico'], ultimaExecucao: somarDias(hoje, -10), contadorDesde: inicioDoDia(somarDias(hoje, -10)), horasAjuste: '0'
    }
  ];
  for (const p of planos) {
    const dados = {
      tenantId,
      centroId: p.centroId,
      nome: p.nome,
      tipo: p.tipo,
      intervaloHoras: p.intervaloHoras ? pd(p.intervaloHoras) : null,
      intervaloDias: p.intervaloDias,
      duracaoHoras: pd(p.duracaoHoras),
      checklist: p.checklist,
      ultimaExecucao: dataBanco(p.ultimaExecucao),
      contadorDesde: p.contadorDesde,
      horasAjuste: pd(p.horasAjuste),
      ativo: true
    };
    await db.planoManutencao.upsert({ where: { id: id(`plano-${p.chave}`) }, create: { id: id(`plano-${p.chave}`), ...dados }, update: dados });
  }

  // RH: férias do Anderson, treinamento do Jonas e habilitações.
  const treinamento = somarDias(segunda, 10);
  const ausencias = [
    { chave: 'ferias-anderson', colaborador: 'anderson', tipo: 'FERIAS', inicio: '2026-11-09', fim: '2026-11-13', observacao: 'Férias programadas (5 dias úteis)' },
    { chave: 'treino-jonas', colaborador: 'jonas', tipo: 'TREINAMENTO', inicio: treinamento, fim: treinamento, observacao: 'Curso de injeção eletrônica de motos' }
  ];
  for (const a of ausencias) {
    const dados = { tenantId, colaboradorId: id(`colab-${a.colaborador}`), tipo: a.tipo, inicio: dataBanco(a.inicio), fim: dataBanco(a.fim), observacao: a.observacao };
    await db.ausencia.upsert({ where: { id: id(`aus-${a.chave}`) }, create: { id: id(`aus-${a.chave}`), ...dados }, update: dados });
  }
  const habilitacoes = [
    { chave: 'ricardo-torno', colaborador: 'ricardo', centro: r.centros.torno, descricao: 'Operação de torno CNC (Fanuc)', emissao: '2025-03-10', validade: '2030-12-31' },
    { chave: 'diego-fresa', colaborador: 'diego', centro: r.centros.fresa, descricao: 'Operação de fresadora CNC', emissao: '2025-02-01', validade: '2030-12-31' },
    { chave: 'diego-nr12', colaborador: 'diego', centro: r.centros.fresa, descricao: 'Certificação NR-12', emissao: '2024-11-01', validade: somarDias(hoje, 20) },
    { chave: 'anderson-cu', colaborador: 'anderson', centro: r.centros.cu, descricao: 'Operação de centro de usinagem', emissao: '2025-05-20', validade: '2030-12-31' },
    { chave: 'jonas-box3', colaborador: 'jonas', centro: r.box3, descricao: 'NR-12 elevador automotivo', emissao: '2025-01-15', validade: '2030-12-31' },
    { chave: 'marcelo-solda', colaborador: 'marcelo', centro: r.centros.cu, descricao: 'Certificação de solda MIG', emissao: '2024-09-30', validade: '2026-09-30' }
  ];
  for (const h of habilitacoes) {
    const dados = { tenantId, colaboradorId: id(`colab-${h.colaborador}`), centroId: h.centro, descricao: h.descricao, emissao: dataBanco(h.emissao), validade: dataBanco(h.validade), documento: null };
    await db.habilitacao.upsert({ where: { id: id(`hab-${h.chave}`) }, create: { id: id(`hab-${h.chave}`), ...dados }, update: dados });
  }
  return { treinamentoJonas: treinamento, planos: Object.fromEntries(planos.map((p) => [p.chave, id(`plano-${p.chave}`)])) as Record<string, string>, ordemCorretiva: id('om-torno-2026-09') };
}

/** Devolve manutenção e RH da empresa de demonstração ao estado semeado (somente registros fora da semente). */
export async function limparManutencaoDemo(db: PrismaClient, tenantId: string, prefixo: string) {
  const fora = { NOT: { id: { startsWith: `${prefixo}-` } } };
  const ordens = await db.ordemManutencao.findMany({ where: { tenantId, ...fora }, select: { id: true } });
  const ids = ordens.map((o) => o.id);
  await db.$transaction([
    db.movimento.deleteMany({ where: { tenantId, ordemManutencaoId: { not: null } } }),
    db.paradaCentro.deleteMany({ where: { tenantId, ...fora } }),
    db.ordemManutencao.deleteMany({ where: { id: { in: ids } } }),
    db.custoManutencao.deleteMany({ where: { tenantId, ...fora } }),
    db.planoManutencao.deleteMany({ where: { tenantId, ...fora } }),
    db.ausencia.deleteMany({ where: { tenantId, ...fora } }),
    db.habilitacao.deleteMany({ where: { tenantId, ...fora } }),
    db.sequencia.updateMany({ where: { tenantId, chave: 'OM-2026' }, data: { valor: 18 } })
  ]);
}
