import { Injectable } from '@nestjs/common';
import { CentroCusto, Prisma, StatusTitulo, Titulo, TipoTitulo } from '@prisma/client';
import {
  calcularDRE,
  dec,
  desvioCustoFixo,
  gerarParcelas,
  projetarCaixa,
  soma,
  type Dec,
  type LancamentoCaixa
} from '@promec/motor';
import { pd, RE_COMPETENCIA, tt } from '../comum/decimal';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { custoRealDa, incluirOs } from '../ordens/custo';
import { ParametrosService } from '../parametros/parametros.service';
import { dataBanco, hojeLocal, local, segundaDa, somarDias, textoData } from '../planejamento/calendario';
import { PrismaService } from '../prisma/prisma.service';
import { buscarVigente, json } from '../tabelas-custos/entrada';
import {
  ABERTOS,
  centroPorPapel,
  criarTitulos,
  devidoEm,
  diasAtraso,
  gerarRecorrencias,
  historico,
  prazosDe,
  reaisTxt,
  registrarBaixa,
  rotinaDiaria,
  saldoDo,
  vencimentoNaCompetencia
} from './financeiro-core';
import {
  AtualizarCentroCustoDto,
  AtualizarContaDto,
  AtualizarRecorrenciaDto,
  AtualizarTituloDto,
  BaixaDto,
  BaixaLoteDto,
  CentroCustoDto,
  ContaDto,
  RecorrenciaDto,
  RenegociarDto,
  TituloDto,
  TransferenciaDto
} from './financeiro.dto';

type CustoDireto = { centroTrabalhoId: string; componente: 'manutencao' | 'insumos' | 'energia' | 'outros' };
const STATUS: StatusTitulo[] = ['ABERTO', 'PARCIAL', 'PAGO', 'CANCELADO', 'RENEGOCIADO'];
const COMPONENTES = ['manutencao', 'insumos', 'energia', 'outros'] as const;
const competenciaDe = (data: string) => data.slice(0, 7);
const competenciaAnterior = (c: string) => {
  const [a, m] = c.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};
const proximaCompetencia = (c: string) => {
  const [a, m] = c.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};
const inicioDaCompetencia = (c: string) => new Date(`${c}-01T00:00:00-03:00`);
const dataInformada = (s: string) => s.slice(0, 10);

