import { Injectable } from '@nestjs/common';
import { Cliente, Prisma, StatusCliente, StatusOrcamento } from '@prisma/client';
import { reais } from '@promec/motor';
import { cnpjValido, cpfValido, somenteDigitos } from '../comum/documento';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { ErroApi } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { prazosDe } from '../financeiro/financeiro-core';
import { dataBanco, hojeLocal, somarDias, textoData } from '../planejamento/calendario';
import { pdOpc } from '../comum/decimal';
import { AtualizarClienteDto, CriarClienteDto } from './clientes.dto';

const STATUS: StatusCliente[] = ['ATIVO', 'BLOQUEADO', 'INATIVO'];

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, q?: string, status?: string) {
    const termo = q?.trim();
    const digitos = termo ? somenteDigitos(termo) : '';
    const itens = await this.prisma.cliente.findMany({
      where: {
        tenantId,
        ...(status && STATUS.includes(status as StatusCliente) ? { status: status as StatusCliente } : {}),
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: 'insensitive' } },
                { fantasia: { contains: termo, mode: 'insensitive' } },
                { cidade: { contains: termo, mode: 'insensitive' } },
                ...(digitos ? [{ documento: { contains: digitos } }] : [])
              ]
            }
          : {})
      },
      orderBy: { nome: 'asc' }
    });
    const resumos = await this.resumos(tenantId, itens.map((c) => c.id));
    return { itens: itens.map((c) => saida(c, resumos.get(c.id))), total: itens.length };
  }

  async detalhe(tenantId: string, id: string) {
    const c = await this.buscar(tenantId, id);
    return saida(c, (await this.resumos(tenantId, [id])).get(id));
  }

  async criar(tenantId: string, dto: CriarClienteDto) {
    if (dto.condicaoPagamento) prazosDe(dto.condicaoPagamento);
    const documento = conferirDocumento(dto.tipo, dto.documento);
    await this.documentoLivre(tenantId, documento);
    const c = await this.prisma.cliente.create({ data: { tenantId, ...limpar(dto), tipo: dto.tipo, nome: dto.nome.trim(), documento } });
    return this.detalhe(tenantId, c.id);
  }

  async atualizar(s: Sessao, id: string, dto: AtualizarClienteDto) {
    const tenantId = s.tenantId;
    const atual = await this.buscar(tenantId, id);
    if (dto.condicaoPagamento) prazosDe(dto.condicaoPagamento);
    const liberando = atual.status === 'BLOQUEADO' && dto.status === 'ATIVO';
    if (liberando && s.papel !== 'GESTOR' && s.papel !== 'ADMIN') {
      throw new ErroApi(403, 'SEM_PERMISSAO', 'Liberar um cliente bloqueado é decisão de um gestor. Peça a um gestor da empresa para fazer a liberação.');
    }
    const liberacao = liberando
      ? { bloqueioAutomatico: false, liberadoPorId: s.id, liberadoAte: dataBanco(dto.liberadoAte?.slice(0, 10) ?? somarDias(hojeLocal(), 7)) }
      : {};
    const tipo = dto.tipo ?? atual.tipo;
    const documento = dto.documento !== undefined || dto.tipo !== undefined ? conferirDocumento(tipo, dto.documento ?? atual.documento) : atual.documento;
    if (documento !== atual.documento) await this.documentoLivre(tenantId, documento);
    await this.prisma.cliente.update({ where: { id }, data: { ...limpar(dto), tipo, documento, nome: dto.nome?.trim(), ...liberacao } });
    return this.detalhe(tenantId, id);
  }

  async inativar(tenantId: string, id: string) {
    await this.buscar(tenantId, id);
    await this.prisma.cliente.update({ where: { id }, data: { status: 'INATIVO' } });
    return this.detalhe(tenantId, id);
  }

  private async resumos(tenantId: string, ids: string[]) {
    const grupos = await this.prisma.orcamento.groupBy({
      by: ['clienteId', 'status'],
      where: { tenantId, clienteId: { in: ids } },
      _count: { _all: true },
      _sum: { precoFinalLote: true }
    });
    const mapa = new Map<string, { orcamentos: number; aprovados: number; valor: Prisma.Decimal }>();
    for (const g of grupos) {
      const r = mapa.get(g.clienteId) ?? { orcamentos: 0, aprovados: 0, valor: new Prisma.Decimal(0) };
      r.orcamentos += g._count._all;
      if (APROVADOS.includes(g.status)) {
        r.aprovados += g._count._all;
        r.valor = r.valor.plus(g._sum.precoFinalLote ?? 0);
      }
      mapa.set(g.clienteId, r);
    }
    return mapa;
  }

  private async documentoLivre(tenantId: string, documento: string) {
    const existe = await this.prisma.cliente.findFirst({ where: { tenantId, documento } });
    if (existe) {
      throw conflito('DOCUMENTO_DUPLICADO', `Esse documento já está cadastrado para ${existe.nome}. Abra o cadastro existente em vez de criar outro.`, { clienteId: existe.id });
    }
  }

  private async buscar(tenantId: string, id: string) {
    const c = await this.prisma.cliente.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('esse cliente');
    return c;
  }
}

const APROVADOS: StatusOrcamento[] = ['APROVADO', 'CONVERTIDO'];

function conferirDocumento(tipo: 'PF' | 'PJ', valor: string) {
  const documento = somenteDigitos(valor);
  const ok = tipo === 'PF' ? cpfValido(documento) : cnpjValido(documento);
  if (!ok) {
    const nome = tipo === 'PF' ? 'CPF' : 'CNPJ';
    throw invalido(`O ${nome} informado não confere: os dígitos verificadores não batem. Confira o número no documento do cliente e digite de novo.`, [
      { campo: 'documento', mensagem: `${nome} inválido` }
    ]);
  }
  return documento;
}

function limpar(dto: AtualizarClienteDto) {
  return {
    fantasia: dto.fantasia,
    email: dto.email?.trim(),
    telefone: dto.telefone !== undefined ? somenteDigitos(dto.telefone) : undefined,
    cidade: dto.cidade,
    uf: dto.uf?.toUpperCase(),
    status: dto.status,
    observacoes: dto.observacoes,
    condicaoPagamento: dto.condicaoPagamento?.trim(),
    limiteCredito: pdOpc(dto.limiteCredito)
  };
}

function saida(c: Cliente, r?: { orcamentos: number; aprovados: number; valor: Prisma.Decimal }) {
  return {
    id: c.id,
    tipo: c.tipo,
    documento: c.documento,
    nome: c.nome,
    fantasia: c.fantasia,
    email: c.email,
    telefone: c.telefone,
    cidade: c.cidade,
    uf: c.uf,
    status: c.status,
    observacoes: c.observacoes,
    condicaoPagamento: c.condicaoPagamento,
    limiteCredito: c.limiteCredito ? c.limiteCredito.toFixed(2) : null,
    bloqueioAutomatico: c.bloqueioAutomatico,
    liberadoAte: c.liberadoAte ? textoData(c.liberadoAte) : null,
    liberadoPorId: c.liberadoPorId,
    resumo: { orcamentos: r?.orcamentos ?? 0, aprovados: r?.aprovados ?? 0, valorAprovado: reais(r ? r.valor.toFixed() : 0) }
  };
}
