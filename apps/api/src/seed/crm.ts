import { EtapaOportunidade, PrismaClient } from '@prisma/client';
import { pd } from '../comum/decimal';
import { registrarMensagem } from '../crm/crm-core';
import { notificar } from '../notificacoes/notificacoes-core';
import { hojeLocal, somarDias } from '../planejamento/calendario';
import { expiracaoOrcamento, expiracaoOs, gerarLink } from '../portal/portal.service';

/** Funil, atividades do Paulo, links do portal (ORC-128 e OS-41), NPS da OS-37 e notificações da Marina. */
export async function semearCrm(db: PrismaClient, tenantId: string, id: (s: string) => string) {
  const hoje = hojeLocal();
  const paulo = id('usuario-paulo');
  const marina = id('usuario-marina');
  const em = (dias: number, hora = '10:00') => new Date(`${somarDias(hoje, dias)}T${hora}:00-03:00`);
  const orc = async (n: number) => db.orcamento.findUnique({ where: { id: id(`orcamento-${n}`) } });

  const oportunidades: { chave: string; titulo: string; cliente?: string; contato?: string; origem: string; etapa: EtapaOportunidade; valor?: string; orcamento?: number; perda?: { motivo: string; concorrente?: string; precoAceito?: string; observacao?: string }; dias: number }[] = [
    { chave: 'lead', titulo: 'Pinos de articulação para colheitadeira', contato: 'Rafael Brandt — AgroSul Implementos · (47) 99880-1122', origem: 'SITE', etapa: 'LEAD', valor: '6200', dias: 2 },
    { chave: 'contato', titulo: 'Eixos para redutor de esteira', cliente: 'tupinamba', contato: 'Sérgio (manutenção)', origem: 'VISITA', etapa: 'CONTATO', valor: '9800', dias: 6 },
    { chave: 'enviado', titulo: 'Bucha de latão H7 — lote piloto', cliente: 'metalvale', contato: 'Carlos (compras)', origem: 'RECORRENTE', etapa: 'ORCAMENTO_ENVIADO', orcamento: 128, dias: 3 },
    { chave: 'negociacao', titulo: 'Flange inox 316 DN100', cliente: 'babitonga', contato: 'Eng. Patrícia', origem: 'INDICACAO', etapa: 'NEGOCIACAO', orcamento: 126, dias: 20 },
    { chave: 'ganho-eixo', titulo: 'Eixo de transmissão SAE 1045', cliente: 'schroeder', contato: 'Juliano (suprimentos)', origem: 'RECORRENTE', etapa: 'GANHO', orcamento: 124, dias: 12 },
    { chave: 'ganho-bucha', titulo: 'Bucha de latão H7 — lote de 10', cliente: 'metalvale', contato: 'Carlos (compras)', origem: 'RECORRENTE', etapa: 'GANHO', orcamento: 121, dias: 2 },
    { chave: 'ganho-pino', titulo: 'Pino de articulação para escavadeira', cliente: 'schroeder', contato: 'Juliano (suprimentos)', origem: 'TELEFONE', etapa: 'GANHO', orcamento: 122, dias: 5 },
    { chave: 'perdido-prazo', titulo: 'Placa base de molde P20', cliente: 'pirabeiraba', contato: 'Ana (ferramentaria)', origem: 'WHATSAPP', etapa: 'PERDIDO', orcamento: 125, perda: { motivo: 'PRAZO', concorrente: 'Ferramentaria de Curitiba', observacao: 'Precisavam em 5 dias úteis' }, dias: 10 },
    { chave: 'perdido-preco', titulo: 'Buchas de bronze para prensa', cliente: 'schroeder', contato: 'Juliano (suprimentos)', origem: 'RECORRENTE', etapa: 'PERDIDO', valor: '4800', perda: { motivo: 'PRECO', concorrente: 'Usinagem Pomerode', precoAceito: '4100', observacao: 'Aceitariam até R$ 4.100 com entrega em 15 dias' }, dias: 25 }
  ];
  for (const op of oportunidades) {
    const o = op.orcamento ? await orc(op.orcamento) : null;
    const criadoEm = new Date(Date.now() - op.dias * 86_400_000);
    const dados = {
      tenantId,
      titulo: op.titulo,
      clienteId: op.cliente ? id(`cliente-${op.cliente}`) : null,
      contato: op.contato ?? '',
      origem: op.origem,
      etapa: op.etapa,
      valorEstimado: pd(o ? o.precoFinalLote.toDecimalPlaces(2).toFixed() : (op.valor ?? '0')),
      responsavelId: paulo,
      orcamentoId: o?.id ?? null,
      motivoPerda: op.perda?.motivo ?? null,
      concorrente: op.perda?.concorrente ?? null,
      precoAceito: op.perda?.precoAceito ? pd(op.perda.precoAceito) : null,
      observacao: op.perda?.observacao ?? null,
      ganhoEm: op.etapa === 'GANHO' ? (o?.aprovadoEm ?? new Date()) : null,
      perdidoEm: op.etapa === 'PERDIDO' ? (o?.recusadoEm ?? new Date(criadoEm.getTime() + 5 * 86_400_000)) : null,
      criadoEm
    };
    await db.oportunidade.upsert({ where: { id: id(`op-${op.chave}`) }, create: { id: id(`op-${op.chave}`), ...dados }, update: dados });
  }

  const atividades = [
    { chave: 'retorno-128', tipo: 'LIGACAO', assunto: 'Confirmar recebimento do ORC-2026-00128 com o Carlos', data: em(1, '09:30'), cliente: 'metalvale', op: 'enviado', orcamento: 128 },
    { chave: 'visita-babitonga', tipo: 'VISITA', assunto: 'Visita ao estaleiro para fechar a flange DN100', data: em(2, '14:00'), cliente: 'babitonga', op: 'negociacao', orcamento: 126 },
    { chave: 'lead-agrosul', tipo: 'TAREFA', assunto: 'Pedir desenho e quantidade dos pinos para orçar', data: em(3, '11:00'), op: 'lead' },
    { chave: 'tupinamba', tipo: 'EMAIL', assunto: 'Enviar portfólio de eixos e certificados de material', data: em(-1, '16:00'), cliente: 'tupinamba', op: 'contato' }
  ];
  for (const a of atividades) {
    const dados = {
      tenantId,
      tipo: a.tipo,
      assunto: a.assunto,
      data: a.data,
      clienteId: a.cliente ? id(`cliente-${a.cliente}`) : null,
      oportunidadeId: id(`op-${a.op}`),
      orcamentoId: a.orcamento ? id(`orcamento-${a.orcamento}`) : null,
      responsavelId: paulo,
      concluida: false,
      concluidaEm: null,
      resultado: null
    };
    await db.atividade.upsert({ where: { id: id(`ativ-${a.chave}`) }, create: { id: id(`ativ-${a.chave}`), ...dados }, update: dados });
  }
  const feita = {
    tenantId,
    tipo: 'MENSAGEM',
    assunto: 'Avisar a Hidráulica Schroeder que o eixo entrou em produção',
    data: em(-4, '08:30'),
    clienteId: id('cliente-schroeder'),
    oportunidadeId: id('op-ganho-eixo'),
    orcamentoId: id('orcamento-124'),
    responsavelId: paulo,
    concluida: true,
    concluidaEm: em(-4, '08:45'),
    resultado: 'Juliano confirmou o prazo e pediu o laudo dimensional junto com a entrega'
  };
  await db.atividade.upsert({ where: { id: id('ativ-schroeder-feita') }, create: { id: id('ativ-schroeder-feita'), ...feita }, update: feita });

  const o128 = await db.orcamento.findUniqueOrThrow({ where: { id: id('orcamento-128') } });
  const linkOrcamento = await gerarLink(db, tenantId, 'ORCAMENTO', o128.id, expiracaoOrcamento(o128));
  const os41 = await db.ordemServico.findUniqueOrThrow({ where: { id: id('os-41') } });
  const linkOs = await gerarLink(db, tenantId, 'OS', os41.id, expiracaoOs(os41));
  if (!(await db.mensagemCliente.findFirst({ where: { tenantId, clienteId: o128.clienteId, link: linkOrcamento.url } }))) {
    await registrarMensagem(db, {
      tenantId,
      clienteId: o128.clienteId,
      canal: 'LINK_PORTAL',
      assunto: `Orçamento ${o128.numero} — ${o128.titulo}`,
      corpo: `Olá, Carlos! Aqui é o Paulo da Usinagem Joinville. O orçamento ${o128.numero} está pronto. Veja os detalhes e aprove por aqui: ${linkOrcamento.url}`,
      link: linkOrcamento.url,
      usuarioId: paulo
    });
  }

  const os37 = await db.ordemServico.findUniqueOrThrow({ where: { id: id('os-37') } });
  const nps = { tenantId, clienteId: os37.clienteId, nota: 9, comentario: 'Engrenagens dentro da cota e entregues antes do prazo. O laudo ajudou na nossa inspeção de recebimento.', data: new Date(Date.now() - 12 * 86_400_000) };
  await db.avaliacaoNps.upsert({ where: { osId: os37.id }, create: { osId: os37.id, ...nps }, update: nps });

  const avisos = [
    { tipo: 'SUCESSO' as const, titulo: 'ORC-2026-00124 aprovado', mensagem: 'A Hidráulica Schroeder aprovou o eixo de transmissão; a OS-2026-00038 já está no controle de qualidade.', link: `/orcamentos/${id('orcamento-124')}`, chave: 'seed-aprovado-124' },
    { tipo: 'ATENCAO' as const, titulo: 'Margem a liberar no ORC-2026-00127', mensagem: 'Pino guia temperado ficou com margem de 12,7%, abaixo do mínimo de 15%. Libere ou peça ajuste antes do envio.', link: `/orcamentos/${id('orcamento-127')}`, chave: 'seed-margem-127' },
    { tipo: 'ATENCAO' as const, titulo: 'OS-2026-00039 parada por falta de peça', mensagem: 'A barra inox 420 Ø40 não chegou. O fornecedor promete para amanhã.', link: `/ordens-servico/${id('os-39')}`, chave: 'seed-parada-39' },
    { tipo: 'INFO' as const, titulo: 'Chapa 3/16" abaixo do mínimo', mensagem: 'Disponível 60 kg, mínimo 150 kg. A requisição REQ-2026-00001 está aberta.', link: '/compras/requisicoes', chave: 'seed-chapa' },
    { tipo: 'ERRO' as const, titulo: 'CR vencido há mais de 30 dias', mensagem: 'Ferramentaria Pirabeiraba tem título vencido e foi bloqueada para novos orçamentos.', link: '/financeiro/titulos?tipo=RECEBER&status=VENCIDO', chave: 'seed-pirabeiraba' }
  ];
  for (const a of avisos) await notificar(db, tenantId, { permissoes: [], usuarioIds: [marina], ...a });

  return { tokenOrcamento128: linkOrcamento.token, urlOrcamento128: linkOrcamento.url, tokenOs41: linkOs.token, urlOs41: linkOs.url };
}

