import { Injectable } from '@nestjs/common';
import { Fornecedor, StatusCliente } from '@prisma/client';
import { tt } from '../comum/decimal';
import { cnpjValido, cpfValido, somenteDigitos } from '../comum/documento';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarFornecedorDto, FornecedorDto } from './cadastros.dto';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, q?: string, status?: string) {
    const termo = q?.trim();
    const itens = await this.prisma.fornecedor.findMany({
      where: {
        tenantId,
        ...(['ATIVO', 'BLOQUEADO', 'INATIVO'].includes(status ?? '') ? { status: status as StatusCliente } : {}),
        ...(termo
          ? { OR: [{ nome: { contains: termo, mode: 'insensitive' } }, { fantasia: { contains: termo, mode: 'insensitive' } }, ...(somenteDigitos(termo) ? [{ documento: { contains: somenteDigitos(termo) } }] : [])] }
          : {})
      },
      include: { itens: { include: { item: { select: { descricao: true } } }, orderBy: { data: 'desc' } } },
      orderBy: { nome: 'asc' }
    });
    return { itens: itens.map(saida), total: itens.length };
  }

  async detalhe(tenantId: string, id: string) {
    return saida(await this.buscar(tenantId, id));
  }

  async criar(tenantId: string, dto: FornecedorDto) {
    const documento = conferir(dto.tipo, dto.documento);
    await this.livre(tenantId, documento);
    const f = await this.prisma.fornecedor.create({ data: { tenantId, ...dados(dto), tipo: dto.tipo, documento, nome: dto.nome.trim() } });
    return this.detalhe(tenantId, f.id);
  }

  async atualizar(tenantId: string, id: string, dto: AtualizarFornecedorDto) {
    const atual = await this.buscar(tenantId, id);
    const tipo = dto.tipo ?? atual.tipo;
    const documento = dto.documento !== undefined || dto.tipo !== undefined ? conferir(tipo, dto.documento ?? atual.documento) : atual.documento;
    if (documento !== atual.documento) await this.livre(tenantId, documento);
    await this.prisma.fornecedor.update({ where: { id }, data: { ...dados(dto), tipo, documento, nome: dto.nome?.trim() } });
    return this.detalhe(tenantId, id);
  }

  async inativar(tenantId: string, id: string) {
    await this.buscar(tenantId, id);
    await this.prisma.fornecedor.update({ where: { id }, data: { status: 'INATIVO' } });
    return this.detalhe(tenantId, id);
  }

  private async livre(tenantId: string, documento: string) {
    const existe = await this.prisma.fornecedor.findFirst({ where: { tenantId, documento } });
    if (existe) throw conflito('DOCUMENTO_DUPLICADO', `Esse documento já está cadastrado para ${existe.nome}. Abra o cadastro existente em vez de criar outro.`, { fornecedorId: existe.id });
  }

  private async buscar(tenantId: string, id: string) {
    const f = await this.prisma.fornecedor.findFirst({
      where: { id, tenantId },
      include: { itens: { include: { item: { select: { descricao: true } } }, orderBy: { data: 'desc' } } }
    });
    if (!f) throw naoEncontrado('esse fornecedor');
    return f;
  }
}

function conferir(tipo: 'PF' | 'PJ', valor: string) {
  const d = somenteDigitos(valor);
  if (!(tipo === 'PF' ? cpfValido(d) : cnpjValido(d))) {
    const nome = tipo === 'PF' ? 'CPF' : 'CNPJ';
    throw invalido(`O ${nome} informado não confere: os dígitos verificadores não batem. Confira o número e digite de novo.`, [{ campo: 'documento', mensagem: `${nome} inválido` }]);
  }
  return d;
}

const dados = (dto: AtualizarFornecedorDto) => ({
  fantasia: dto.fantasia,
  email: dto.email?.trim(),
  telefone: dto.telefone !== undefined ? somenteDigitos(dto.telefone) : undefined,
  cidade: dto.cidade,
  uf: dto.uf?.toUpperCase(),
  categorias: dto.categorias,
  prazoMedioDias: dto.prazoMedioDias,
  condicaoPagamento: dto.condicaoPagamento,
  status: dto.status,
  observacoes: dto.observacoes
});

type FornecedorCompleto = Fornecedor & { itens: { itemId: string; ultimoPreco: { toFixed(): string }; data: Date; item: { descricao: string } }[] };

function saida(f: FornecedorCompleto) {
  return {
    id: f.id,
    tipo: f.tipo,
    documento: f.documento,
    nome: f.nome,
    fantasia: f.fantasia,
    email: f.email,
    telefone: f.telefone,
    cidade: f.cidade,
    uf: f.uf,
    categorias: f.categorias,
    prazoMedioDias: f.prazoMedioDias,
    condicaoPagamento: f.condicaoPagamento,
    avaliacao: tt(f.avaliacao.toDecimalPlaces(2)),
    entregas: f.entregas,
    status: f.status,
    observacoes: f.observacoes,
    itens: f.itens.map((i) => ({ itemId: i.itemId, descricao: i.item.descricao, ultimoPreco: i.ultimoPreco.toFixed(), data: i.data }))
  };
}
