import { Prioridade, PrismaClient, StatusOperacao, StatusOs, TipoApontamento } from '@prisma/client';
import type { LinhaOrcamento, ResultadoOrcamento } from '@promec/motor';
import { pd } from '../comum/decimal';
import { custoRealDa, horasEntre, incluirOs, mesclarObjeto, roteiroDoOrcamento } from '../ordens/custo';
import { json } from '../tabelas-custos/entrada';

const hora = 3_600_000;
const dia = 24 * hora;
const diaUtc = (n: number) => {
  const d = new Date(Date.now() + n * dia);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** [tipo, duração em horas (null = aberto), peças boas]. */
type Apont = [TipoApontamento, number | null, number];

interface OsSemente {
  n: number;
  orcamento: number;
  status: StatusOs;
  prioridade: Prioridade;
  prazoEm: number;
  /** Horas atrás em que o primeiro apontamento começou. */
  inicioHa: number;
  objeto: Record<string, string>;
  operacoes: { colaborador: string; status: StatusOperacao; setupConcluido: boolean; apontamentos: Apont[] }[];
  reais?: (string | null)[];
  pausa?: { motivo: string; ha: number; observacao: string };
  inspecao?: boolean;
  entregueHa?: number;
  eventos: [evento: string, status: StatusOs, horasAtras: number, detalhe?: string][];
}

const ORDENS: OsSemente[] = [
  {
    n: 37,
    orcamento: 115,
    status: 'ENTREGUE',
    prioridade: 'NORMAL',
    prazoEm: -12,
    inicioHa: 22 * 24,
    objeto: { desenho: 'ENG-M2-Z32', revisao: 'B', material: 'SAE 4140 temperado' },
    operacoes: [
      { colaborador: 'ricardo', status: 'CONCLUIDA', setupConcluido: true, apontamentos: [['SETUP', 1.1, 0], ['PRODUCAO', 2.5, 12]] },
      { colaborador: 'anderson', status: 'CONCLUIDA', setupConcluido: true, apontamentos: [['SETUP', 2.3, 0], ['PRODUCAO', 5.2, 12]] }
    ],
    reais: ['552', '286'],
    inspecao: true,
    entregueHa: 14 * 24,
    eventos: [['criada', 'EM_FILA', 25 * 24, 'Convertida de ORC-2026-00115'], ['execucao_iniciada', 'EM_EXECUCAO', 22 * 24], ['operacoes_encerradas', 'CONTROLE_QUALIDADE', 20 * 24], ['inspecao_aprovada', 'CONCLUIDA', 19 * 24], ['entregue', 'ENTREGUE', 14 * 24, 'Recebido por Jonas Krüger']]
  },
  {
    n: 38,
    orcamento: 124,
    status: 'CONTROLE_QUALIDADE',
    prioridade: 'NORMAL',
    prazoEm: 2,
    inicioHa: 3 * 24,
    objeto: { desenho: 'EIX-1045-220', revisao: 'A', material: 'SAE 1045 laminado' },
    operacoes: [
      { colaborador: 'ricardo', status: 'CONCLUIDA', setupConcluido: true, apontamentos: [['SETUP', 2.2, 0], ['PRODUCAO', 5.1, 20]] },
      { colaborador: 'diego', status: 'CONCLUIDA', setupConcluido: true, apontamentos: [['SETUP', 1.4, 0], ['PRODUCAO', 2.3, 20]] }
    ],
    reais: [null, '195', null],
    eventos: [['criada', 'EM_FILA', 4 * 24, 'Convertida de ORC-2026-00124'], ['execucao_iniciada', 'EM_EXECUCAO', 3 * 24], ['operacoes_encerradas', 'CONTROLE_QUALIDADE', 5]]
  },
  {
    n: 39,
    orcamento: 116,
    status: 'PAUSADA',
    prioridade: 'ALTA',
    prazoEm: 4,
    inicioHa: 30,
    objeto: { desenho: 'BMB-420-06', revisao: 'A', material: 'Inox AISI 420 Ø40' },
    operacoes: [
      { colaborador: 'ricardo', status: 'PAUSADA', setupConcluido: true, apontamentos: [['SETUP', 1.5, 0], ['PRODUCAO', 1.2, 2]] },
      { colaborador: 'diego', status: 'PENDENTE', setupConcluido: false, apontamentos: [] }
    ],
    pausa: { motivo: 'FALTA_PECA', ha: 6, observacao: 'Barra inox 420 Ø40 em falta; fornecedor promete para amanhã' },
    eventos: [['criada', 'EM_FILA', 6 * 24, 'Convertida de ORC-2026-00116'], ['execucao_iniciada', 'EM_EXECUCAO', 30], ['pausada', 'PAUSADA', 6, 'falta de peça']]
  },
  {
    n: 40,
    orcamento: 117,
    status: 'EM_FILA',
    prioridade: 'URGENTE',
    prazoEm: -2,
    inicioHa: 0,
    objeto: { desenho: 'MLD-BG-35', revisao: 'D', material: 'SAE 52100' },
    operacoes: [{ colaborador: 'ricardo', status: 'PENDENTE', setupConcluido: false, apontamentos: [] }],
    eventos: [['criada', 'EM_FILA', 10 * 24, 'Convertida de ORC-2026-00117']]
  },
  {
    n: 41,
    orcamento: 121,
    status: 'EM_EXECUCAO',
    prioridade: 'ALTA',
    prazoEm: 5,
    inicioHa: 4.3,
    objeto: { desenho: 'BUC-H7-020', revisao: 'C', material: 'Latão C360 Ø25' },
    operacoes: [{ colaborador: 'ricardo', status: 'EM_ANDAMENTO', setupConcluido: true, apontamentos: [['SETUP', 3.4, 0], ['PRODUCAO', 0.38, 4], ['PRODUCAO', null, 0]] }],
    reais: ['80'],
    eventos: [['criada', 'EM_FILA', 20, 'Convertida de ORC-2026-00121'], ['execucao_iniciada', 'EM_EXECUCAO', 4.3, 'Torneamento CNC por Ricardo Lima']]
  }
];

export async function semearOrdens(db: PrismaClient, tenantId: string, id: (s: string) => string) {
  const agora = Date.now();
  const ids: Record<number, string> = {};
  for (const os of ORDENS) {
    const osId = id(`os-${os.n}`);
    const orc = await db.orcamento.findUniqueOrThrow({ where: { id: id(`orcamento-${os.orcamento}`) } });
    const { operacoes, custos } = roteiroDoOrcamento(orc.linhas as unknown as LinhaOrcamento[], orc.resultado as unknown as ResultadoOrcamento);
    const dados = {
      numero: `OS-2026-${String(os.n).padStart(5, '0')}`,
      orcamentoId: orc.id,
      clienteId: orc.clienteId,
      tabelaCustosId: orc.tabelaCustosId,
      titulo: orc.titulo,
      segmento: orc.segmento,
      lote: orc.lote,
      prazo: diaUtc(os.prazoEm),
      prioridade: os.prioridade,
      objeto: json(mesclarObjeto({}, os.objeto)),
      status: os.status,
      precoFinalLote: orc.precoFinalLote,
      impostos: orc.impostos,
      comissao: orc.comissao,
      margemMinima: orc.margemMinima,
      custoRealFinal: null,
      desvioFinal: null,
      recebidoPor: os.entregueHa ? 'Jonas Krüger' : null,
      documentoEntrega: os.entregueHa ? 'NF-e 8812 do cliente' : null,
      entregueEm: os.entregueHa ? new Date(agora - os.entregueHa * hora) : null,
      criadoEm: new Date(agora - os.eventos[0][2] * hora)
    };
    await db.ordemServico.upsert({ where: { id: osId }, create: { id: osId, tenantId, ...dados }, update: dados });
    await db.osOperacao.deleteMany({ where: { osId } });
    await db.osCusto.deleteMany({ where: { osId } });
    await db.ocorrencia.deleteMany({ where: { osId } });
    await db.inspecao.deleteMany({ where: { osId } });
    await db.osHistorico.deleteMany({ where: { osId } });

    let cursor = agora - os.inicioHa * hora;
    for (const [i, op] of operacoes.entries()) {
      const s = os.operacoes[i];
      const opId = `${osId}-op-${op.sequencia}`;
      await db.osOperacao.create({
        data: {
          id: opId,
          tenantId,
          osId,
          ...op,
          custoHora: pd(op.custoHora),
          setupOrcadoHoras: pd(op.setupOrcadoHoras),
          cicloOrcadoHorasPorPeca: pd(op.cicloOrcadoHorasPorPeca),
          colaboradorId: id(`colab-${s.colaborador}`),
          status: s.status,
          setupConcluido: s.setupConcluido
        }
      });
      for (const [j, [tipo, duracao, boas]] of s.apontamentos.entries()) {
        const inicio = new Date(cursor);
        const fim = duracao === null ? null : new Date(cursor + duracao * hora);
        await db.apontamento.create({
          data: {
            id: `${opId}-ap-${j + 1}`,
            tenantId,
            osId,
            operacaoId: opId,
            colaboradorId: id(`colab-${s.colaborador}`),
            tipo,
            inicio,
            fim,
            horas: fim ? pd(horasEntre(inicio, fim)) : null,
            quantidadeBoa: boas
          }
        });
        cursor += ((duracao ?? 0) + 0.25) * hora;
      }
    }
    await db.osCusto.createMany({
      data: custos.map((c, i) => ({
        id: `${osId}-custo-${i + 1}`,
        tenantId,
        osId,
        descricao: c.descricao,
        categoria: c.categoria,
        orcado: pd(c.orcado),
        itemId: c.itemId,
        real: os.reais?.[i] ? pd(os.reais[i]!) : null,
        doOrcamento: true
      }))
    });
    if (os.pausa) {
      await db.ocorrencia.create({
        data: { id: `${osId}-pausa`, tenantId, osId, tipo: 'PAUSA', motivo: os.pausa.motivo, inicio: new Date(agora - os.pausa.ha * hora), observacao: os.pausa.observacao }
      });
    }
    if (os.inspecao) {
      await db.inspecao.create({
        data: {
          id: `${osId}-inspecao`,
          tenantId,
          osId,
          aprovada: true,
          itens: json([
            { descricao: 'Diâmetro primitivo', esperado: '64,00 ± 0,02', medido: '64,01', conforme: true },
            { descricao: 'Dureza superficial', esperado: '50–55 HRC', medido: '53 HRC', conforme: true }
          ]),
          usuarioId: id('usuario-marina'),
          data: new Date(agora - 19 * 24 * hora)
        }
      });
    }
    await db.osHistorico.createMany({
      data: os.eventos.map(([evento, status, ha, detalhe], i) => ({
        id: `${osId}-h-${i + 1}`,
        tenantId,
        osId,
        evento,
        status,
        detalhe,
        usuarioId: id('usuario-marina'),
        data: new Date(agora - ha * hora)
      }))
    });
    if (os.status === 'ENTREGUE') {
      const r = custoRealDa(await db.ordemServico.findUniqueOrThrow({ where: { id: osId }, include: incluirOs }));
      await db.ordemServico.update({ where: { id: osId }, data: { custoRealFinal: pd(r.custoReal), desvioFinal: pd(r.desvioCusto) } });
    }
    ids[os.n] = osId;
  }

  const chave = 'OS-2026';
  const seq = await db.sequencia.findUnique({ where: { tenantId_chave: { tenantId, chave } } });
  if (!seq || seq.valor < 41) {
    await db.sequencia.upsert({ where: { tenantId_chave: { tenantId, chave } }, create: { tenantId, chave, valor: 41 }, update: { valor: 41 } });
  }
  return ids;
}
