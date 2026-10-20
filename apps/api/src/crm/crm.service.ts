import { Injectable } from '@nestjs/common';
import { EtapaOportunidade, Oportunidade, Prisma } from '@prisma/client';
import { dec, soma, txt } from '@promec/motor';
import { dataIso, pd, tt } from '../comum/decimal';
import { naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { diasAtraso, saldoDo } from '../financeiro/financeiro-core';
import { hojeLocal, textoData } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { ETAPAS, MOTIVOS_PERDA, Perda } from './crm-core';
import { AtividadeDto, AtualizarAtividadeDto, AtualizarOportunidadeDto, ConcluirAtividadeDto, OportunidadeDto, PerdaDto } from './crm.dto';

const DIA = 86_400_000;

/** PRECO sem o valor que o cliente aceitaria não ajuda a análise de margem. */
export function conferirPerda(p: Perda) {
  if (!(MOTIVOS_PERDA as readonly string[]).includes(p.motivo)) throw regra('MOTIVO_INVALIDO', `Use um dos motivos: ${MOTIVOS_PERDA.join(', ')}.`);
  if (p.motivo === 'PRECO' && (p.precoAceito === undefined || p.precoAceito === null || p.precoAceito === '')) {
    throw regra('PRECO_ACEITO_OBRIGATORIO', 'Quando o motivo é preço, informe quanto o cliente aceitaria pagar. Esse número alimenta a análise de margem.');
  }
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async oportunidades(tenantId: string, f: { etapa?: string; responsavelId?: string; q?: string }) {
    const termo = f.q?.trim();
    const ops = await this.prisma.oportunidade.findMany({
      where: {
        tenantId,
        ...(ETAPAS.includes(f.etapa as EtapaOportunidade) ? { etapa: f.etapa as EtapaOportunidade } : {}),
        ...(f.responsavelId ? { responsavelId: f.responsavelId } : {}),
        ...(termo ? { OR: [{ titulo: { contains: termo, mode: 'insensitive' } }, { contato: { contains: termo, mode: 'insensitive' } }] } : {})
      },
      orderBy: { atualizadoEm: 'desc' }
    });
    const todas = await this.prisma.oportunidade.groupBy({ by: ['etapa'], where: { tenantId }, _count: { _all: true }, _sum: { valorEstimado: true } });
    const itens = await this.saida(tenantId, ops);
    return {
      itens,
      total: itens.length,
      funil: Object.fromEntries(
        ETAPAS.map((e) => {
          const g = todas.find((x) => x.etapa === e);
          return [e, { quantidade: g?._count._all ?? 0, valor: dec(g?._sum.valorEstimado ? tt(g._sum.valorEstimado) : 0).toFixed(2) }];
        })
      )
    };
  }

  async oportunidade(tenantId: string, id: string) {
    return (await this.saida(tenantId, [await this.buscar(tenantId, id)]))[0];
  }

  async criarOportunidade(s: Sessao, dto: OportunidadeDto) {
    await this.vinculos(s.tenantId, dto);
    const o = await this.prisma.oportunidade.create({
      data: {
        tenantId: s.tenantId,
        titulo: dto.titulo.trim(),
        clienteId: dto.clienteId ?? null,
        contato: dto.contato ?? '',
        origem: dto.origem ?? 'OUTRO',
        etapa: dto.etapa ?? 'LEAD',
        valorEstimado: pd(dto.valorEstimado ?? 0),
        responsavelId: dto.responsavelId ?? s.id,
        orcamentoId: dto.orcamentoId ?? null,
        observacao: dto.observacao ?? null
      }
    });
    return this.oportunidade(s.tenantId, o.id);
  }

  async atualizarOportunidade(tenantId: string, id: string, dto: AtualizarOportunidadeDto) {
    await this.buscar(tenantId, id);
    await this.vinculos(tenantId, dto);
    await this.prisma.oportunidade.update({
      where: { id },
      data: {
        titulo: dto.titulo?.trim(),
        clienteId: dto.clienteId,
        contato: dto.contato,
        origem: dto.origem,
        valorEstimado: dto.valorEstimado !== undefined ? pd(dto.valorEstimado) : undefined,
        responsavelId: dto.responsavelId,
        orcamentoId: dto.orcamentoId,
        observacao: dto.observacao
      }
    });
    return this.oportunidade(tenantId, id);
  }

  async mover(tenantId: string, id: string, etapa: EtapaOportunidade) {
    await this.buscar(tenantId, id);
    if (etapa === 'PERDIDO') throw regra('USE_PERDER', 'Para marcar como perdida, informe o motivo pela ação de perder a oportunidade.');
    await this.prisma.oportunidade.update({ where: { id }, data: { etapa, ...(etapa === 'GANHO' ? { ganhoEm: new Date() } : {}) } });
    return this.oportunidade(tenantId, id);
  }

  async perder(tenantId: string, id: string, dto: PerdaDto) {
    await this.buscar(tenantId, id);
    const perda = { motivo: dto.motivo, concorrente: dto.concorrente, precoAceito: dto.precoAceito !== undefined ? String(dto.precoAceito) : undefined, observacao: dto.observacao };
    conferirPerda(perda);
    await this.prisma.oportunidade.update({
      where: { id },
      data: {
        etapa: 'PERDIDO',
        perdidoEm: new Date(),
        motivoPerda: dto.motivo,
        concorrente: dto.concorrente ?? null,
        precoAceito: perda.precoAceito ? pd(perda.precoAceito) : null,
        observacao: dto.observacao ?? null
      }
    });
    return this.oportunidade(tenantId, id);
  }

  async atividades(tenantId: string, f: { responsavelId?: string; de?: string; ate?: string; pendentes?: string; clienteId?: string }) {
    const as = await this.prisma.atividade.findMany({
      where: {
        tenantId,
        ...(f.responsavelId ? { responsavelId: f.responsavelId } : {}),
        ...(f.clienteId ? { clienteId: f.clienteId } : {}),
        ...(f.pendentes === 'true' ? { concluida: false } : {}),
        ...(f.de || f.ate
          ? { data: { ...(f.de ? { gte: new Date(`${f.de.slice(0, 10)}T00:00:00-03:00`) } : {}), ...(f.ate ? { lt: new Date(new Date(`${f.ate.slice(0, 10)}T00:00:00-03:00`).getTime() + DIA) } : {}) } }
          : {})
      },
      orderBy: { data: 'asc' }
    });
    const itens = await this.saidaAtividades(tenantId, as);
    return { itens, total: itens.length };
  }

  async criarAtividade(tenantId: string, dto: AtividadeDto) {
    await this.vinculosAtividade(tenantId, dto);
    const a = await this.prisma.atividade.create({
      data: {
        tenantId,
        tipo: dto.tipo,
        assunto: dto.assunto.trim(),
        data: new Date(dto.data),
        clienteId: dto.clienteId ?? null,
        oportunidadeId: dto.oportunidadeId ?? null,
        orcamentoId: dto.orcamentoId ?? null,
        responsavelId: dto.responsavelId,
        observacao: dto.observacao ?? null
      }
    });
    return (await this.saidaAtividades(tenantId, [a]))[0];
  }

  async atualizarAtividade(tenantId: string, id: string, dto: AtualizarAtividadeDto) {
    await this.atividade(tenantId, id);
    await this.vinculosAtividade(tenantId, dto);
    const a = await this.prisma.atividade.update({
      where: { id },
      data: {
        tipo: dto.tipo,
        assunto: dto.assunto?.trim(),
        data: dto.data ? new Date(dto.data) : undefined,
        clienteId: dto.clienteId,
        oportunidadeId: dto.oportunidadeId,
        orcamentoId: dto.orcamentoId,
        responsavelId: dto.responsavelId,
        observacao: dto.observacao
      }
    });
    return (await this.saidaAtividades(tenantId, [a]))[0];
  }

  async concluirAtividade(tenantId: string, id: string, dto: ConcluirAtividadeDto) {
    const a = await this.atividade(tenantId, id);
    if (a.concluida) throw regra('ATIVIDADE_CONCLUIDA', 'Essa atividade já foi concluída.');
    const [feita, proxima] = await this.prisma.$transaction(async (tx) => {
      const feita = await tx.atividade.update({ where: { id }, data: { concluida: true, concluidaEm: new Date(), resultado: dto.resultado.trim() } });
      const proxima = dto.proximoPasso
        ? await tx.atividade.create({
            data: {
              tenantId,
              tipo: dto.proximoPasso.tipo,
              assunto: dto.proximoPasso.assunto.trim(),
              data: new Date(dto.proximoPasso.data),
              clienteId: a.clienteId,
              oportunidadeId: a.oportunidadeId,
              orcamentoId: a.orcamentoId,
              responsavelId: a.responsavelId
            }
          })
        : null;
      return [feita, proxima] as const;
    });
    const [saida, prox] = await this.saidaAtividades(tenantId, proxima ? [feita, proxima] : [feita]);
    return { ...saida, proximaAtividade: prox ?? null };
  }

  async indicadores(tenantId: string, meses: number) {
    const desde = new Date(Date.now() - meses * 30 * DIA);
    const [orcs, perdidas, ganhas, avaliacoes, usuarios] = await Promise.all([
      this.prisma.orcamento.findMany({ where: { tenantId, status: { in: ['APROVADO', 'CONVERTIDO', 'RECUSADO', 'EXPIRADO'] }, atualizadoEm: { gte: desde } } }),
      this.prisma.oportunidade.findMany({ where: { tenantId, etapa: 'PERDIDO', perdidoEm: { gte: desde } } }),
      this.prisma.oportunidade.findMany({ where: { tenantId, etapa: 'GANHO', ganhoEm: { gte: desde } } }),
      this.prisma.avaliacaoNps.findMany({ where: { tenantId, data: { gte: desde } } }),
      this.prisma.usuario.findMany({ where: { tenantId }, select: { id: true, nome: true } })
    ]);
    const ganho = (s: string) => s === 'APROVADO' || s === 'CONVERTIDO';
    const taxa = (xs: typeof orcs) => (xs.length ? txt(dec(xs.filter((o) => ganho(o.status)).length).div(xs.length)) : '0');
    const agrupar = (chave: (o: (typeof orcs)[number]) => string | null) => {
      const m = new Map<string, typeof orcs>();
      for (const o of orcs) m.set(chave(o) ?? '', [...(m.get(chave(o) ?? '') ?? []), o]);
      return [...m];
    };
    const comPreco = perdidas.filter((p) => p.motivoPerda === 'PRECO' && p.precoAceito && p.valorEstimado.gt(0));
    const ciclos = ganhas.filter((g) => g.ganhoEm).map((g) => (g.ganhoEm!.getTime() - g.criadoEm.getTime()) / DIA);
    const promotores = avaliacoes.filter((a) => a.nota >= 9).length;
    const detratores = avaliacoes.filter((a) => a.nota <= 6).length;
    return {
      meses,
      conversaoPorVendedor: agrupar((o) => o.vendedorId).map(([id, xs]) => ({
        vendedor: usuarios.find((u) => u.id === id) ?? null,
        decididos: xs.length,
        ganhos: xs.filter((o) => ganho(o.status)).length,
        taxa: taxa(xs)
      })),
      conversaoPorSegmento: agrupar((o) => o.segmento).map(([segmento, xs]) => ({ segmento, decididos: xs.length, ganhos: xs.filter((o) => ganho(o.status)).length, taxa: taxa(xs) })),
      motivosPerda: MOTIVOS_PERDA.map((motivo) => {
        const xs = perdidas.filter((p) => p.motivoPerda === motivo);
        return { motivo, quantidade: xs.length, valor: soma(xs.map((p) => dec(tt(p.valorEstimado)))).toFixed(2) };
      }).filter((m) => m.quantidade > 0),
      precoAceitoSobreOfertado: comPreco.length ? txt(soma(comPreco.map((p) => dec(tt(p.precoAceito!)).div(tt(p.valorEstimado)))).div(comPreco.length)) : null,
      cicloMedioDias: ciclos.length ? dec(ciclos.reduce((a, b) => a + b, 0) / ciclos.length).toDecimalPlaces(1).toFixed() : null,
      nps: avaliacoes.length ? dec(promotores - detratores).div(avaliacoes.length).times(100).toDecimalPlaces(1).toFixed() : null,
      npsRespostas: avaliacoes.length
    };
  }

  async ficha(tenantId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, tenantId } });
    if (!cliente) throw naoEncontrado('esse cliente');
    const ano = new Date(Date.now() - 365 * DIA);
    const [orcs, ordens, titulos, oportunidades, atividades, mensagens, avaliacoes] = await Promise.all([
      this.prisma.orcamento.findMany({ where: { tenantId, clienteId }, orderBy: { criadoEm: 'desc' } }),
      this.prisma.ordemServico.findMany({ where: { tenantId, clienteId }, orderBy: { criadoEm: 'desc' } }),
      this.prisma.titulo.findMany({ where: { tenantId, clienteId, tipo: 'RECEBER', status: { in: ['ABERTO', 'PARCIAL'] } }, orderBy: { vencimento: 'asc' } }),
      this.prisma.oportunidade.findMany({ where: { tenantId, clienteId }, orderBy: { atualizadoEm: 'desc' } }),
      this.prisma.atividade.findMany({ where: { tenantId, clienteId }, orderBy: { data: 'desc' }, take: 50 }),
      this.prisma.mensagemCliente.findMany({ where: { tenantId, clienteId }, orderBy: { data: 'desc' }, take: 50 }),
      this.prisma.avaliacaoNps.findMany({ where: { tenantId, clienteId }, orderBy: { data: 'desc' } })
    ]);
    const osIds = ordens.map((o) => o.id);
    const [ncs, garantias] = await Promise.all([
      this.prisma.naoConformidade.findMany({ where: { tenantId, osId: { in: osIds } }, orderBy: { criadoEm: 'desc' } }),
      this.prisma.garantia.findMany({ where: { tenantId, osId: { in: osIds } }, orderBy: { criadoEm: 'desc' } })
    ]);
    const ganhos = orcs.filter((o) => o.status === 'APROVADO' || o.status === 'CONVERTIDO');
    const decididos = orcs.filter((o) => ['APROVADO', 'CONVERTIDO', 'RECUSADO', 'EXPIRADO'].includes(o.status));
    const media = (xs: Prisma.Decimal[]) => (xs.length ? soma(xs.map((x) => dec(tt(x)))).div(xs.length) : null);
    const ultimas = [...atividades.map((a) => a.concluidaEm ?? a.data), ...mensagens.map((m) => m.data), ...orcs.map((o) => o.atualizadoEm)].filter((d) => d <= new Date());
    const hoje = hojeLocal();
    const numeroOs = (id: string | null) => ordens.find((o) => o.id === id)?.numero ?? null;
    const titulo = (t: (typeof titulos)[number]) => ({ id: t.id, numero: t.numero, descricao: t.descricao, vencimento: textoData(t.vencimento), saldo: saldoDo(t).toFixed(2), diasAtraso: diasAtraso(t, hoje) });
    return {
      cliente: { id: cliente.id, tipo: cliente.tipo, documento: cliente.documento, nome: cliente.nome, fantasia: cliente.fantasia, email: cliente.email, telefone: cliente.telefone, cidade: cliente.cidade, uf: cliente.uf, status: cliente.status, condicaoPagamento: cliente.condicaoPagamento, bloqueioAutomatico: cliente.bloqueioAutomatico },
      resumo: {
        orcamentos: orcs.length,
        taxaConversao: decididos.length ? txt(dec(ganhos.length).div(decididos.length)) : null,
        valorAprovado12m: soma(ganhos.filter((o) => (o.aprovadoEm ?? o.atualizadoEm) >= ano).map((o) => dec(tt(o.precoFinalLote)))).toFixed(2),
        margemMedia: media(ganhos.map((o) => o.margemEfetiva)) ? txt(media(ganhos.map((o) => o.margemEfetiva))!) : null,
        ticketMedio: media(ganhos.map((o) => o.precoFinalLote))?.toFixed(2) ?? null,
        ultimaInteracao: ultimas.length ? new Date(Math.max(...ultimas.map((d) => d.getTime()))) : null,
        nps: avaliacoes.length ? { media: dec(avaliacoes.reduce((a, x) => a + x.nota, 0)).div(avaliacoes.length).toDecimalPlaces(1).toFixed(), respostas: avaliacoes.length } : null
      },
      orcamentos: orcs.map((o) => ({ id: o.id, numero: o.numero, titulo: o.titulo, status: o.status, precoFinalLote: tt(o.precoFinalLote), validade: dataIso(o.validade), atualizadoEm: o.atualizadoEm })),
      os: ordens.map((o) => ({ id: o.id, numero: o.numero, titulo: o.titulo, status: o.status, prazo: dataIso(o.prazo), entregueEm: o.entregueEm })),
      titulos: { abertos: titulos.map(titulo), vencidos: titulos.filter((t) => diasAtraso(t, hoje) > 0).map(titulo) },
      veiculos: [
        ...new Map(
          ordens
            .filter((o) => o.segmento === 'OFICINA' && (o.objeto as { placa?: string })?.placa)
            .map((o) => {
              const ob = o.objeto as { placa: string; veiculo?: string };
              return [ob.placa, { placa: ob.placa, veiculo: ob.veiculo ?? null, ultimaOs: o.numero }];
            })
        ).values()
      ],
      ncs: ncs.map((n) => ({ id: n.id, numero: n.numero, origem: n.origem, status: n.status, descricao: n.descricao, os: numeroOs(n.osId) })),
      garantias: garantias.map((g) => ({ id: g.id, numero: g.numero, status: g.status, relato: g.relato, os: numeroOs(g.osId) })),
      atividades: await this.saidaAtividades(tenantId, atividades),
      oportunidades: await this.saida(tenantId, oportunidades),
      mensagens: mensagens.map((m) => ({ id: m.id, canal: m.canal, assunto: m.assunto, corpo: m.corpo, link: m.link, data: m.data })),
      avaliacoes: avaliacoes.map((a) => ({ os: numeroOs(a.osId), nota: a.nota, comentario: a.comentario, data: a.data }))
    };
  }

  private async saida(tenantId: string, ops: Oportunidade[]) {
    const [clientes, usuarios, pendentes] = await Promise.all([
      this.prisma.cliente.findMany({ where: { tenantId, id: { in: ops.map((o) => o.clienteId).filter(Boolean) as string[] } }, select: { id: true, nome: true, fantasia: true } }),
      this.prisma.usuario.findMany({ where: { tenantId, id: { in: ops.map((o) => o.responsavelId).filter(Boolean) as string[] } }, select: { id: true, nome: true } }),
      this.prisma.atividade.findMany({ where: { tenantId, concluida: false, oportunidadeId: { in: ops.map((o) => o.id) } }, orderBy: { data: 'asc' } })
    ]);
    return ops.map((o) => {
      const c = clientes.find((x) => x.id === o.clienteId);
      const prox = pendentes.find((a) => a.oportunidadeId === o.id);
      return {
        id: o.id,
        titulo: o.titulo,
        cliente: c ? { id: c.id, nome: c.fantasia || c.nome } : null,
        contato: o.contato,
        origem: o.origem,
        etapa: o.etapa,
        valorEstimado: dec(tt(o.valorEstimado)).toFixed(2),
        responsavel: usuarios.find((u) => u.id === o.responsavelId) ?? null,
        orcamentoId: o.orcamentoId,
        proximaAtividade: prox ? { id: prox.id, tipo: prox.tipo, assunto: prox.assunto, data: prox.data } : null,
        motivoPerda: o.motivoPerda,
        concorrente: o.concorrente,
        precoAceito: o.precoAceito ? dec(tt(o.precoAceito)).toFixed(2) : null,
        observacao: o.observacao,
        ganhoEm: o.ganhoEm,
        perdidoEm: o.perdidoEm,
        criadoEm: o.criadoEm,
        atualizadoEm: o.atualizadoEm
      };
    });
  }

  private async saidaAtividades(tenantId: string, as: { id: string; tipo: string; assunto: string; data: Date; clienteId: string | null; oportunidadeId: string | null; orcamentoId: string | null; responsavelId: string; observacao: string | null; concluida: boolean; concluidaEm: Date | null; resultado: string | null; chave: string | null }[]) {
    const [clientes, usuarios, orcs] = await Promise.all([
      this.prisma.cliente.findMany({ where: { tenantId, id: { in: as.map((a) => a.clienteId).filter(Boolean) as string[] } }, select: { id: true, nome: true, fantasia: true } }),
      this.prisma.usuario.findMany({ where: { tenantId, id: { in: as.map((a) => a.responsavelId) } }, select: { id: true, nome: true } }),
      this.prisma.orcamento.findMany({ where: { tenantId, id: { in: as.map((a) => a.orcamentoId).filter(Boolean) as string[] } }, select: { id: true, numero: true } })
    ]);
    return as.map((a) => {
      const c = clientes.find((x) => x.id === a.clienteId);
      return {
        id: a.id,
        tipo: a.tipo,
        assunto: a.assunto,
        data: a.data,
        cliente: c ? { id: c.id, nome: c.fantasia || c.nome } : null,
        oportunidadeId: a.oportunidadeId,
        orcamento: orcs.find((o) => o.id === a.orcamentoId) ?? null,
        responsavel: usuarios.find((u) => u.id === a.responsavelId) ?? null,
        observacao: a.observacao,
        concluida: a.concluida,
        concluidaEm: a.concluidaEm,
        resultado: a.resultado,
        automatica: !!a.chave,
        atrasada: !a.concluida && a.data.getTime() < Date.now() - DIA
      };
    });
  }

  private async vinculos(tenantId: string, dto: { clienteId?: string | null; responsavelId?: string | null; orcamentoId?: string | null }) {
    if (dto.clienteId && !(await this.prisma.cliente.findFirst({ where: { id: dto.clienteId, tenantId } }))) throw naoEncontrado('esse cliente');
    if (dto.responsavelId && !(await this.prisma.usuario.findFirst({ where: { id: dto.responsavelId, tenantId } }))) throw naoEncontrado('esse responsável');
    if (dto.orcamentoId && !(await this.prisma.orcamento.findFirst({ where: { id: dto.orcamentoId, tenantId } }))) throw naoEncontrado('esse orçamento');
  }

  private async vinculosAtividade(tenantId: string, dto: { clienteId?: string | null; responsavelId?: string; orcamentoId?: string | null; oportunidadeId?: string | null }) {
    await this.vinculos(tenantId, dto);
    if (dto.oportunidadeId && !(await this.prisma.oportunidade.findFirst({ where: { id: dto.oportunidadeId, tenantId } }))) throw naoEncontrado('essa oportunidade');
  }

  private async atividade(tenantId: string, id: string) {
    const a = await this.prisma.atividade.findFirst({ where: { id, tenantId } });
    if (!a) throw naoEncontrado('essa atividade');
    return a;
  }

  private async buscar(tenantId: string, id: string) {
    const o = await this.prisma.oportunidade.findFirst({ where: { id, tenantId } });
    if (!o) throw naoEncontrado('essa oportunidade');
    return o;
  }
}
