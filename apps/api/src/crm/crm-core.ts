import { EtapaOportunidade, Orcamento } from '@prisma/client';
import { pd } from '../comum/decimal';
import { dataBanco, hojeLocal, somarDias } from '../planejamento/calendario';
import { Db } from '../tabelas-custos/entrada';

export const ETAPAS: EtapaOportunidade[] = ['LEAD', 'CONTATO', 'ORCAMENTO_ENVIADO', 'NEGOCIACAO', 'GANHO', 'PERDIDO'];
export const ORIGENS = ['INDICACAO', 'SITE', 'WHATSAPP', 'TELEFONE', 'VISITA', 'RECORRENTE', 'OUTRO'] as const;
export const MOTIVOS_PERDA = ['PRECO', 'PRAZO', 'CONCORRENTE', 'DESISTENCIA', 'OUTRO'] as const;
export const ROTULO_MOTIVO: Record<string, string> = { PRECO: 'Preço', PRAZO: 'Prazo', CONCORRENTE: 'Concorrente', DESISTENCIA: 'Desistência', OUTRO: 'Outro motivo' };

export interface Perda {
  motivo: string;
  concorrente?: string | null;
  precoAceito?: string | null;
  observacao?: string | null;
}

/** O ciclo do orçamento move a oportunidade ligada a ele (criando quando ainda não existe). */
export async function sincronizarOportunidade(db: Db, o: Orcamento, etapa: EtapaOportunidade, perda?: Perda) {
  const existente = await db.oportunidade.findFirst({ where: { tenantId: o.tenantId, orcamentoId: o.id }, orderBy: { criadoEm: 'asc' } });
  const fim = etapa === 'GANHO' ? { ganhoEm: new Date(), perdidoEm: null } : etapa === 'PERDIDO' ? { perdidoEm: new Date(), ganhoEm: null } : {};
  const dadosPerda = perda
    ? { motivoPerda: perda.motivo, concorrente: perda.concorrente ?? null, precoAceito: perda.precoAceito ? pd(perda.precoAceito) : null, observacao: perda.observacao ?? null }
    : {};
  if (existente) {
    await db.oportunidade.updateMany({ where: { tenantId: o.tenantId, orcamentoId: o.id }, data: { etapa, valorEstimado: o.precoFinalLote.toDecimalPlaces(2), ...fim, ...dadosPerda } });
    return existente;
  }
  const anteriores = await db.orcamento.count({ where: { tenantId: o.tenantId, clienteId: o.clienteId, id: { not: o.id } } });
  return db.oportunidade.create({
    data: {
      tenantId: o.tenantId,
      titulo: o.titulo,
      clienteId: o.clienteId,
      origem: anteriores ? 'RECORRENTE' : 'OUTRO',
      etapa,
      valorEstimado: o.precoFinalLote.toDecimalPlaces(2),
      responsavelId: o.vendedorId,
      orcamentoId: o.id,
      ...fim,
      ...dadosPerda
    }
  });
}

/** Follow-ups da rotina diária: enviado sem resposta há 3 dias e validade em 2 dias. Não duplica (chave única). */
export async function criarFollowUps(db: Db, tenantId: string) {
  const hoje = hojeLocal();
  const tresDias = new Date(Date.now() - 3 * 86_400_000);
  const responsavelPadrao = (await db.usuario.findFirst({ where: { tenantId, ativo: true, perfil: { permissoes: { has: 'orcamento.aprovar_desconto' } } }, orderBy: { criadoEm: 'asc' } }))?.id;
  const candidatos = await db.orcamento.findMany({
    where: { tenantId, OR: [{ status: 'ENVIADO', enviadoEm: { lte: tresDias } }, { status: { in: ['ENVIADO', 'EM_NEGOCIACAO'] }, validade: dataBanco(somarDias(hoje, 2)) }] },
    include: { cliente: { select: { nome: true, fantasia: true } } }
  });
  let criadas = 0;
  for (const o of candidatos) {
    const responsavelId = o.vendedorId ?? responsavelPadrao;
    if (!responsavelId) continue;
    const cliente = o.cliente.fantasia || o.cliente.nome;
    const casos: [string, string][] = [];
    if (o.status === 'ENVIADO' && o.enviadoEm && o.enviadoEm <= tresDias) casos.push([`followup-sem-resposta-${o.id}-v${o.versao}`, `Retornar para ${cliente} sobre o ${o.numero}: enviado há 3 dias sem resposta`]);
    if (o.validade.getTime() === dataBanco(somarDias(hoje, 2)).getTime()) casos.push([`followup-validade-${o.id}-${o.validade.toISOString().slice(0, 10)}`, `${o.numero} vence em 2 dias: confirme com ${cliente}`]);
    for (const [chave, assunto] of casos) {
      const r = await db.atividade.createMany({
        data: [{ tenantId, tipo: 'LIGACAO', assunto, data: new Date(), clienteId: o.clienteId, orcamentoId: o.id, responsavelId, chave }],
        skipDuplicates: true
      });
      criadas += r.count;
    }
  }
  return criadas;
}

export const registrarMensagem = (db: Db, m: { tenantId: string; clienteId: string; canal: string; assunto: string; corpo: string; link?: string; usuarioId?: string | null }) =>
  db.mensagemCliente.create({ data: { ...m, link: m.link ?? null, usuarioId: m.usuarioId ?? null } });
