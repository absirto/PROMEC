import { Prioridade } from '@prisma/client';
import {
  dec,
  fatorPresenca,
  prometerPrazo,
  txt,
  type CalendarioCentro,
  type EntradaPlanejamento,
  type LinhaOrcamento,
  type OperacaoPlanejavel,
  type OrdemPlanejavel
} from '@promec/motor';
import { tt } from '../comum/decimal';
import { custoRealDa, incluirOs } from '../ordens/custo';
import { Db } from '../tabelas-custos/entrada';
import { dataBanco, hojeLocal, local, somarDias, textoData } from './calendario';

export const STATUS_PLANEJAVEIS = ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA'] as const;
export const LIMITE_SOBRECARGA = '0.9';

export interface Referencia {
  tipo: 'OS' | 'ORCAMENTO';
  id: string;
  numero: string;
  titulo: string;
  cliente: { id: string; nome: string };
  status: string;
  prioridade: Prioridade;
  segmento: string;
}

/** Roteiro de um orçamento em horas por centro: operação = setup + ciclo × lote; mão de obra = tempo × fator (× lote por peça). */
export function roteiroDoOrcamento(linhas: LinhaOrcamento[], lote: number): Omit<OperacaoPlanejavel, 'id'>[] {
  return linhas.flatMap((l, i) => {
    const centroId = (l as { centroId?: string }).centroId;
    if (!centroId) return [];
    if (l.tipo === 'operacao') {
      return [{ centroId, sequencia: (i + 1) * 10, horasRestantes: txt(dec(l.setupHorasPorLote ?? 0).plus(dec(l.cicloHorasPorPeca).times(lote))) }];
    }
    if (l.tipo === 'maoDeObra') {
      const h = dec(l.tempoPadraoHoras).times(dec(l.fatorDificuldade ?? 1));
      return [{ centroId, sequencia: (i + 1) * 10, horasRestantes: txt((l.base ?? 'lote') === 'peca' ? h.times(lote) : h) }];
    }
    return [];
  });
}

/** Entrada do motor de planejamento com a fila atual do tenant. */
export async function montarPlanejamento(db: Db, tenantId: string, opcoes: { horizonte?: number; excluirOrcamentoId?: string } = {}) {
  const hoje = hojeLocal();
  const [feriados, centros, ordens, orcamentos, agendamentos] = await Promise.all([
    db.feriado.findMany({ where: { tenantId }, orderBy: { data: 'asc' } }),
    db.centroTrabalho.findMany({
      where: { tenantId, status: { not: 'desativado' } },
      include: { paradas: true, operadores: { where: { colaborador: { ativo: true } } } },
      orderBy: [{ criadoEm: 'asc' }, { codigo: 'asc' }]
    }),
    db.ordemServico.findMany({ where: { tenantId, status: { in: [...STATUS_PLANEJAVEIS] } }, include: incluirOs }),
    db.orcamento.findMany({
      where: { tenantId, status: 'APROVADO', ordem: { is: null }, ...(opcoes.excluirOrcamentoId ? { id: { not: opcoes.excluirOrcamentoId } } : {}) },
      include: { cliente: { select: { id: true, nome: true } } }
    }),
    db.agendamento.findMany({ where: { tenantId, status: { in: ['MARCADO', 'CONFIRMADO'] }, inicio: { gte: new Date(Date.now() - 86_400_000) } } })
  ]);
  const horizonte = opcoes.horizonte ?? 60;
  const ausencias = await db.ausencia.findMany({ where: { tenantId, fim: { gte: dataBanco(hoje) }, inicio: { lte: dataBanco(somarDias(hoje, horizonte)) } } });

  const referencias = new Map<string, Referencia>();
  const operacoes = new Map<string, { descricao: string; centroNome: string }>();
  const nomeCentro = new Map(centros.map((c) => [c.id, c.nome]));

  const planejaveis: OrdemPlanejavel[] = ordens.map((os) => {
    const r = custoRealDa(os);
    referencias.set(os.id, {
      tipo: 'OS',
      id: os.id,
      numero: os.numero,
      titulo: os.titulo,
      cliente: os.cliente,
      status: os.status,
      prioridade: os.prioridade,
      segmento: os.segmento
    });
    return {
      id: os.id,
      prioridade: os.prioridade,
      prazo: textoData(os.prazo),
      posicao: os.posicaoFila,
      operacoes: os.operacoes
        .filter((op) => op.status !== 'CONCLUIDA')
        .map((op) => {
          operacoes.set(op.id, { descricao: op.descricao, centroNome: op.centro.nome });
          const ro = r.operacoes.find((x) => x.id === op.id)!;
          const resto = dec(ro.horasProjetadas).minus(ro.horasReais);
          return { id: op.id, centroId: op.centroId, sequencia: op.sequencia, horasRestantes: txt(resto.gt(0) ? resto : dec(0)) };
        })
    };
  });

  for (const o of orcamentos) {
    referencias.set(o.id, {
      tipo: 'ORCAMENTO',
      id: o.id,
      numero: o.numero,
      titulo: o.titulo,
      cliente: o.cliente,
      status: o.status,
      prioridade: 'NORMAL',
      segmento: o.segmento
    });
    const linhas = o.linhas as unknown as LinhaOrcamento[];
    planejaveis.push({
      id: o.id,
      provisoria: true,
      prazo: o.prazoPrometido ? textoData(o.prazoPrometido) : null,
      operacoes: roteiroDoOrcamento(linhas, o.lote).map((op, i) => {
        const id = `${o.id}:${i + 1}`;
        operacoes.set(id, { descricao: linhas[op.sequencia / 10 - 1].descricao, centroNome: nomeCentro.get(op.centroId) ?? '' });
        return { ...op, id };
      })
    });
  }

  const calendario: CalendarioCentro[] = centros.map((c) => ({
    id: c.id,
    nome: c.nome,
    horasExpedienteMes: tt(c.horasExpediente),
    eficiencia: tt(c.eficiencia),
    diasSemana: c.diasSemana,
    bloqueios: c.paradas.map((p) => ({ inicio: textoData(p.inicio), fim: p.fim ? textoData(p.fim) : '9999-12-31', motivo: p.motivo })),
    reducoes: reducoesDoCentro(c.operadores, ausencias, hoje, horizonte)
  }));

  const entrada: EntradaPlanejamento = {
    hoje,
    horizonteDias: horizonte,
    feriados: feriados.map((f) => textoData(f.data)),
    centros: calendario,
    ordens: planejaveis,
    ocupacaoFixa: agendamentos.map((a) => ({ centroId: a.centroId, data: local(a.inicio).data, horas: tt(a.duracaoHoras) })),
    limiteSobrecarga: LIMITE_SOBRECARGA
  };
  return { entrada, referencias, operacoes, centros };
}