@Injectable()
export class FinanceiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService
  ) {}

  // Contas e transferências

  async contas(tenantId: string) {
    const [contas, baixas, transf] = await Promise.all([
      this.prisma.contaFinanceira.findMany({ where: { tenantId }, orderBy: { criadoEm: 'asc' } }),
      this.prisma.baixa.findMany({ where: { tenantId, estornada: false }, include: { titulo: { select: { tipo: true } } } }),
      this.prisma.transferencia.findMany({ where: { tenantId } })
    ]);
    return contas.map((c) => {
      const desde = c.dataSaldoInicial;
      const movimento = soma([
        ...baixas.filter((b) => b.contaId === c.id && b.data >= desde).map((b) => (b.titulo.tipo === 'RECEBER' ? dec(tt(b.valor)) : dec(tt(b.valor)).neg())),
        ...transf.filter((t) => t.data >= desde && t.destinoId === c.id).map((t) => dec(tt(t.valor))),
        ...transf.filter((t) => t.data >= desde && t.origemId === c.id).map((t) => dec(tt(t.valor)).neg())
      ]);
      return {
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        banco: c.banco,
        agencia: c.agencia,
        numero: c.numero,
        saldoInicial: reaisTxt(c.saldoInicial),
        dataSaldoInicial: textoData(c.dataSaldoInicial),
        saldoAtual: dec(tt(c.saldoInicial)).plus(movimento).toFixed(2),
        ativa: c.ativa
      };
    });
  }

  async criarConta(tenantId: string, dto: ContaDto) {
    const c = await this.prisma.contaFinanceira.create({
      data: {
        tenantId,
        nome: dto.nome.trim(),
        tipo: dto.tipo,
        banco: dto.banco,
        agencia: dto.agencia,
        numero: dto.numero,
        saldoInicial: pd(dto.saldoInicial ?? 0),
        dataSaldoInicial: dataBanco(dto.dataSaldoInicial ?? hojeLocal()),
        ativa: dto.ativa
      }
    });
    return (await this.contas(tenantId)).find((x) => x.id === c.id);
  }

  async atualizarConta(tenantId: string, id: string, dto: AtualizarContaDto) {
    await this.conta(tenantId, id);
    await this.prisma.contaFinanceira.update({
      where: { id },
      data: {
        nome: dto.nome?.trim(),
        tipo: dto.tipo,
        banco: dto.banco,
        agencia: dto.agencia,
        numero: dto.numero,
        saldoInicial: dto.saldoInicial !== undefined ? pd(dto.saldoInicial) : undefined,
        dataSaldoInicial: dto.dataSaldoInicial ? dataBanco(dto.dataSaldoInicial) : undefined,
        ativa: dto.ativa
      }
    });
    return (await this.contas(tenantId)).find((x) => x.id === id);
  }

  async transferir(s: Sessao, dto: TransferenciaDto) {
    if (dto.origemId === dto.destinoId) throw invalido('Escolha contas diferentes para a transferência.');
    await Promise.all([this.conta(s.tenantId, dto.origemId), this.conta(s.tenantId, dto.destinoId)]);
    if (dec(dto.valor).lte(0)) throw invalido('O valor da transferência precisa ser maior que zero.');
    const t = await this.prisma.transferencia.create({
      data: { tenantId: s.tenantId, origemId: dto.origemId, destinoId: dto.destinoId, valor: pd(dec(dto.valor).toFixed(2)), data: dataBanco(dto.data), observacao: dto.observacao ?? '', usuarioId: s.id }
    });
    return { id: t.id, origemId: t.origemId, destinoId: t.destinoId, valor: reaisTxt(t.valor), data: textoData(t.data), observacao: t.observacao, contas: await this.contas(s.tenantId) };
  }

  // Centros de custo

  async centrosCusto(tenantId: string) {
    const cs = await this.prisma.centroCusto.findMany({ where: { tenantId }, orderBy: [{ tipo: 'asc' }, { nome: 'asc' }] });
    return cs.map(saidaCentro);
  }

  async criarCentroCusto(tenantId: string, dto: CentroCustoDto) {
    await this.conferirCustoDireto(tenantId, dto.custoDiretoCentro);
    const c = await this.prisma.centroCusto.create({
      data: {
        tenantId,
        nome: dto.nome.trim(),
        tipo: dto.tipo,
        compoeCustoFixo: dto.compoeCustoFixo ?? dto.tipo === 'FIXO',
        categoriaCustoFixo: dto.categoriaCustoFixo ?? null,
        custoDiretoCentro: dto.custoDiretoCentro ? json(dto.custoDiretoCentro) : Prisma.DbNull,
        ativo: dto.ativo
      }
    });
    return saidaCentro(c);
  }

  async atualizarCentroCusto(tenantId: string, id: string, dto: AtualizarCentroCustoDto) {
    const c = await this.prisma.centroCusto.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('esse centro de custo');
    if (dto.custoDiretoCentro) await this.conferirCustoDireto(tenantId, dto.custoDiretoCentro);
    const novo = await this.prisma.centroCusto.update({
      where: { id },
      data: {
        nome: dto.nome?.trim(),
        tipo: dto.tipo,
        compoeCustoFixo: dto.compoeCustoFixo,
        categoriaCustoFixo: dto.categoriaCustoFixo,
        custoDiretoCentro: dto.custoDiretoCentro === undefined ? undefined : dto.custoDiretoCentro === null ? Prisma.DbNull : json(dto.custoDiretoCentro),
        ativo: dto.ativo
      }
    });
    return saidaCentro(novo);
  }

  // Títulos

  async titulos(tenantId: string, f: { tipo?: string; status?: string; vencimentoDe?: string; vencimentoAte?: string; competencia?: string; pessoaId?: string; q?: string }) {
    const hoje = hojeLocal();
    const termo = f.q?.trim();
    const ts = await this.prisma.titulo.findMany({
      where: {
        tenantId,
        ...(f.tipo === 'RECEBER' || f.tipo === 'PAGAR' ? { tipo: f.tipo as TipoTitulo } : {}),
        ...(STATUS.includes(f.status as StatusTitulo) ? { status: f.status as StatusTitulo } : {}),
        ...(f.status === 'VENCIDO' ? { status: { in: [...ABERTOS] }, vencimento: { lt: dataBanco(hoje) } } : {}),
        ...(f.vencimentoDe || f.vencimentoAte
          ? { vencimento: { ...(f.vencimentoDe ? { gte: dataBanco(f.vencimentoDe) } : {}), ...(f.vencimentoAte ? { lte: dataBanco(f.vencimentoAte) } : {}) } }
          : {}),
        ...(f.competencia ? { competencia: f.competencia } : {}),
        ...(f.pessoaId ? { OR: [{ clienteId: f.pessoaId }, { fornecedorId: f.pessoaId }, { usuarioId: f.pessoaId }] } : {}),
        ...(termo
          ? {
              AND: [
                {
                  OR: [
                    { numero: { contains: termo, mode: 'insensitive' } },
                    { descricao: { contains: termo, mode: 'insensitive' } },
                    { pessoaNome: { contains: termo, mode: 'insensitive' } },
                    { documentoFiscal: { contains: termo, mode: 'insensitive' } }
                  ]
                }
              ]
            }
          : {})
      },
      include: { baixas: { where: { estornada: false } } },
      orderBy: [{ vencimento: 'asc' }, { numero: 'asc' }]
    });
    const centros = await this.prisma.centroCusto.findMany({ where: { tenantId } });
    const itens = ts.map((t) => saidaTitulo(t, centros, hoje));
    const de = f.vencimentoDe ?? `${hoje.slice(0, 7)}-01`;
    const ate = f.vencimentoAte ?? vencimentoNaCompetencia(hoje.slice(0, 7), 31);
    return {
      itens,
      total: itens.length,
      totais: {
        aberto: soma(itens.filter((t) => (ABERTOS as readonly string[]).includes(t.status)).map((t) => dec(t.saldo))).toFixed(2),
        vencido: soma(itens.filter((t) => t.vencido).map((t) => dec(t.saldo))).toFixed(2),
        pagoNoPeriodo: soma(ts.flatMap((t) => t.baixas.filter((b) => textoData(b.data) >= de && textoData(b.data) <= ate).map((b) => dec(tt(b.valor))))).toFixed(2)
      }
    };
  }

  async criarTitulo(s: Sessao, dto: TituloDto) {
    const centro = await this.prisma.centroCusto.findFirst({ where: { id: dto.centroCustoId, tenantId: s.tenantId } });
    if (!centro) throw naoEncontrado('esse centro de custo');
    const pessoa = await this.pessoa(s.tenantId, dto.pessoa);
    const base = dataInformada(dto.dataBase ?? dto.vencimento ?? hojeLocal());
    const parcelas = gerarParcelas({ valor: String(dto.valor), dataBase: base, prazos: dto.condicao ? prazosDe(dto.condicao) : [0] });
    const criados = await this.prisma.$transaction((tx) =>
      criarTitulos(
        tx,
        s.tenantId,
        {
          tipo: dto.tipo,
          ...pessoa,
          descricao: dto.descricao.trim(),
          centroCustoId: centro.id,
          competencia: dto.competencia ?? competenciaDe(base),
          documentoFiscal: dto.documentoFiscal,
          observacao: dto.observacao
        },
        parcelas,
        s.id
      )
    );
    const centros = await this.prisma.centroCusto.findMany({ where: { tenantId: s.tenantId } });
    const itens = criados.map((t) => saidaTitulo({ ...t, baixas: [] }, centros));
    return { itens, total: itens.length };
  }

  async titulo(tenantId: string, id: string) {
    const t = await this.buscarTitulo(tenantId, id);
    const [centros, contas, hist, filhos, p] = await Promise.all([
      this.prisma.centroCusto.findMany({ where: { tenantId } }),
      this.prisma.contaFinanceira.findMany({ where: { tenantId }, select: { id: true, nome: true } }),
      this.prisma.tituloHistorico.findMany({ where: { tituloId: id }, orderBy: { data: 'asc' } }),
      this.prisma.titulo.findMany({ where: { tenantId, renegociadoDeId: id }, include: { baixas: { where: { estornada: false } } }, orderBy: { vencimento: 'asc' } }),
      this.parametros.carregar(tenantId)
    ]);
    const usuarios = await this.prisma.usuario.findMany({ where: { tenantId, id: { in: hist.map((h) => h.usuarioId).filter(Boolean) as string[] } }, select: { id: true, nome: true } });
    const aberto = (ABERTOS as readonly string[]).includes(t.status);
    return {
      ...saidaTitulo({ ...t, baixas: t.baixas.filter((b) => !b.estornada) }, centros),
      observacao: t.observacao,
      motivoCancelamento: t.motivoCancelamento,
      renegociadoDeId: t.renegociadoDeId,
      renegociacao: filhos.map((f) => saidaTitulo(f, centros)),
      encargosHoje: aberto ? devidoEm(t, hojeLocal(), p) : null,
      baixas: t.baixas.map((b) => ({
        id: b.id,
        data: textoData(b.data),
        valor: reaisTxt(b.valor),
        principal: reaisTxt(b.principal),
        multa: reaisTxt(b.multa),
        juros: reaisTxt(b.juros),
        desconto: reaisTxt(b.desconto),
        conta: contas.find((c) => c.id === b.contaId) ?? null,
        observacao: b.observacao,
        estornada: b.estornada,
        estornadaEm: b.estornadaEm,
        motivoEstorno: b.motivoEstorno
      })),
      historico: hist.map((h) => ({ evento: h.evento, detalhe: h.detalhe, usuario: usuarios.find((u) => u.id === h.usuarioId) ?? null, data: h.data }))
    };
  }

  async atualizarTitulo(s: Sessao, id: string, dto: AtualizarTituloDto) {
    const t = await this.tituloAberto(s.tenantId, id, 'editar');
    if (dto.centroCustoId && !(await this.prisma.centroCusto.findFirst({ where: { id: dto.centroCustoId, tenantId: s.tenantId } }))) throw naoEncontrado('esse centro de custo');
    await this.prisma.$transaction(async (tx) => {
      await tx.titulo.update({
        where: { id },
        data: {
          vencimento: dto.vencimento ? dataBanco(dto.vencimento) : undefined,
          competencia: dto.competencia,
          centroCustoId: dto.centroCustoId,
          documentoFiscal: dto.documentoFiscal,
          observacao: dto.observacao
        }
      });
      const mudou = [
        dto.vencimento && dataInformada(dto.vencimento) !== textoData(t.vencimento) ? `vencimento ${textoData(t.vencimento)} → ${dataInformada(dto.vencimento)}` : '',
        dto.competencia && dto.competencia !== t.competencia ? `competência ${t.competencia} → ${dto.competencia}` : '',
        dto.centroCustoId && dto.centroCustoId !== t.centroCustoId ? 'centro de custo' : ''
      ].filter(Boolean);
      await historico(tx, s.tenantId, id, 'editado', mudou.join('; ') || undefined, s.id);
    });
    return this.titulo(s.tenantId, id);
  }

  async baixar(s: Sessao, id: string, dto: BaixaDto) {
    const t = await this.buscarTitulo(s.tenantId, id);
    await this.conta(s.tenantId, dto.contaId);
    const p = await this.parametros.carregar(s.tenantId);
    await this.prisma.$transaction((tx) =>
      registrarBaixa(
        tx,
        s.tenantId,
        t,
        {
          data: dataInformada(dto.data),
          valor: String(dto.valor),
          contaId: dto.contaId,
          multa: dto.multa !== undefined ? String(dto.multa) : undefined,
          juros: dto.juros !== undefined ? String(dto.juros) : undefined,
          desconto: dto.desconto !== undefined ? String(dto.desconto) : undefined,
          observacao: dto.observacao,
          usuarioId: s.id
        },
        p
      )
    );
    return this.titulo(s.tenantId, id);
  }

  async baixarLote(s: Sessao, dto: BaixaLoteDto) {
    await this.conta(s.tenantId, dto.contaId);
    const p = await this.parametros.carregar(s.tenantId);
    const ts = await this.prisma.titulo.findMany({ where: { tenantId: s.tenantId, id: { in: dto.tituloIds } } });
    if (ts.length !== new Set(dto.tituloIds).size) throw naoEncontrado('um dos títulos');
    await this.prisma.$transaction(async (tx) => {
      for (const t of ts) await registrarBaixa(tx, s.tenantId, t, { data: dataInformada(dto.data), contaId: dto.contaId, usuarioId: s.id, observacao: 'Baixa em lote' }, p);
    });
    const centros = await this.prisma.centroCusto.findMany({ where: { tenantId: s.tenantId } });
    const atualizados = await this.prisma.titulo.findMany({ where: { id: { in: dto.tituloIds } }, include: { baixas: { where: { estornada: false } } }, orderBy: { vencimento: 'asc' } });
    const itens = atualizados.map((t) => saidaTitulo(t, centros));
    return { itens, total: itens.length, valor: soma(atualizados.flatMap((t) => t.baixas.filter((b) => textoData(b.data) === dataInformada(dto.data)).map((b) => dec(tt(b.valor))))).toFixed(2) };
  }

  async estornar(s: Sessao, id: string, baixaId: string, motivo: string) {
    const t = await this.buscarTitulo(s.tenantId, id);
    const b = t.baixas.find((x) => x.id === baixaId);
    if (!b) throw naoEncontrado('essa baixa neste título');
    if (b.estornada) throw conflito('BAIXA_ESTORNADA', 'Essa baixa já foi estornada.');
    if (t.status === 'RENEGOCIADO' || t.status === 'CANCELADO') throw conflito('TITULO_FECHADO', `${t.numero} está ${t.status.toLowerCase()}; o estorno não se aplica.`);
    await this.prisma.$transaction(async (tx) => {
      await tx.baixa.update({ where: { id: b.id }, data: { estornada: true, estornadaEm: new Date(), motivoEstorno: motivo.trim() } });
      const pago = dec(tt(t.valorPago)).minus(tt(b.principal));
      await tx.titulo.update({ where: { id }, data: { valorPago: pd(pago.toFixed(2)), status: pago.lte(0) ? 'ABERTO' : 'PARCIAL' } });
      const comissoes = await tx.comissao.updateMany({ where: { tenantId: s.tenantId, baixaId: b.id, estornada: false }, data: { estornada: true } });
      await historico(tx, s.tenantId, id, 'estorno', `Baixa de R$ ${reaisTxt(b.valor)} em ${textoData(b.data)} estornada: ${motivo.trim()}${comissoes.count ? ' (comissão estornada)' : ''}`, s.id);
    });
    return this.titulo(s.tenantId, id);
  }

  async renegociar(s: Sessao, id: string, dto: RenegociarDto) {
    const t = await this.tituloAberto(s.tenantId, id, 'renegociar');
    const valor = dto.valor !== undefined ? dec(dto.valor).toFixed(2) : saldoDo(t).toFixed(2);
    const parcelas = gerarParcelas({ valor, dataBase: dataInformada(dto.dataBase), prazos: prazosDe(dto.condicao) });
    await this.prisma.$transaction(async (tx) => {
      await criarTitulos(
        tx,
        s.tenantId,
        {
          tipo: t.tipo,
          pessoaTipo: t.pessoaTipo as 'CLIENTE',
          clienteId: t.clienteId,
          fornecedorId: t.fornecedorId,
          usuarioId: t.usuarioId,
          pessoaNome: t.pessoaNome,
          descricao: `Renegociação de ${t.numero}`,
          centroCustoId: t.centroCustoId,
          competencia: t.competencia,
          origemTipo: 'RENEGOCIACAO',
          origemId: t.id,
          origemNumero: t.numero,
          renegociadoDeId: t.id
        },
        parcelas,
        s.id
      );
      await tx.titulo.update({ where: { id }, data: { status: 'RENEGOCIADO' } });
      await historico(tx, s.tenantId, id, 'renegociado', `Saldo de R$ ${valor} em ${parcelas.length} parcela(s): ${dto.condicao}`, s.id);
    });
    return this.titulo(s.tenantId, id);
  }

  async cancelar(s: Sessao, id: string, motivo: string) {
    const t = await this.tituloAberto(s.tenantId, id, 'cancelar');
    if (t.baixas.some((b) => !b.estornada)) {
      throw conflito('TITULO_COM_BAIXA', `${t.numero} já tem baixa registrada. Estorne as baixas antes de cancelar.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.titulo.update({ where: { id }, data: { status: 'CANCELADO', motivoCancelamento: motivo.trim() } });
      await historico(tx, s.tenantId, id, 'cancelado', motivo.trim(), s.id);
    });
    return this.titulo(s.tenantId, id);
  }

  // Recorrências e rotina

  async recorrencias(tenantId: string) {
    const [rs, centros, fornecedores] = await Promise.all([
      this.prisma.recorrencia.findMany({ where: { tenantId }, orderBy: { descricao: 'asc' } }),
      this.prisma.centroCusto.findMany({ where: { tenantId } }),
      this.prisma.fornecedor.findMany({ where: { tenantId }, select: { id: true, nome: true } })
    ]);
    const itens = rs.map((r) => {
      const c = centros.find((x) => x.id === r.centroCustoId);
      return {
        id: r.id,
        descricao: r.descricao,
        fornecedorId: r.fornecedorId,
        fornecedor: fornecedores.find((f) => f.id === r.fornecedorId) ?? null,
        centroCustoId: r.centroCustoId,
        centroCusto: c ? { id: c.id, nome: c.nome } : null,
        compoeCustoFixo: !!c?.compoeCustoFixo,
        valor: reaisTxt(r.valor),
        diaVencimento: r.diaVencimento,
        inicio: textoData(r.inicio),
        fim: r.fim ? textoData(r.fim) : null,
        ativa: r.ativa
      };
    });
    return { itens, total: itens.length, valorMensal: soma(itens.filter((i) => i.ativa).map((i) => dec(i.valor))).toFixed(2) };
  }

  async criarRecorrencia(tenantId: string, dto: RecorrenciaDto) {
    await this.conferirRecorrencia(tenantId, dto);
    const r = await this.prisma.recorrencia.create({
      data: {
        tenantId,
        descricao: dto.descricao.trim(),
        fornecedorId: dto.fornecedorId ?? null,
        centroCustoId: dto.centroCustoId,
        valor: pd(dec(dto.valor).toFixed(2)),
        diaVencimento: dto.diaVencimento,
        inicio: dataBanco(dataDaCompetencia(dto.inicio)),
        fim: dto.fim ? dataBanco(dataDaCompetencia(dto.fim, true)) : null,
        ativa: dto.ativa
      }
    });
    return (await this.recorrencias(tenantId)).itens.find((x) => x.id === r.id);
  }

  async atualizarRecorrencia(tenantId: string, id: string, dto: AtualizarRecorrenciaDto) {
    if (!(await this.prisma.recorrencia.findFirst({ where: { id, tenantId } }))) throw naoEncontrado('essa recorrência');
    await this.conferirRecorrencia(tenantId, dto);
    await this.prisma.recorrencia.update({
      where: { id },
      data: {
        descricao: dto.descricao?.trim(),
        fornecedorId: dto.fornecedorId,
        centroCustoId: dto.centroCustoId,
        valor: dto.valor !== undefined ? pd(dec(dto.valor).toFixed(2)) : undefined,
        diaVencimento: dto.diaVencimento,
        inicio: dto.inicio ? dataBanco(dataDaCompetencia(dto.inicio)) : undefined,
        fim: dto.fim === undefined ? undefined : dto.fim ? dataBanco(dataDaCompetencia(dto.fim, true)) : null,
        ativa: dto.ativa
      }
    });
    return (await this.recorrencias(tenantId)).itens.find((x) => x.id === id);
  }

  async gerarRecorrencias(s: Sessao, competencia: string) {
    const geradas = await this.prisma.$transaction((tx) => gerarRecorrencias(tx, s.tenantId, competencia, s.id));
    return { competencia, geradas };
  }

  rotina(tenantId: string) {
    return this.prisma.$transaction((tx) => rotinaDiaria(tx, tenantId));
  }

  // Comissões

  async comissoes(tenantId: string, competencia: string) {
    const [cs, fechamento] = await Promise.all([
      this.prisma.comissao.findMany({ where: { tenantId, competencia, estornada: false }, orderBy: { criadoEm: 'asc' } }),
      this.prisma.comissaoFechamento.findUnique({ where: { tenantId_competencia: { tenantId, competencia } } })
    ]);
    const [usuarios, titulos, baixas] = await Promise.all([
      this.prisma.usuario.findMany({ where: { tenantId, id: { in: cs.map((c) => c.vendedorId) } }, select: { id: true, nome: true } }),
      this.prisma.titulo.findMany({ where: { tenantId, id: { in: cs.map((c) => c.tituloId) } }, select: { id: true, numero: true, origemNumero: true, pessoaNome: true } }),
      this.prisma.baixa.findMany({ where: { tenantId, id: { in: cs.map((c) => c.baixaId) } }, select: { id: true, data: true } })
    ]);
    const vendedores = usuarios.map((u) => {
      const meus = cs.filter((c) => c.vendedorId === u.id);
      return {
        vendedor: u,
        base: soma(meus.map((c) => dec(tt(c.base)))).toFixed(2),
        valor: soma(meus.map((c) => dec(tt(c.valor)))).toFixed(2),
        itens: meus.map((c) => {
          const t = titulos.find((x) => x.id === c.tituloId);
          return {
            id: c.id,
            tituloId: c.tituloId,
            tituloNumero: t?.numero,
            os: t?.origemNumero,
            cliente: t?.pessoaNome,
            data: textoData(baixas.find((b) => b.id === c.baixaId)!.data),
            base: reaisTxt(c.base),
            percentual: tt(c.percentual),
            valor: reaisTxt(c.valor),
            fechamentoTituloId: c.fechamentoTituloId
          };
        })
      };
    });
    return { competencia, vendedores, total: soma(cs.map((c) => dec(tt(c.valor)))).toFixed(2), fechada: !!fechamento, fechadaEm: fechamento?.fechadaEm ?? null };
  }

  async fecharComissoes(s: Sessao, competencia: string) {
    if (await this.prisma.comissaoFechamento.findUnique({ where: { tenantId_competencia: { tenantId: s.tenantId, competencia } } })) {
      throw conflito('COMPETENCIA_FECHADA', `As comissões de ${competencia} já foram fechadas.`);
    }
    const atual = await this.comissoes(s.tenantId, competencia);
    await this.prisma.$transaction(async (tx) => {
      const centro = await centroPorPapel(tx, s.tenantId, 'COMISSOES');
      for (const v of atual.vendedores) {
        if (dec(v.valor).lte(0)) continue;
        const [t] = await criarTitulos(
          tx,
          s.tenantId,
          {
            tipo: 'PAGAR',
            pessoaTipo: 'VENDEDOR',
            usuarioId: v.vendedor.id,
            pessoaNome: v.vendedor.nome,
            descricao: `Comissões ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`,
            centroCustoId: centro.id,
            competencia,
            origemTipo: 'COMISSAO',
            origemNumero: competencia
          },
          [{ vencimento: `${proximaCompetencia(competencia)}-10`, valor: v.valor }],
          s.id
        );
        await tx.comissao.updateMany({ where: { tenantId: s.tenantId, competencia, vendedorId: v.vendedor.id, estornada: false }, data: { fechamentoTituloId: t.id } });
      }
      await tx.comissaoFechamento.create({ data: { tenantId: s.tenantId, competencia, usuarioId: s.id } });
    });
    return this.comissoes(s.tenantId, competencia);
  }

  // Fluxo, DRE e ponte com o custo

  async fluxo(tenantId: string, ate?: string, agrupamento: 'dia' | 'semana' | 'mes' = 'semana') {
    const hoje = hojeLocal();
    const fim = ate ? dataInformada(ate) : somarDias(hoje, 90);
    if (fim < hoje) throw invalido('A data final do fluxo precisa ser hoje ou depois.');
    const [contas, lancamentos, realizadoBaixas] = await Promise.all([this.contas(tenantId), this.previsto(tenantId, hoje, fim), this.prisma.baixa.findMany({ where: { tenantId, estornada: false }, include: { titulo: { select: { tipo: true } } } })]);
    const saldoAtual = soma(contas.filter((c) => c.ativa).map((c) => dec(c.saldoAtual))).toFixed(2);
    const pontos = projetarCaixa({ saldoInicial: saldoAtual, hoje, ate: fim, agrupamento, lancamentos });
    const inicioDe = (d: string) => (agrupamento === 'dia' ? d : agrupamento === 'mes' ? `${d.slice(0, 7)}-01` : segundaDa(d));
    const recuar = (d: string) => (agrupamento === 'dia' ? somarDias(d, -1) : agrupamento === 'semana' ? somarDias(d, -7) : `${competenciaAnterior(d.slice(0, 7))}-01`);
    const periodos: string[] = [];
    for (let d = inicioDe(hoje), i = 0; i < 4; d = recuar(d), i++) periodos.unshift(d);
    const realizado = periodos.map((inicio) => {
      const doPeriodo = realizadoBaixas.filter((b) => inicioDe(textoData(b.data)) === inicio && textoData(b.data) <= hoje);
      return {
        inicio,
        entradas: soma(doPeriodo.filter((b) => b.titulo.tipo === 'RECEBER').map((b) => dec(tt(b.valor)))).toFixed(2),
        saidas: soma(doPeriodo.filter((b) => b.titulo.tipo === 'PAGAR').map((b) => dec(tt(b.valor)))).toFixed(2)
      };
    });
    const menor = pontos.reduce((m, p) => (!m || dec(p.saldoFinal).lt(m.valor) ? { inicio: p.inicio, valor: p.saldoFinal } : m), null as null | { inicio: string; valor: string });
    return { saldoAtual, hoje, ate: fim, agrupamento, pontos, realizado, menorSaldo: menor };
  }

  async dre(tenantId: string, competencia: string, segmento?: string) {
    const atual = await this.dreDaCompetencia(tenantId, competencia, segmento);
    const anterior = competenciaAnterior(competencia);
    return { competencia, segmento: segmento || null, ...atual, comparativo: { competencia: anterior, ...(await this.dreDaCompetencia(tenantId, anterior, segmento)) } };
  }

  async custoFixoRealizado(tenantId: string, competencia: string) {
    const [ts, centros, tabela, p] = await Promise.all([
      this.prisma.titulo.findMany({ where: { tenantId, tipo: 'PAGAR', competencia, status: { notIn: ['CANCELADO', 'RENEGOCIADO'] } } }),
      this.prisma.centroCusto.findMany({ where: { tenantId, compoeCustoFixo: true } }),
      this.prisma.tabelaCustos.findFirst({ where: { tenantId, competencia, status: { in: ['VIGENTE', 'ENCERRADA'] } }, orderBy: { versao: 'desc' } }),
      this.parametros.carregar(tenantId)
    ]);
    const fixos = ts.filter((t) => centros.some((c) => c.id === t.centroCustoId));
    const realizado = soma(fixos.map((t) => dec(tt(t.valor))));
    const mapa = new Map<string, Dec>();
    for (const t of fixos) {
      const cat = centros.find((c) => c.id === t.centroCustoId)!.categoriaCustoFixo ?? 'outros';
      mapa.set(cat, (mapa.get(cat) ?? dec(0)).plus(tt(t.valor)));
    }
    const custoTabela = tabela ? (tabela.resultado as { custoFixoTotal: string }).custoFixoTotal : null;
    const desvio = custoTabela ? desvioCustoFixo(realizado.toFixed(2), custoTabela) : null;
    return {
      competencia,
      realizado: realizado.toFixed(2),
      porCategoria: [...mapa].sort((a, b) => b[1].comparedTo(a[1])).map(([categoria, v]) => ({ categoria, valor: v.toFixed(2) })),
      tabela: tabela ? { id: tabela.id, versao: tabela.versao, status: tabela.status, custoFixo: custoTabela } : null,
      desvio,
      tolerancia: tt(p.toleranciaCustoFixo),
      acimaDaTolerancia: desvio !== null && dec(desvio).gt(tt(p.toleranciaCustoFixo))
    };
  }

  async importarParaCustoFixo(s: Sessao, competencia: string) {
    const vigente = await buscarVigente(this.prisma, s.tenantId);
    if (vigente?.competencia === competencia) {
      throw conflito(
        'TABELA_VIGENTE',
        `${competencia} é a competência da Tabela de Custos vigente, que é imutável. Importe para uma competência nova e gere uma nova versão da tabela a partir dela.`
      );
    }
    const r = await this.custoFixoRealizado(s.tenantId, competencia);
    await this.prisma.$transaction([
      this.prisma.lancamentoCustoFixo.deleteMany({ where: { tenantId: s.tenantId, competencia } }),
      this.prisma.lancamentoCustoFixo.createMany({
        data: r.porCategoria.map((c) => ({ tenantId: s.tenantId, competencia, categoria: c.categoria, descricao: 'Realizado no financeiro', valor: pd(c.valor) }))
      })
    ]);
    const lancamentos = await this.prisma.lancamentoCustoFixo.findMany({ where: { tenantId: s.tenantId, competencia }, orderBy: { categoria: 'asc' } });
    return {
      competencia,
      total: soma(lancamentos.map((l) => dec(tt(l.valor)))).toFixed(2),
      lancamentos: lancamentos.map((l) => ({ id: l.id, competencia: l.competencia, categoria: l.categoria, descricao: l.descricao, valor: tt(l.valor) }))
    };
  }

  async historicoCustos(tenantId: string, centroId: string, meses: number) {
    const centro = await this.prisma.centroTrabalho.findFirst({ where: { id: centroId, tenantId } });
    if (!centro) throw naoEncontrado('esse centro de trabalho');
    const competencias: string[] = [];
    for (let c = hojeLocal().slice(0, 7), i = 0; i < meses; c = competenciaAnterior(c), i++) competencias.unshift(c);
    const [centrosCusto, movs] = await Promise.all([
      this.prisma.centroCusto.findMany({ where: { tenantId, custoDiretoCentro: { not: Prisma.DbNull } } }),
      this.prisma.movimento.findMany({ where: { tenantId, centroId, tipo: 'SAIDA_CENTRO', data: { gte: inicioDaCompetencia(competencias[0]) } } })
    ]);
    const meus = centrosCusto.filter((c) => (c.custoDiretoCentro as CustoDireto).centroTrabalhoId === centroId);
    const titulos = await this.prisma.titulo.findMany({
      where: { tenantId, tipo: 'PAGAR', centroCustoId: { in: meus.map((c) => c.id) }, competencia: { in: competencias }, status: { notIn: ['CANCELADO', 'RENEGOCIADO'] } }
    });
    const linhas = competencias.map((competencia) => {
      const v = Object.fromEntries(COMPONENTES.map((k) => [k, dec(0)])) as Record<(typeof COMPONENTES)[number], Dec>;
      for (const t of titulos.filter((x) => x.competencia === competencia)) {
        const comp = (meus.find((c) => c.id === t.centroCustoId)!.custoDiretoCentro as CustoDireto).componente;
        v[comp] = v[comp].plus(tt(t.valor));
      }
      v.insumos = v.insumos.plus(soma(movs.filter((m) => local(m.data).data.slice(0, 7) === competencia).map((m) => dec(tt(m.valor)).neg())));
      return { competencia, ...Object.fromEntries(COMPONENTES.map((k) => [k, v[k].toFixed(2)])), total: soma(Object.values(v)).toFixed(2) };
    });
    const media = Object.fromEntries(COMPONENTES.map((k) => [k, soma(linhas.map((l) => dec((l as Record<string, string>)[k]))).div(meses).toFixed(2)]));
    return {
      centro: { id: centro.id, codigo: centro.codigo, nome: centro.nome },
      meses: linhas,
      mediaProposta: media,
      cadastro: { manutencao: tt(centro.manutencao), insumos: tt(centro.insumos), outros: tt(centro.outros) }
    };
  }

  /** Bloco `financeiro` do painel; a rotina diária roda na primeira leitura do dia. */
  async resumoPainel(tenantId: string) {
    const hoje = hojeLocal();
    const p = await this.parametros.carregar(tenantId);
    if (!p.rotinaExecutadaEm || textoData(p.rotinaExecutadaEm) !== hoje) await this.rotina(tenantId);
    const [contas, abertos, bloqueados, fluxo, custoFixo] = await Promise.all([
      this.contas(tenantId),
      this.prisma.titulo.findMany({ where: { tenantId, status: { in: [...ABERTOS] } } }),
      this.prisma.cliente.count({ where: { tenantId, status: 'BLOQUEADO' } }),
      this.fluxo(tenantId, somarDias(hoje, 90), 'dia'),
      this.custoFixoRealizado(tenantId, hoje.slice(0, 7))
    ]);
    const somaSaldo = (ts: Titulo[]) => soma(ts.map((t) => saldoDo(t))).toFixed(2);
    const receberVencidos = abertos.filter((t) => t.tipo === 'RECEBER' && textoData(t.vencimento) < hoje);
    const saldoEm = (dias: number) => fluxo.pontos.find((x) => x.inicio === somarDias(hoje, dias))?.saldoFinal ?? fluxo.pontos[fluxo.pontos.length - 1]?.saldoFinal ?? '0.00';
    const resumo = {
      saldoContas: soma(contas.filter((c) => c.ativa).map((c) => dec(c.saldoAtual))).toFixed(2),
      receberVencido: somaSaldo(receberVencidos),
      receberHoje: somaSaldo(abertos.filter((t) => t.tipo === 'RECEBER' && textoData(t.vencimento) === hoje)),
      pagar7dias: somaSaldo(abertos.filter((t) => t.tipo === 'PAGAR' && textoData(t.vencimento) >= hoje && textoData(t.vencimento) <= somarDias(hoje, 7))),
      caixa30: saldoEm(30),
      caixa60: saldoEm(60),
      caixa90: saldoEm(90),
      menorSaldo: fluxo.menorSaldo,
      custoFixoDesvio: custoFixo.desvio,
      clientesBloqueados: bloqueados
    };
    const alertas: { tipo: 'perigo' | 'atencao'; mensagem: string; link: string }[] = [];
    if (receberVencidos.length) {
      alertas.push({
        tipo: 'atencao',
        mensagem: `${receberVencidos.length} título(s) a receber vencido(s), somando R$ ${resumo.receberVencido.replace('.', ',')}. Cobre os clientes.`,
        link: '/financeiro/titulos?tipo=RECEBER&status=VENCIDO'
      });
    }
    const negativo = fluxo.pontos.find((x) => x.negativo);
    if (negativo) {
      alertas.push({ tipo: 'perigo', mensagem: `O caixa previsto fica negativo em ${negativo.inicio.split('-').reverse().join('/')}. Antecipe recebimentos ou adie pagamentos.`, link: '/financeiro/fluxo' });
    }
    if (custoFixo.acimaDaTolerancia) {
      alertas.push({
        tipo: 'atencao',
        mensagem: `O custo fixo realizado de ${custoFixo.competencia} está ${dec(custoFixo.desvio!).times(100).toDecimalPlaces(1).toFixed()}% acima do usado na Tabela de Custos. Avalie uma nova versão.`,
        link: '/financeiro/custo-fixo-realizado'
      });
    }
    return { resumo, alertas };
  }

  private async dreDaCompetencia(tenantId: string, competencia: string, segmento?: string) {
    const de = inicioDaCompetencia(competencia);
    const ate = inicioDaCompetencia(proximaCompetencia(competencia));
    const [titulos, entregues, custoFixo] = await Promise.all([
      this.prisma.titulo.findMany({ where: { tenantId, tipo: 'RECEBER', origemTipo: 'OS', competencia, status: { not: 'CANCELADO' } } }),
      this.prisma.ordemServico.findMany({ where: { tenantId, status: 'ENTREGUE', entregueEm: { gte: de, lt: ate } }, include: incluirOs }),
      this.custoFixoRealizado(tenantId, competencia)
    ]);
    const ordensReceita = await this.prisma.ordemServico.findMany({ where: { tenantId, id: { in: titulos.map((t) => t.origemId!) } }, include: incluirOs });
    const pecas = await this.prisma.item.findMany({ where: { tenantId, tipo: 'PECA_REPOSICAO' }, select: { id: true } });
    const ePeca = new Set(pecas.map((i) => i.id));
    const doSegmento = (seg: string) => !segmento || seg === segmento;

    let receitaTotal = dec(0);
    let receitaServicos = dec(0);
    let receitaPecas = dec(0);
    for (const t of titulos) {
      const os = ordensReceita.find((o) => o.id === t.origemId);
      const valor = dec(tt(t.valor));
      receitaTotal = receitaTotal.plus(valor);
      if (!os || !doSegmento(os.segmento)) continue;
      const orcado = dec(custoRealDa(os).custoOrcado);
      const pecaOrcado = soma(os.custos.filter((c) => c.itemId && ePeca.has(c.itemId)).map((c) => dec(tt(c.orcado))));
      const parte = orcado.gt(0) ? valor.times(pecaOrcado).div(orcado) : dec(0);
      receitaPecas = receitaPecas.plus(parte);
      receitaServicos = receitaServicos.plus(valor.minus(parte));
    }
    const ordens = entregues.filter((o) => doSegmento(o.segmento));
    const real = (cats: string[]) => soma(ordens.flatMap((o) => o.custos.filter((c) => cats.includes(c.categoria) && c.real).map((c) => dec(tt(c.real!)))));
    const preco = (o: (typeof ordens)[number]) => dec(tt(o.precoFinalLote));
    const receitaSegmento = receitaServicos.plus(receitaPecas);
    const fixo = segmento ? (receitaTotal.gt(0) ? dec(custoFixo.realizado).times(receitaSegmento).div(receitaTotal) : dec(0)) : dec(custoFixo.realizado);
    return calcularDRE({
      receitaServicos: receitaServicos.toFixed(2),
      receitaPecas: receitaPecas.toFixed(2),
      material: real(['material', 'ferramental']).toFixed(2),
      terceiros: real(['terceiros', 'frete']).toFixed(2),
      impostos: soma(ordens.map((o) => preco(o).times(tt(o.impostos)))).toFixed(2),
      comissoes: soma(ordens.map((o) => preco(o).times(tt(o.comissao)))).toFixed(2),
      naoQualidade: soma(ordens.map((o) => dec(custoRealDa(o).custoNaoQualidade))).toFixed(2),
      custoFixo: fixo.toFixed(2)
    });
  }

  /** Previsto do fluxo: títulos em aberto, OS não entregues, orçamentos aprovados e recorrências ainda não geradas. */
  private async previsto(tenantId: string, hoje: string, ate: string): Promise<LancamentoCaixa[]> {
    const p = await this.parametros.carregar(tenantId);
    const [titulos, ordens, orcamentos, recorrencias, gerados] = await Promise.all([
      this.prisma.titulo.findMany({ where: { tenantId, status: { in: [...ABERTOS] } } }),
      this.prisma.ordemServico.findMany({
        where: { tenantId, status: { in: ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA', 'CONTROLE_QUALIDADE', 'CONCLUIDA'] } },
        include: { orcamento: { select: { condicaoPagamento: true } }, cliente: { select: { condicaoPagamento: true } } }
      }),
      this.prisma.orcamento.findMany({ where: { tenantId, status: 'APROVADO', ordem: { is: null } }, include: { cliente: { select: { condicaoPagamento: true } } } }),
      this.prisma.recorrencia.findMany({ where: { tenantId, ativa: true } }),
      this.prisma.titulo.findMany({ where: { tenantId, recorrenciaId: { not: null } }, select: { recorrenciaId: true, competencia: true } })
    ]);
    const lanc: LancamentoCaixa[] = titulos.map((t) => ({ data: textoData(t.vencimento), valor: (t.tipo === 'RECEBER' ? saldoDo(t) : saldoDo(t).neg()).toFixed(2), realizado: false }));
    const parcelas = (valor: Prisma.Decimal, base: string, condicao: string) => {
      if (dec(tt(valor)).toDecimalPlaces(2).lte(0)) return [];
      let prazos: number[];
      try {
        prazos = prazosDe(condicao);
      } catch {
        prazos = [0];
      }
      return gerarParcelas({ valor: tt(valor), dataBase: base < hoje ? hoje : base, prazos }).map((x) => ({ data: x.vencimento, valor: x.valor, realizado: false }));
    };
    for (const o of ordens) lanc.push(...parcelas(o.precoFinalLote, textoData(o.prazo), o.orcamento?.condicaoPagamento || o.cliente.condicaoPagamento || p.condicaoPadrao));
    for (const o of orcamentos) {
      lanc.push(...parcelas(o.precoFinalLote, o.prazoPrometido ? textoData(o.prazoPrometido) : hoje, o.condicaoPagamento || o.cliente.condicaoPagamento || p.condicaoPadrao));
    }
    for (let c = hoje.slice(0, 7); c <= ate.slice(0, 7); c = proximaCompetencia(c)) {
      for (const r of recorrencias) {
        const inicio = textoData(r.inicio).slice(0, 7);
        const fim = r.fim ? textoData(r.fim).slice(0, 7) : null;
        if (inicio > c || (fim && fim < c) || gerados.some((g) => g.recorrenciaId === r.id && g.competencia === c)) continue;
        lanc.push({ data: vencimentoNaCompetencia(c, r.diaVencimento), valor: dec(tt(r.valor)).neg().toFixed(2), realizado: false });
      }
    }
    return lanc;
  }

  private async pessoa(tenantId: string, p: { clienteId?: string; fornecedorId?: string; nome?: string }) {
    if (p.clienteId) {
      const c = await this.prisma.cliente.findFirst({ where: { id: p.clienteId, tenantId } });
      if (!c) throw naoEncontrado('esse cliente');
      return { pessoaTipo: 'CLIENTE' as const, clienteId: c.id, pessoaNome: c.fantasia || c.nome };
    }
    if (p.fornecedorId) {
      const f = await this.prisma.fornecedor.findFirst({ where: { id: p.fornecedorId, tenantId } });
      if (!f) throw naoEncontrado('esse fornecedor');
      return { pessoaTipo: 'FORNECEDOR' as const, fornecedorId: f.id, pessoaNome: f.fantasia || f.nome };
    }
    if (p.nome?.trim()) return { pessoaTipo: 'OUTRO' as const, pessoaNome: p.nome.trim() };
    throw invalido('Informe o cliente, o fornecedor ou o nome de quem recebe ou paga.', [{ campo: 'pessoa', mensagem: 'pessoa é obrigatória' }]);
  }

  private async conferirCustoDireto(tenantId: string, c?: CustoDireto | null) {
    if (c && !(await this.prisma.centroTrabalho.findFirst({ where: { id: c.centroTrabalhoId, tenantId } }))) throw naoEncontrado('esse centro de trabalho');
  }

  private async conferirRecorrencia(tenantId: string, dto: { centroCustoId?: string; fornecedorId?: string | null }) {
    if (dto.centroCustoId && !(await this.prisma.centroCusto.findFirst({ where: { id: dto.centroCustoId, tenantId } }))) throw naoEncontrado('esse centro de custo');
    if (dto.fornecedorId && !(await this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, tenantId } }))) throw naoEncontrado('esse fornecedor');
  }

  private async conta(tenantId: string, id: string) {
    const c = await this.prisma.contaFinanceira.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('essa conta');
    return c;
  }

  private async tituloAberto(tenantId: string, id: string, acao: string) {
    const t = await this.buscarTitulo(tenantId, id);
    if (!(ABERTOS as readonly string[]).includes(t.status)) {
      throw conflito('TITULO_FECHADO', `Não dá para ${acao} ${t.numero} porque ele está ${t.status.toLowerCase()}.`, { status: t.status });
    }
    return t;
  }

  private async buscarTitulo(tenantId: string, id: string) {
    const t = await this.prisma.titulo.findFirst({ where: { id, tenantId }, include: { baixas: { orderBy: { data: 'asc' } } } });
    if (!t) throw naoEncontrado('esse título');
    return t;
  }
}

const dataDaCompetencia = (s: string, fim = false) => (s.length === 7 ? (fim ? vencimentoNaCompetencia(s, 31) : `${s}-01`) : s.slice(0, 10));

function saidaCentro(c: CentroCusto) {
  return {
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    compoeCustoFixo: c.compoeCustoFixo,
    categoriaCustoFixo: c.categoriaCustoFixo,
    custoDiretoCentro: (c.custoDiretoCentro as CustoDireto | null) ?? null,
    papel: c.papel,
    ativo: c.ativo
  };
}

export function saidaTitulo(t: Titulo & { baixas: unknown[] }, centros: CentroCusto[], hoje = hojeLocal()) {
  const c = centros.find((x) => x.id === t.centroCustoId);
  const atraso = diasAtraso(t, hoje);
  const saldo = (ABERTOS as readonly string[]).includes(t.status) ? saldoDo(t) : dec(0);
  return {
    id: t.id,
    numero: t.numero,
    tipo: t.tipo,
    pessoa: { tipo: t.pessoaTipo, id: t.clienteId ?? t.fornecedorId ?? t.usuarioId ?? null, nome: t.pessoaNome },
    descricao: t.descricao,
    parcela: t.parcela,
    grupoId: t.grupoId,
    centroCusto: c ? { id: c.id, nome: c.nome } : null,
    compoeCustoFixo: !!c?.compoeCustoFixo,
    custoDiretoCentro: (c?.custoDiretoCentro as CustoDireto | null) ?? null,
    competencia: t.competencia,
    emissao: textoData(t.emissao),
    vencimento: textoData(t.vencimento),
    valor: reaisTxt(t.valor),
    valorPago: reaisTxt(t.valorPago),
    saldo: saldo.toFixed(2),
    status: t.status,
    diasAtraso: atraso,
    vencido: atraso > 0 && saldo.gt(0),
    origem: t.origemTipo !== 'MANUAL' ? { tipo: t.origemTipo, id: t.origemId, numero: t.origemNumero } : null,
    documentoFiscal: t.documentoFiscal
  };
}

export const competenciaValida = (c?: string) => {
  if (!c || !RE_COMPETENCIA.test(c)) throw invalido('A competência precisa estar no formato AAAA-MM, por exemplo 2026-10.');
  return c;
};
