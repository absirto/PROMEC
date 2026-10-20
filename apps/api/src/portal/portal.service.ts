import { Injectable } from '@nestjs/common';
import { Orcamento } from '@prisma/client';
import { dec, reais, soma, type ResultadoOrcamento } from '@promec/motor';
import { TODAS } from '../acesso/permissoes';
import { auditar } from '../auditoria/auditoria.interceptor';
import { dataIso, tt } from '../comum/decimal';
import { conflito, ErroApi, invalido, naoEncontrado } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { registrarMensagem } from '../crm/crm-core';
import { notificar } from '../notificacoes/notificacoes-core';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { custoRealDa, incluirOs } from '../ordens/custo';
import { OrdensService } from '../ordens/ordens.service';
import { diasEntre } from '../financeiro/financeiro-core';
import { hojeLocal, local, somarDias, textoData } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { Db } from '../tabelas-custos/entrada';
import { assinarLink, lerLink, TipoLink } from './token';

const PORTAL_URL = () => (process.env.PORTAL_URL ?? 'http://localhost:5273/portal').replace(/\/$/, '');
const fimDoDia = (data: string) => new Date(`${data}T23:59:59-03:00`);
const dataBr = (d: string) => d.split('-').reverse().join('/');
const brl = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const primeiroNome = (n: string) => n.split(' ')[0];

/** Link vigente do recurso, sem renovar (o token é refeito a partir da versão gravada); cria se não houver. */
export async function linkVigente(db: Db, tenantId: string, tipo: TipoLink, recursoId: string, expiraEm: Date) {
  const l = await db.portalLink.findUnique({ where: { tipo_recursoId: { tipo, recursoId } } });
  if (!l || l.expiraEm.getTime() <= Date.now()) return gerarLink(db, tenantId, tipo, recursoId, expiraEm);
  const token = assinarLink({ t: l.tenantId, k: tipo, id: recursoId, v: l.versao, exp: Math.floor(l.expiraEm.getTime() / 1000) });
  return { token, url: `${PORTAL_URL()}/${tipo === 'ORCAMENTO' ? 'orcamento' : 'os'}/${token}`, expiraEm: l.expiraEm };
}

/** Gera (ou renova, invalidando o anterior) o link público de um orçamento ou OS. */
export async function gerarLink(db: Db, tenantId: string, tipo: TipoLink, recursoId: string, expiraEm: Date) {
  const l = await db.portalLink.upsert({
    where: { tipo_recursoId: { tipo, recursoId } },
    create: { tenantId, tipo, recursoId, versao: 1, expiraEm },
    update: { versao: { increment: 1 }, expiraEm }
  });
  const token = assinarLink({ t: tenantId, k: tipo, id: recursoId, v: l.versao, exp: Math.floor(expiraEm.getTime() / 1000) });
  return { token, url: `${PORTAL_URL()}/${tipo === 'ORCAMENTO' ? 'orcamento' : 'os'}/${token}`, expiraEm };
}

export const expiracaoOrcamento = (o: Pick<Orcamento, 'validade'>) => fimDoDia(somarDias(dataIso(o.validade), 30));
export const expiracaoOs = (os: { entregueEm: Date | null; prazo: Date }) => {
  const hoje = hojeLocal();
  const base = os.entregueEm ? local(os.entregueEm).data : textoData(os.prazo) > hoje ? textoData(os.prazo) : hoje;
  return fimDoDia(somarDias(base, 90));
};

const GRUPOS = {
  MATERIAL_PECAS: { rotulo: 'Material e peças', categorias: ['material', 'ferramental'] },
  MAO_DE_OBRA_MAQUINA: { rotulo: 'Mão de obra e máquina', categorias: ['horaMaquina', 'setup', 'maoDeObra', 'rateio'] },
  TERCEIROS_FRETE: { rotulo: 'Serviços de terceiros e frete', categorias: ['terceiros', 'frete'] }
} as const;

