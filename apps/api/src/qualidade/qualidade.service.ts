import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { NaoConformidade, OrigemNc, PlanoInspecao, StatusNc } from '@prisma/client';
import { dataIso, pd, tt } from '../comum/decimal';
import { conflito, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { proximoNumero } from '../orcamentos/numeracao';
import { ParametrosService } from '../parametros/parametros.service';
import { dataBanco, hojeLocal, local, somarDias } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { json } from '../tabelas-custos/entrada';
import { abrirNc, ItemPlano, normalizarItensPlano, ultimasVersoes, ultimaVersao } from './qualidade-core';
import { AtualizarPlanoDto, DecidirGarantiaDto, GarantiaDto, NcDto, ORIGENS_NC, PlanoDto, TratarNcDto } from './qualidade.dto';

const saidaPlano = (p: PlanoInspecao) => ({
  id: p.planoId,
  nome: p.nome,
  segmento: p.segmento,
  versao: p.versao,
  ativo: p.ativo,
  exigeInspecao: p.exigeInspecao,
  itens: p.itens as unknown as ItemPlano[],
  criadoEm: p.criadoEm
});

@Injectable()
export class QualidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService
  ) {}

  async planos(tenantId: string) {
    const vs = await this.prisma.planoInspecao.findMany({ where: { tenantId }, orderBy: [{ nome: 'asc' }, { versao: 'desc' }] });
    const ultimas = ultimasVersoes(vs);
    return { itens: ultimas.map(saidaPlano), total: ultimas.length };
  }

  async plano(tenantId: string, id: string) {
    const p = await ultimaVersao(this.prisma, tenantId, id);
    if (!p) throw naoEncontrado('esse plano de inspeção');
    const versoes = await this.prisma.planoInspecao.findMany({ where: { tenantId, planoId: id }, orderBy: { versao: 'desc' }, select: { versao: true, criadoEm: true } });
    return { ...saidaPlano(p), versoes };
  }

  async criarPlano(tenantId: string, dto: PlanoDto) {
    const planoId = randomUUID();
    await this.prisma.planoInspecao.create({
      data: { tenantId, planoId, versao: 1, nome: dto.nome.trim(), segmento: dto.segmento, ativo: dto.ativo ?? true, exigeInspecao: dto.exigeInspecao ?? true, itens: json(normalizarItensPlano(dto.itens)) }
    });
    return this.plano(tenantId, planoId);
  }

  async atualizarPlano(tenantId: string, id: string, dto: AtualizarPlanoDto) {
    const p = await ultimaVersao(this.prisma, tenantId, id);
    if (!p) throw naoEncontrado('esse plano de inspeção');
    await this.prisma.planoInspecao.create({
      data: {
        tenantId,
        planoId: id,
        versao: p.versao + 1,
        nome: dto.nome?.trim() ?? p.nome,
        segmento: dto.segmento ?? p.segmento,
        ativo: dto.ativo ?? p.ativo,
        exigeInspecao: dto.exigeInspecao ?? p.exigeInspecao,
        itens: json(dto.itens ? normalizarItensPlano(dto.itens) : p.itens)
      }
    });
    return this.plano(tenantId, id);
  }

  async ncs(tenantId: string, f: { status?: string; origem?: string; osId?: string }) {
    const ncs = await this.prisma.naoConformidade.findMany({
      where: {
        tenantId,
        ...(['ABERTA', 'EM_TRATAMENTO', 'ENCERRADA'].includes(f.status ?? '') ? { status: f.status as StatusNc } : {}),
        ...((ORIGENS_NC as readonly string[]).includes(f.origem ?? '') ? { origem: f.origem as OrigemNc } : {}),
        ...(f.osId ? { osId: f.osId } : {})
      },
      orderBy: { criadoEm: 'desc' }
    });
    const itens = await this.saidaNcs(tenantId, ncs);
    return { itens, total: itens.length, alertas: await this.recorrencias(tenantId) };
  }

  async criarNc(tenantId: string, dto: NcDto) {
    await this.conferirVinculos(tenantId, dto);
    const nc = await this.prisma.$transaction((tx) => abrirNc(tx, tenantId, { ...dto, descricao: dto.descricao.trim() }));
    return this.nc(tenantId, nc.id);
  }

  async nc(tenantId: string, id: string) {
    return (await this.saidaNcs(tenantId, [await this.buscarNc(tenantId, id)]))[0];
  }

  async tratarNc(tenantId: string, id: string, dto: TratarNcDto) {
    const nc = await this.buscarNc(tenantId, id);
    if (nc.status === 'ENCERRADA') throw conflito('NC_ENCERRADA', `${nc.numero} já foi encerrada. Abra uma nova NC se o problema voltou.`);
    if (dto.responsavelId && !(await this.prisma.usuario.findFirst({ where: { id: dto.responsavelId, tenantId } }))) throw naoEncontrado('esse responsável');
    const acao = dto.acaoCorretiva?.trim() ?? nc.acaoCorretiva;
    await this.prisma.naoConformidade.update({
      where: { id },
      data: {
        causa: dto.causa?.trim(),
        acaoCorretiva: dto.acaoCorretiva?.trim(),
        responsavelId: dto.responsavelId,
        prazo: dto.prazo ? dataBanco(dto.prazo) : undefined,
        status: acao ? 'EM_TRATAMENTO' : 'ABERTA'
      }
    });
    return this.nc(tenantId, id);
  }

  async encerrarNc(tenantId: string, id: string, eficaz: boolean) {
    const nc = await this.buscarNc(tenantId, id);
    if (nc.status === 'ENCERRADA') throw conflito('NC_ENCERRADA', `${nc.numero} já está encerrada.`);
    if (!nc.acaoCorretiva) throw regra('SEM_ACAO', `Registre a causa e a ação corretiva de ${nc.numero} antes de encerrar.`);
    await this.prisma.naoConformidade.update({ where: { id }, data: { status: 'ENCERRADA', eficaz, encerradaEm: new Date() } });
    return this.nc(tenantId, id);
  }

  async rastreabilidade(tenantId: string, f: { loteId?: string; osId?: string }) {
    if (f.loteId) {
      const lote = await this.prisma.lote.findFirst({ where: { id: f.loteId, tenantId }, include: { item: true } });
      if (!lote) throw naoEncontrado('esse lote');
      const [fornecedor, recebimento, consumos] = await Promise.all([
        lote.fornecedorId ? this.prisma.fornecedor.findUnique({ where: { id: lote.fornecedorId }, select: { id: true, nome: true } }) : null,
        lote.recebimentoId ? this.prisma.recebimento.findUnique({ where: { id: lote.recebimentoId }, include: { pedido: { select: { id: true, numero: true } } } }) : null,
        this.prisma.movimento.findMany({ where: { tenantId, loteId: lote.id, tipo: 'SAIDA_OS', estornado: false } })
      ]);
      const ordens = await this.prisma.ordemServico.findMany({
        where: { tenantId, id: { in: consumos.map((c) => c.osId!).filter(Boolean) } },
        include: { cliente: { select: { id: true, nome: true } } }
      });
      return {
        lote: { id: lote.id, codigo: lote.codigo, data: lote.data, quantidadeInicial: tt(lote.quantidadeInicial), saldo: tt(lote.saldo) },
        item: { id: lote.item.id, codigo: lote.item.codigo, descricao: lote.item.descricao, unidade: lote.item.unidadeConsumo },
        certificado: lote.certificado ?? null,
        fornecedor,
        recebimento: recebimento ? { id: recebimento.id, data: recebimento.data, notaFiscal: recebimento.notaFiscal, pedido: recebimento.pedido } : null,
        ordens: ordens.map((o) => ({
          id: o.id,
          numero: o.numero,
          titulo: o.titulo,
          status: o.status,
          cliente: o.cliente,
          entregueEm: o.entregueEm,
          recebidoPor: o.recebidoPor,
          quantidade: tt(consumos.filter((c) => c.osId === o.id).reduce((a, c) => a.plus(c.quantidade.neg()), pd(0)))
        }))
      };
    }
    if (f.osId) {
      const os = await this.prisma.ordemServico.findFirst({ where: { id: f.osId, tenantId }, select: { id: true, numero: true, titulo: true } });
      if (!os) throw naoEncontrado('essa ordem de serviço');
      return { os, lotes: await this.lotesDaOs(tenantId, os.id) };
    }
    throw regra('FILTRO_OBRIGATORIO', 'Informe loteId para seguir o material até as OS, ou osId para ver os lotes usados na OS.');
  }

  async garantias(tenantId: string, status?: string) {
    const gs = await this.prisma.garantia.findMany({
      where: { tenantId, ...(['EM_ANALISE', 'PROCEDENTE', 'IMPROCEDENTE'].includes(status ?? '') ? { status: status as 'EM_ANALISE' } : {}) },
      orderBy: { criadoEm: 'desc' }
    });
    const ordens = await this.prisma.ordemServico.findMany({
      where: { tenantId, id: { in: gs.flatMap((g) => [g.osId, g.osGarantiaId].filter(Boolean) as string[]) } },
      include: { cliente: { select: { id: true, nome: true } } }
    });
    const os = (id: string | null) => ordens.find((o) => o.id === id);
    const itens = gs.map((g) => ({
      id: g.id,
      numero: g.numero,
      os: { id: g.osId, numero: os(g.osId)?.numero, titulo: os(g.osId)?.titulo, cliente: os(g.osId)?.cliente, entregueEm: os(g.osId)?.entregueEm },
      relato: g.relato,
      status: g.status,
      analise: g.analise,
      osGarantia: g.osGarantiaId ? { id: g.osGarantiaId, numero: os(g.osGarantiaId)?.numero } : null,
      criadoEm: g.criadoEm,
      decididaEm: g.decididaEm
    }));
    return { itens, total: itens.length };
  }

  async abrirGarantia(tenantId: string, dto: GarantiaDto) {
    const os = await this.prisma.ordemServico.findFirst({ where: { id: dto.osId, tenantId } });
    if (!os) throw naoEncontrado('essa ordem de serviço');
    const { garantiaDias } = await this.parametros.carregar(tenantId);
    const entregue = os.status === 'ENTREGUE' && os.entregueEm ? local(os.entregueEm).data : null;
    const limite = entregue ? somarDias(entregue, garantiaDias) : null;
    if (!entregue || hojeLocal() > limite!) {
      throw regra(
        'FORA_DA_GARANTIA',
        entregue
          ? `${os.numero} foi entregue em ${entregue.split('-').reverse().join('/')} e a garantia de ${garantiaDias} dias venceu em ${limite!.split('-').reverse().join('/')}. Trate como um novo orçamento.`
          : `${os.numero} ainda não foi entregue; garantia só vale para serviço entregue.`,
        { entregueEm: entregue, validaAte: limite }
      );
    }
    const g = await this.prisma.$transaction(async (tx) =>
      tx.garantia.create({ data: { tenantId, numero: await proximoNumero(tx, tenantId, 'GAR'), osId: os.id, relato: dto.relato.trim() } })
    );
    return (await this.garantias(tenantId)).itens.find((x) => x.id === g.id);
  }

  async decidirGarantia(s: Sessao, id: string, dto: DecidirGarantiaDto) {
    const g = await this.prisma.garantia.findFirst({ where: { id, tenantId: s.tenantId } });
    if (!g) throw naoEncontrado('essa garantia');
    if (g.status !== 'EM_ANALISE') throw conflito('GARANTIA_DECIDIDA', `${g.numero} já foi decidida como ${g.status === 'PROCEDENTE' ? 'procedente' : 'improcedente'}.`);
    await this.prisma.$transaction(async (tx) => {
      let osGarantiaId: string | null = null;
      if (dto.procedente) {
        const original = await tx.ordemServico.findUniqueOrThrow({ where: { id: g.osId }, include: { operacoes: { orderBy: { sequencia: 'asc' } } } });
        const nova = await tx.ordemServico.create({
          data: {
            tenantId: s.tenantId,
            numero: await proximoNumero(tx, s.tenantId, 'OS'),
            clienteId: original.clienteId,
            tabelaCustosId: original.tabelaCustosId,
            titulo: `Garantia — ${original.titulo}`,
            segmento: original.segmento,
            lote: original.lote,
            prazo: dataBanco(somarDias(hojeLocal(), 7)),
            prioridade: 'ALTA',
            objeto: original.objeto ?? json({}),
            observacoes: `Garantia ${g.numero}: ${dto.analise.trim()}`,
            status: 'EM_FILA',
            precoFinalLote: pd(0),
            impostos: original.impostos,
            comissao: original.comissao,
            margemMinima: original.margemMinima,
            planoInspecaoId: original.planoInspecaoId,
            planoVersao: original.planoVersao,
            garantiaDeId: original.id,
            operacoes: {
              create: original.operacoes
                .filter((o) => !o.retrabalho)
                .map((o) => ({
                  tenantId: s.tenantId,
                  sequencia: o.sequencia,
                  descricao: o.descricao,
                  centroId: o.centroId,
                  colaboradorId: o.colaboradorId,
                  custoHora: o.custoHora,
                  setupOrcadoHoras: o.setupOrcadoHoras,
                  cicloOrcadoHorasPorPeca: o.cicloOrcadoHorasPorPeca,
                  retrabalho: true,
                  orcada: false,
                  justificativa: `Garantia ${g.numero}`
                }))
            }
          }
        });
        await tx.osHistorico.create({ data: { tenantId: s.tenantId, osId: nova.id, status: 'EM_FILA', evento: 'criada', usuarioId: s.id, detalhe: `Garantia ${g.numero} de ${original.numero}` } });
        osGarantiaId = nova.id;
      }
      await tx.garantia.update({ where: { id }, data: { status: dto.procedente ? 'PROCEDENTE' : 'IMPROCEDENTE', analise: dto.analise.trim(), osGarantiaId, decididaEm: new Date() } });
    });
    return (await this.garantias(s.tenantId)).itens.find((x) => x.id === id);
  }

  async laudo(tenantId: string, osId: string) {
    const os = await this.prisma.ordemServico.findFirst({
      where: { id: osId, tenantId },
      include: { cliente: true, empresa: { select: { nome: true } }, inspecoes: { orderBy: { data: 'asc' } } }
    });
    if (!os) throw naoEncontrado('essa ordem de serviço');
    const [{ garantiaDias }, lotes, plano] = await Promise.all([
      this.parametros.carregar(tenantId),
      this.lotesDaOs(tenantId, os.id),
      os.planoInspecaoId ? this.prisma.planoInspecao.findFirst({ where: { tenantId, planoId: os.planoInspecaoId, versao: os.planoVersao ?? undefined } }) : null
    ]);
    const entregue = os.entregueEm ? local(os.entregueEm).data : null;
    return {
      empresa: os.empresa,
      os: {
        id: os.id,
        numero: os.numero,
        titulo: os.titulo,
        segmento: os.segmento,
        lote: os.lote,
        objeto: os.objeto,
        status: os.status,
        entregueEm: os.entregueEm,
        recebidoPor: os.recebidoPor,
        documentoEntrega: os.documentoEntrega
      },
      cliente: { id: os.cliente.id, nome: os.cliente.nome, documento: os.cliente.documento, cidade: os.cliente.cidade, uf: os.cliente.uf },
      plano: plano ? { id: plano.planoId, nome: plano.nome, versao: plano.versao } : null,
      inspecoes: os.inspecoes.map((i) => ({ id: i.id, aprovada: i.aprovada, itens: i.itens, observacao: i.observacao, data: i.data })),
      lotes,
      garantia: {
        dias: garantiaDias,
        validaAte: entregue ? somarDias(entregue, garantiaDias) : null,
        termo: `${os.empresa.nome} garante o serviço da ${os.numero} por ${garantiaDias} dias a partir da entrega contra defeitos de execução e de material, mediante apresentação deste laudo. A garantia não cobre uso fora da especificação, acidentes ou alterações feitas por terceiros.`
      },
      geradoEm: new Date()
    };
  }

  private async lotesDaOs(tenantId: string, osId: string) {
    const ms = await this.prisma.movimento.findMany({ where: { tenantId, osId, tipo: 'SAIDA_OS', estornado: false, loteId: { not: null } } });
    const lotes = await this.prisma.lote.findMany({ where: { tenantId, id: { in: ms.map((m) => m.loteId!) } }, include: { item: true } });
    const fornecedores = await this.prisma.fornecedor.findMany({ where: { tenantId, id: { in: lotes.map((l) => l.fornecedorId).filter(Boolean) as string[] } }, select: { id: true, nome: true } });
    return lotes.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      item: { id: l.item.id, codigo: l.item.codigo, descricao: l.item.descricao, unidade: l.item.unidadeConsumo },
      quantidade: tt(ms.filter((m) => m.loteId === l.id).reduce((a, m) => a.plus(m.quantidade.neg()), pd(0))),
      certificado: l.certificado ?? null,
      fornecedor: fornecedores.find((f) => f.id === l.fornecedorId) ?? null
    }));
  }

  private async recorrencias(tenantId: string) {
    const desde = new Date(Date.now() - 90 * 86_400_000);
    const recentes = await this.prisma.naoConformidade.findMany({ where: { tenantId, criadoEm: { gte: desde } } });
    const alertas: { tipo: 'atencao'; dimensao: 'centro' | 'operador' | 'fornecedor'; id: string; quantidade: number; mensagem: string }[] = [];
    const dims = [
      ['centro', 'centroId'],
      ['operador', 'colaboradorId'],
      ['fornecedor', 'fornecedorId']
    ] as const;
    for (const [dimensao, campo] of dims) {
      const cont = new Map<string, number>();
      for (const n of recentes) if (n[campo]) cont.set(n[campo]!, (cont.get(n[campo]!) ?? 0) + 1);
      for (const [id, quantidade] of cont) {
        if (quantidade < 3) continue;
        const nome =
          dimensao === 'centro'
            ? (await this.prisma.centroTrabalho.findUnique({ where: { id } }))?.nome
            : dimensao === 'operador'
              ? (await this.prisma.colaborador.findUnique({ where: { id } }))?.nome
              : (await this.prisma.fornecedor.findUnique({ where: { id } }))?.nome;
        alertas.push({ tipo: 'atencao', dimensao, id, quantidade, mensagem: `${nome ?? 'Um cadastro'} acumula ${quantidade} não-conformidades em 90 dias. Vale uma análise de causa comum.` });
      }
    }
    return alertas;
  }

  private async saidaNcs(tenantId: string, ncs: NaoConformidade[]) {
    const ids = (k: 'osId' | 'centroId' | 'loteId' | 'fornecedorId' | 'colaboradorId' | 'responsavelId') => ncs.map((n) => n[k]).filter(Boolean) as string[];
    const [ordens, centros, lotes, fornecedores, colaboradores, usuarios] = await Promise.all([
      this.prisma.ordemServico.findMany({ where: { tenantId, id: { in: ids('osId') } }, select: { id: true, numero: true } }),
      this.prisma.centroTrabalho.findMany({ where: { tenantId, id: { in: ids('centroId') } }, select: { id: true, nome: true } }),
      this.prisma.lote.findMany({ where: { tenantId, id: { in: ids('loteId') } }, select: { id: true, codigo: true } }),
      this.prisma.fornecedor.findMany({ where: { tenantId, id: { in: ids('fornecedorId') } }, select: { id: true, nome: true } }),
      this.prisma.colaborador.findMany({ where: { tenantId, id: { in: ids('colaboradorId') } }, select: { id: true, nome: true } }),
      this.prisma.usuario.findMany({ where: { tenantId, id: { in: ids('responsavelId') } }, select: { id: true, nome: true } })
    ]);
    const de = <T extends { id: string }>(xs: T[], id: string | null) => (id ? (xs.find((x) => x.id === id) ?? null) : null);
    return ncs.map((n) => ({
      id: n.id,
      numero: n.numero,
      origem: n.origem,
      descricao: n.descricao,
      status: n.status,
      os: de(ordens, n.osId),
      centro: de(centros, n.centroId),
      lote: de(lotes, n.loteId),
      fornecedor: de(fornecedores, n.fornecedorId),
      colaborador: de(colaboradores, n.colaboradorId),
      causa: n.causa,
      acaoCorretiva: n.acaoCorretiva,
      responsavel: de(usuarios, n.responsavelId),
      prazo: n.prazo ? dataIso(n.prazo) : null,
      eficaz: n.eficaz,
      encerradaEm: n.encerradaEm,
      criadoEm: n.criadoEm
    }));
  }

  private async conferirVinculos(tenantId: string, dto: NcDto) {
    const checar = async (id: string | undefined, achar: () => Promise<unknown>, oQue: string) => {
      if (id && !(await achar())) throw naoEncontrado(oQue);
    };
    await checar(dto.osId, () => this.prisma.ordemServico.findFirst({ where: { id: dto.osId, tenantId } }), 'essa ordem de serviço');
    await checar(dto.centroId, () => this.prisma.centroTrabalho.findFirst({ where: { id: dto.centroId, tenantId } }), 'esse centro de trabalho');
    await checar(dto.loteId, () => this.prisma.lote.findFirst({ where: { id: dto.loteId, tenantId } }), 'esse lote');
    await checar(dto.fornecedorId, () => this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, tenantId } }), 'esse fornecedor');
    await checar(dto.colaboradorId, () => this.prisma.colaborador.findFirst({ where: { id: dto.colaboradorId, tenantId } }), 'esse colaborador');
  }

  private async buscarNc(tenantId: string, id: string) {
    const nc = await this.prisma.naoConformidade.findFirst({ where: { id, tenantId } });
    if (!nc) throw naoEncontrado('essa não-conformidade');
    return nc;
  }
}