/** Nos dias com operador ausente, a capacidade do centro cai pela fração de alocação dos presentes (`fatorPresenca`). */
export function reducoesDoCentro(
  operadores: { colaboradorId: string; alocacao: { toFixed(): string } }[],
  ausencias: { colaboradorId: string; inicio: Date; fim: Date }[],
  hoje: string,
  horizonte: number
) {
  const ids = new Set(operadores.map((o) => o.colaboradorId));
  const minhas = ausencias.filter((a) => ids.has(a.colaboradorId));
  if (!minhas.length) return [];
  const reducoes: { data: string; fator: string }[] = [];
  for (let i = 0; i <= horizonte; i++) {
    const d = somarDias(hoje, i);
    const fora = new Set(minhas.filter((a) => textoData(a.inicio) <= d && textoData(a.fim) >= d).map((a) => a.colaboradorId));
    if (!fora.size) continue;
    reducoes.push({ data: d, fator: fatorPresenca(operadores.map((o) => ({ alocacao: o.alocacao.toFixed(), ausente: fora.has(o.colaboradorId) }))) });
  }
  return reducoes;
}

/** Data mais cedo para um roteiro novo no fim da fila atual; não grava nada. */
export async function calcularPromessa(db: Db, tenantId: string, roteiro: Omit<OperacaoPlanejavel, 'id'>[], excluirOrcamentoId?: string) {
  const { entrada } = await montarPlanejamento(db, tenantId, { horizonte: 180, excluirOrcamentoId });
  const { fim, ocupacaoMaxima, resultado } = prometerPrazo(entrada, roteiro);
  const tocados = new Set(roteiro.map((r) => r.centroId));
  return {
    fim,
    ocupacaoMaxima,
    sobrecarga: dec(ocupacaoMaxima).gt(LIMITE_SOBRECARGA),
    alertas: [
      ...(fim ? [] : [{ tipo: 'atraso' as const, mensagem: 'O roteiro não cabe na capacidade dos próximos 180 dias. Revise a fila ou divida a entrega.' }]),
      ...resultado.alertas.filter((a) => a.tipo === 'sobrecarga' && a.centroId && tocados.has(a.centroId))
    ]
  };
}

export const promessaDoOrcamento = async (db: Db, tenantId: string, o: { id: string; linhas: unknown; lote: number }) => {
  const { fim, ocupacaoMaxima, sobrecarga } = await calcularPromessa(db, tenantId, roteiroDoOrcamento(o.linhas as LinhaOrcamento[], o.lote), o.id);
  return { fim, ocupacaoMaxima, sobrecarga };
};