/**
 * Devolve o comercial da empresa de demonstração ao estado semeado: apaga CRM, portal e notificações,
 * e remove as OS criadas a partir dos orçamentos canônicos (por exemplo, aprovação do ORC-128 pelo portal).
 */
export async function limparComercialDemo(db: PrismaClient, tenantId: string, prefixo: string) {
  const fora = { NOT: { id: { startsWith: `${prefixo}-` } } };
  const osIds = (await db.ordemServico.findMany({ where: { tenantId, ...fora }, select: { id: true } })).map((o) => o.id);
  const orcIds = (await db.orcamento.findMany({ where: { tenantId, ...fora }, select: { id: true } })).map((o) => o.id);
  await db.$transaction([
    db.oportunidade.deleteMany({ where: { tenantId } }),
    db.atividade.deleteMany({ where: { tenantId } }),
    db.notificacao.deleteMany({ where: { tenantId } }),
    db.mensagemCliente.deleteMany({ where: { tenantId } }),
    db.portalLink.deleteMany({ where: { tenantId } }),
    db.aceiteOrcamento.deleteMany({ where: { tenantId } }),
    db.avaliacaoNps.deleteMany({ where: { tenantId } }),
    db.reserva.deleteMany({ where: { tenantId, osId: { in: osIds } } }),
    db.movimento.deleteMany({ where: { tenantId, osId: { in: osIds } } }),
    db.naoConformidade.deleteMany({ where: { tenantId, osId: { in: osIds } } }),
    db.garantia.deleteMany({ where: { tenantId, OR: [{ osId: { in: osIds } }, { osGarantiaId: { in: osIds } }] } }),
    db.requisicao.updateMany({ where: { tenantId, osId: { in: osIds } }, data: { osId: null } }),
    db.ordemServico.deleteMany({ where: { id: { in: osIds } } }),
    db.orcamento.deleteMany({ where: { id: { in: orcIds } } }),
    db.sequencia.updateMany({ where: { tenantId, chave: 'OS-2026' }, data: { valor: 41 } }),
    db.sequencia.updateMany({ where: { tenantId, chave: 'ORC-2026' }, data: { valor: 128 } })
  ]);

  // Usuários que a semente não criou: apaga quem não deixou rastro; desativa quem deixou.
  const extras = await db.usuario.findMany({ where: { tenantId, ...fora } });
  for (const u of extras) {
    const rastros = await Promise.all([
      db.auditLog.count({ where: { tenantId, usuarioId: u.id } }),
      db.orcamento.count({ where: { tenantId, vendedorId: u.id } }),
      db.orcamentoHistorico.count({ where: { tenantId, usuarioId: u.id } }),
      db.osHistorico.count({ where: { tenantId, usuarioId: u.id } }),
      db.movimento.count({ where: { tenantId, usuarioId: u.id } }),
      db.tituloHistorico.count({ where: { tenantId, usuarioId: u.id } })
    ]);
    if (rastros.some((n) => n > 0)) await db.usuario.update({ where: { id: u.id }, data: { ativo: false } });
    else await db.usuario.delete({ where: { id: u.id } });
  }
  return osIds.length;
}