const SITUACAO_ORC: Record<string, string> = {
  ENVIADO: 'Aguardando sua aprovação',
  EM_NEGOCIACAO: 'Em ajuste com a nossa equipe',
  APROVADO: 'Aprovado',
  CONVERTIDO: 'Aprovado e em produção',
  RECUSADO: 'Não aprovado',
  EXPIRADO: 'Vencido',
  RASCUNHO: 'Em preparação'
};
const SITUACAO_OS: Record<string, string> = {
  ABERTA: 'Recebemos o seu pedido',
  EM_FILA: 'Na fila de produção',
  EM_EXECUCAO: 'Sendo produzido agora',
  PAUSADA: 'Produção pausada temporariamente',
  CONTROLE_QUALIDADE: 'Em inspeção de qualidade',
  CONCLUIDA: 'Pronto para retirada ou entrega',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelado'
};

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orcamentos: OrcamentosService,
    private readonly ordens: OrdensService
  ) {}

  // Links (rotas internas)

  async linkOrcamento(s: Sessao, id: string) {
    const o = await this.prisma.orcamento.findFirst({ where: { id, tenantId: s.tenantId }, include: { cliente: true, empresa: true } });
    if (!o) throw naoEncontrado('esse orçamento');
    if (!['ENVIADO', 'EM_NEGOCIACAO', 'APROVADO', 'CONVERTIDO'].includes(o.status)) {
      throw conflito('STATUS_INVALIDO', `${o.numero} ainda não foi enviado. Envie o orçamento antes de mandar o link ao cliente.`, { status: o.status });
    }
    const link = await gerarLink(this.prisma, s.tenantId, 'ORCAMENTO', o.id, expiracaoOrcamento(o));
    const vendedor = o.vendedorId ? await this.prisma.usuario.findUnique({ where: { id: o.vendedorId } }) : null;
    const contato = o.cliente.fantasia || o.cliente.nome;
    const texto = `Olá, ${contato}! Aqui é ${vendedor ? primeiroNome(vendedor.nome) : 'a equipe'} da ${o.empresa.nome}. O orçamento ${o.numero} (${o.titulo}) está pronto: ${brl(reais(tt(o.precoFinalLote)))}, válido até ${dataBr(dataIso(o.validade))}. Veja os detalhes e aprove por aqui: ${link.url}`;
    const email = {
      assunto: `Orçamento ${o.numero} — ${o.titulo}`,
      corpo: `Olá, ${contato}.\n\nPreparamos o orçamento ${o.numero} para ${o.titulo}.\nValor: ${brl(reais(tt(o.precoFinalLote)))}. Validade: ${dataBr(dataIso(o.validade))}.\n\nVocê pode ver a composição, a curva de lote e aprovar com um clique neste link:\n${link.url}\n\nQualquer dúvida, é só responder este e-mail.\n${vendedor?.nome ?? ''}\n${o.empresa.nome}`
    };
    await registrarMensagem(this.prisma, { tenantId: s.tenantId, clienteId: o.clienteId, canal: 'LINK_PORTAL', assunto: email.assunto, corpo: texto, link: link.url, usuarioId: s.id });
    return { url: link.url, expiraEm: link.expiraEm, whatsapp: whatsapp(o.cliente.telefone, texto), email };
  }

  async linkOs(s: Sessao, id: string) {
    const os = await this.prisma.ordemServico.findFirst({ where: { id, tenantId: s.tenantId }, include: { cliente: true, empresa: true } });
    if (!os) throw naoEncontrado('essa ordem de serviço');
    if (os.status === 'CANCELADA') throw conflito('STATUS_INVALIDO', `${os.numero} foi cancelada; não há o que acompanhar.`);
    const link = await gerarLink(this.prisma, s.tenantId, 'OS', os.id, expiracaoOs(os));
    const contato = os.cliente.fantasia || os.cliente.nome;
    const texto = `Olá, ${contato}! Acompanhe a ${os.numero} (${os.titulo}) da ${os.empresa.nome} em tempo real: etapa atual, prazo e peças prontas. ${link.url}`;
    const email = {
      assunto: `Acompanhe a ${os.numero} — ${os.titulo}`,
      corpo: `Olá, ${contato}.\n\nO seu serviço ${os.numero} (${os.titulo}) já está com a gente. Por este link você acompanha cada etapa e o prazo previsto (${dataBr(textoData(os.prazo))}):\n${link.url}\n\n${os.empresa.nome}`
    };
    await registrarMensagem(this.prisma, { tenantId: s.tenantId, clienteId: os.clienteId, canal: 'LINK_PORTAL', assunto: email.assunto, corpo: texto, link: link.url, usuarioId: s.id });
    return { url: link.url, expiraEm: link.expiraEm, whatsapp: whatsapp(os.cliente.telefone, texto), email };
  }

  // Rotas públicas

  async verOrcamento(token: string) {
    const o = await this.orcamentoDoToken(token);
    const [empresa, cliente, vendedor, aceite, osGerada] = await Promise.all([
      this.prisma.empresa.findUniqueOrThrow({ where: { id: o.tenantId } }),
      this.prisma.cliente.findUniqueOrThrow({ where: { id: o.clienteId } }),
      o.vendedorId ? this.prisma.usuario.findUnique({ where: { id: o.vendedorId } }) : null,
      this.prisma.aceiteOrcamento.findUnique({ where: { orcamentoId: o.id } }),
      this.prisma.ordemServico.findFirst({ where: { tenantId: o.tenantId, orcamentoId: o.id } })
    ]);
    const r = o.resultado as unknown as ResultadoOrcamento;
    const preco = dec(r.precoFinalLote);
    const base = dec(r.custoLote);
    const desconto = dec(tt(o.desconto));
    const nomes = Object.keys(GRUPOS) as (keyof typeof GRUPOS)[];
    const parciais = nomes.map((g) => soma(r.composicao.filter((c) => (GRUPOS[g].categorias as readonly string[]).includes(c.categoria)).map((c) => dec(c.valor))));
    const valores = parciais.map((p) => (base.gt(0) ? preco.times(p).div(base).toDecimalPlaces(2) : dec(0)));
    const ultimo = valores.map((v, i) => [v, i] as const).filter(([v]) => v.gt(0)).pop()?.[1];
    if (ultimo !== undefined) valores[ultimo] = preco.toDecimalPlaces(2).minus(soma(valores.filter((_, i) => i !== ultimo)));
    const hoje = hojeLocal();
    const objeto = (o.objeto ?? {}) as Record<string, unknown>;
    return {
      empresa: { nome: empresa.nome, logo: empresa.logoUrl, telefone: empresa.telefone },
      numero: o.numero,
      titulo: o.titulo,
      cliente: { nome: cliente.nome, contato: cliente.fantasia || cliente.nome, email: cliente.email || null, telefone: cliente.telefone || null },
      objeto: Object.fromEntries(['desenho', 'revisao', 'material', 'placa', 'veiculo', 'projeto'].map((k) => [k, objeto[k] ?? null])),
      lote: o.lote,
      precoFinalLote: reais(r.precoFinalLote),
      precoFinalUnitario: reais(r.precoFinalUnitario),
      desconto: { valor: reais(dec(r.precoLote).minus(r.precoFinalLote)), percentual: desconto.toFixed() },
      composicao: nomes.map((g, i) => ({ grupo: g, rotulo: GRUPOS[g].rotulo, valor: valores[i].toFixed(2) })).filter((x) => dec(x.valor).gt(0)),
      curvaLote: r.curvaLote
        .filter((p) => [10, 50, 100].includes(p.quantidade))
        .map((p) => ({ quantidade: p.quantidade, precoUnitario: reais(dec(p.precoUnitario).times(dec(1).minus(desconto))) })),
      prazoPrometido: o.prazoPrometido ? dataIso(o.prazoPrometido) : null,
      condicaoPagamento: o.condicaoPagamento || (await this.prisma.parametros.findUnique({ where: { tenantId: o.tenantId } }))?.condicaoPadrao || 'à vista',
      validade: dataIso(o.validade),
      diasRestantes: Math.max(0, diasEntre(hoje, dataIso(o.validade))),
      vendedor: vendedor ? { nome: vendedor.nome, telefone: vendedor.telefone } : null,
      status: o.status,
      situacao: SITUACAO_ORC[o.status] ?? o.status,
      aceite: aceite ? saidaAceite(aceite) : null,
      os: osGerada ? await this.acompanhamento(osGerada) : null
    };
  }

  private async acompanhamento(os: { id: string; tenantId: string; numero: string; prazo: Date; entregueEm: Date | null }) {
    const link = await linkVigente(this.prisma, os.tenantId, 'OS', os.id, expiracaoOs(os));
    return { numero: os.numero, prazo: textoData(os.prazo), linkAcompanhamento: link.url };
  }

  async aprovar(token: string, dto: { nome: string; aceite: boolean }, ip: string, userAgent: string) {
    if (dto.aceite !== true) throw invalido('Marque o aceite para aprovar o orçamento.', [{ campo: 'aceite', mensagem: 'aceite precisa ser verdadeiro' }]);
    const o = await this.orcamentoDoToken(token);
    const existente = await this.prisma.aceiteOrcamento.findUnique({ where: { orcamentoId: o.id } });
    if (o.status === 'APROVADO' || o.status === 'CONVERTIDO') {
      throw conflito('JA_APROVADO', `O orçamento ${o.numero} já foi aprovado${existente ? ` por ${existente.nome} em ${dataBr(local(existente.data).data)}` : ''}. Fique tranquilo: a produção já está encaminhada.`, {
        aceite: existente ? saidaAceite(existente) : null
      });
    }
    if (o.status === 'EXPIRADO' || dataIso(o.validade) < hojeLocal()) {
      throw conflito('ORCAMENTO_VENCIDO', `A validade do orçamento ${o.numero} terminou em ${dataBr(dataIso(o.validade))}. Fale com a nossa equipe para receber uma versão atualizada.`);
    }
    if (o.status !== 'ENVIADO' && o.status !== 'EM_NEGOCIACAO') {
      throw conflito('STATUS_INVALIDO', `O orçamento ${o.numero} não está disponível para aprovação. Fale com a nossa equipe.`);
    }
    const sessao = await this.sessaoDoPortal(o);
    const aceite = await this.prisma.aceiteOrcamento.upsert({
      where: { orcamentoId: o.id },
      create: { tenantId: o.tenantId, orcamentoId: o.id, versao: o.versao, nome: dto.nome.trim(), ip, userAgent, precoFinalLote: o.precoFinalLote },
      update: { versao: o.versao, nome: dto.nome.trim(), ip, userAgent, precoFinalLote: o.precoFinalLote, data: new Date() }
    });
    await this.orcamentos.aprovar(sessao, o.id);
    const os = await this.ordens.converter(sessao, o.id);
    await auditar(this.prisma, { tenantId: o.tenantId, entidade: 'Orcamento', entidadeId: o.id, acao: 'aprovado_no_portal', rota: 'POST /portal/orcamento/:token/aprovar', depois: { aceite: saidaAceite(aceite), os: os.numero } });
    await notificar(this.prisma, o.tenantId, {
      permissoes: ['orcamentos.visualizar'],
      usuarioIds: [o.vendedorId],
      tipo: 'SUCESSO',
      titulo: `${o.numero} aprovado pelo cliente`,
      mensagem: `${dto.nome.trim()} aprovou ${o.titulo} pelo portal (${brl(reais(tt(o.precoFinalLote)))}). A ${os.numero} já entrou na fila.`,
      link: `/ordens-servico/${os.id}`,
      chave: `portal-aprovado-${o.id}`
    });
    const criada = await this.prisma.ordemServico.findUniqueOrThrow({ where: { id: os.id } });
    return { os: await this.acompanhamento(criada), aceite: saidaAceite(aceite) };
  }

  async ajuste(token: string, dto: { nome: string; mensagem: string }) {
    const o = await this.orcamentoDoToken(token);
    if (o.status !== 'ENVIADO' && o.status !== 'EM_NEGOCIACAO') {
      throw conflito('STATUS_INVALIDO', `O orçamento ${o.numero} não aceita pedidos de ajuste agora (${(SITUACAO_ORC[o.status] ?? o.status).toLowerCase()}). Fale com a nossa equipe.`);
    }
    const sessao = await this.sessaoDoPortal(o);
    if (o.status === 'ENVIADO') await this.orcamentos.negociar(sessao, o.id);
    const texto = `${dto.nome.trim()} pediu ajuste: ${dto.mensagem.trim()}`;
    await this.prisma.atividade.create({
      data: { tenantId: o.tenantId, tipo: 'TAREFA', assunto: `Ajuste pedido no portal para o ${o.numero}`, data: new Date(), clienteId: o.clienteId, orcamentoId: o.id, responsavelId: sessao.id, observacao: texto }
    });
    await registrarMensagem(this.prisma, { tenantId: o.tenantId, clienteId: o.clienteId, canal: 'PORTAL', assunto: `Pedido de ajuste no ${o.numero}`, corpo: texto });
    await notificar(this.prisma, o.tenantId, {
      permissoes: ['orcamentos.gerenciar'],
      usuarioIds: [o.vendedorId],
      tipo: 'ATENCAO',
      titulo: `Ajuste pedido no ${o.numero}`,
      mensagem: texto,
      link: `/orcamentos/${o.id}`
    });
    await auditar(this.prisma, { tenantId: o.tenantId, entidade: 'Orcamento', entidadeId: o.id, acao: 'ajuste_no_portal', rota: 'POST /portal/orcamento/:token/ajuste', depois: { nome: dto.nome, mensagem: dto.mensagem } });
    return { status: 'EM_NEGOCIACAO', mensagem: 'Recebemos o seu pedido de ajuste. A nossa equipe vai revisar o orçamento e falar com você em breve.' };
  }

  async verOs(token: string) {
    const os = await this.osDoToken(token);
    const [empresa, historico, consumo, inspecao, titulos, avaliacao, orcamento] = await Promise.all([
      this.prisma.empresa.findUniqueOrThrow({ where: { id: os.tenantId } }),
      this.prisma.osHistorico.findMany({ where: { osId: os.id }, orderBy: { data: 'asc' } }),
      this.prisma.movimento.findFirst({ where: { osId: os.id, tipo: 'SAIDA_OS' }, orderBy: { data: 'asc' } }),
      this.prisma.inspecao.findFirst({ where: { osId: os.id }, orderBy: { data: 'asc' } }),
      this.prisma.titulo.findMany({ where: { tenantId: os.tenantId, origemTipo: 'OS', origemId: os.id, status: { not: 'CANCELADO' } }, orderBy: { vencimento: 'asc' } }),
      this.prisma.avaliacaoNps.findUnique({ where: { osId: os.id } }),
      os.orcamentoId ? this.prisma.orcamento.findUnique({ where: { id: os.orcamentoId } }) : null
    ]);
    const quando = (evento: string) => historico.find((h) => h.evento === evento)?.data ?? null;
    const apontamento = os.operacoes.flatMap((o) => o.apontamentos).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
    const etapas = [
      { etapa: 'APROVADO', rotulo: 'Aprovado', data: orcamento?.aprovadoEm ?? os.criadoEm },
      { etapa: 'MATERIAL_SEPARADO', rotulo: 'Material separado', data: consumo?.data ?? null },
      { etapa: 'NA_MAQUINA', rotulo: 'Na máquina', data: apontamento?.inicio ?? quando('execucao_iniciada') },
      { etapa: 'INSPECAO', rotulo: 'Inspeção', data: quando('operacoes_encerradas') ?? inspecao?.data ?? null },
      { etapa: os.status === 'ENTREGUE' ? 'ENTREGUE' : 'PRONTO', rotulo: os.status === 'ENTREGUE' ? 'Entregue' : 'Pronto', data: os.entregueEm ?? quando('inspecao_aprovada') }
    ].map((e) => ({ ...e, concluida: !!e.data }));
    const producao = os.operacoes.filter((o) => !o.retrabalho);
    const ultima = producao[producao.length - 1];
    const prontas = ultima ? ultima.apontamentos.reduce((a, x) => a + x.quantidadeBoa, 0) : 0;
    const atual = os.operacoes.find((o) => o.status !== 'CONCLUIDA') ?? ultima;
    const responsavel = atual?.colaboradorId ? await this.prisma.colaborador.findUnique({ where: { id: atual.colaboradorId } }) : null;
    const prazo = textoData(os.prazo);
    const hoje = hojeLocal();
    return {
      empresa: { nome: empresa.nome, logo: empresa.logoUrl, telefone: empresa.telefone },
      numero: os.numero,
      titulo: os.titulo,
      status: os.status,
      situacao: SITUACAO_OS[os.status] ?? os.status,
      etapas,
      pecas: { prontas: Math.min(prontas, os.lote), lote: os.lote },
      progresso: custoRealDa(os).progresso,
      prazo,
      noPrazo: os.status === 'ENTREGUE' ? local(os.entregueEm!).data <= prazo : prazo >= hoje,
      responsavel: responsavel ? { nome: primeiroNome(responsavel.nome), funcao: responsavel.funcao } : null,
      titulos: titulos.map((t) => ({ numero: t.numero, parcela: t.parcela, vencimento: textoData(t.vencimento), valor: reais(tt(t.valor)), status: t.status })),
      laudo: { disponivel: os.status === 'ENTREGUE' },
      entregueEm: os.entregueEm,
      avaliacao: avaliacao ? { nota: avaliacao.nota, comentario: avaliacao.comentario, data: avaliacao.data } : null,
      podeAvaliar: os.status === 'ENTREGUE' && !avaliacao
    };
  }

  async avaliar(token: string, dto: { nota: number; comentario?: string }, ip: string) {
    const os = await this.osDoToken(token);
    if (os.status !== 'ENTREGUE') throw conflito('OS_NAO_ENTREGUE', 'A avaliação abre depois da entrega. Assim que o serviço chegar até você, conte como foi.');
    if (await this.prisma.avaliacaoNps.findUnique({ where: { osId: os.id } })) {
      throw conflito('JA_AVALIADA', 'Já recebemos a sua avaliação deste serviço. Muito obrigado!');
    }
    const a = await this.prisma.avaliacaoNps.create({ data: { tenantId: os.tenantId, osId: os.id, clienteId: os.clienteId, nota: dto.nota, comentario: dto.comentario?.trim() || null, ip } });
    return { nota: a.nota, comentario: a.comentario, data: a.data, mensagem: 'Obrigado pela avaliação! Ela ajuda a gente a melhorar a cada entrega.' };
  }

  private async sessaoDoPortal(o: Orcamento): Promise<Sessao> {
    const u =
      (o.vendedorId ? await this.prisma.usuario.findUnique({ where: { id: o.vendedorId } }) : null) ??
      (await this.prisma.usuario.findFirst({ where: { tenantId: o.tenantId, ativo: true }, orderBy: { criadoEm: 'asc' } }));
    return { id: u?.id ?? 'portal', tenantId: o.tenantId, papel: 'GESTOR', nome: 'Portal do cliente', permissoes: TODAS };
  }

  private async conferir(token: string, tipo: TipoLink) {
    const c = lerLink(token);
    const link = c && c.k === tipo ? await this.prisma.portalLink.findUnique({ where: { tipo_recursoId: { tipo, recursoId: c.id } } }) : null;
    if (!c || !link || link.versao !== c.v || link.tenantId !== c.t) {
      throw new ErroApi(401, 'LINK_INVALIDO', 'Este link não é mais válido: ele venceu ou foi substituído por um mais novo. Peça um novo link a quem enviou o orçamento.');
    }
    return c;
  }

  private async orcamentoDoToken(token: string) {
    const c = await this.conferir(token, 'ORCAMENTO');
    const o = await this.prisma.orcamento.findFirst({ where: { id: c.id, tenantId: c.t } });
    if (!o) throw new ErroApi(401, 'LINK_INVALIDO', 'Este link não é mais válido. Peça um novo link a quem enviou o orçamento.');
    return o;
  }

  private async osDoToken(token: string) {
    const c = await this.conferir(token, 'OS');
    const os = await this.prisma.ordemServico.findFirst({ where: { id: c.id, tenantId: c.t }, include: incluirOs });
    if (!os) throw new ErroApi(401, 'LINK_INVALIDO', 'Este link não é mais válido. Peça um novo link a quem enviou a ordem de serviço.');
    return os;
  }
}

function whatsapp(telefone: string | null | undefined, texto: string) {
  const d = (telefone ?? '').replace(/\D/g, '');
  const numero = d ? (d.startsWith('55') ? d : `55${d}`) : '';
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

const saidaAceite = (a: { nome: string; ip: string; userAgent: string; data: Date; versao: number }) => ({ nome: a.nome, ip: a.ip, userAgent: a.userAgent, data: a.data, versao: a.versao });
