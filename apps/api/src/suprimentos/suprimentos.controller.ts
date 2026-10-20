import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { competenciaAtual } from '../comum/decimal';
import { Papeis, Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarFornecedorDto, AtualizarItemDto, FornecedorDto, ItemDto } from './cadastros.dto';
import { CotacaoDto, EscolherDto, PedidoDto, RecebimentoDto, RequisicaoDto, RespostaDto } from './compras.dto';
import { ComprasService } from './compras.service';
import { AtualizarLocalDto, InventarioDto, LocalDto, MovimentoDto } from './estoque.dto';
import { EstoqueService } from './estoque.service';
import { FornecedoresService } from './fornecedores.service';
import { ItensService } from './itens.service';

@ApiTags('itens')
@ApiBearerAuth()
@Controller('itens')
export class ItensController {
  constructor(private readonly itens: ItensService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('q') q?: string, @Query('tipo') tipo?: string, @Query('abaixoDoMinimo') abaixoDoMinimo?: string) {
    return this.itens.listar(s.tenantId, { q, tipo, abaixoDoMinimo });
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: ItemDto) {
    return this.itens.criar(s.tenantId, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.itens.detalhe(s.tenantId, id);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarItemDto) {
    return this.itens.atualizar(s.tenantId, id, dto);
  }

  @Delete(':id')
  inativar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.itens.inativar(s.tenantId, id);
  }
}

@ApiTags('fornecedores')
@ApiBearerAuth()
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedores: FornecedoresService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('q') q?: string, @Query('status') status?: string) {
    return this.fornecedores.listar(s.tenantId, q, status);
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: FornecedorDto) {
    return this.fornecedores.criar(s.tenantId, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.fornecedores.detalhe(s.tenantId, id);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarFornecedorDto) {
    return this.fornecedores.atualizar(s.tenantId, id, dto);
  }

  @Delete(':id')
  inativar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.fornecedores.inativar(s.tenantId, id);
  }
}

@ApiTags('estoque')
@ApiBearerAuth()
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get('locais')
  locais(@SessaoAtual() s: Sessao) {
    return this.estoque.locais(s.tenantId);
  }

  @Post('locais')
  criarLocal(@SessaoAtual() s: Sessao, @Body() dto: LocalDto) {
    return this.estoque.criarLocal(s.tenantId, dto);
  }

  @Patch('locais/:id')
  atualizarLocal(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarLocalDto) {
    return this.estoque.atualizarLocal(s.tenantId, id, dto);
  }

  @Get('saldos')
  saldos(@SessaoAtual() s: Sessao, @Query('localId') localId?: string, @Query('q') q?: string, @Query('abaixoDoMinimo') abaixoDoMinimo?: string) {
    return this.estoque.saldos(s.tenantId, { localId, q, abaixoDoMinimo });
  }

  @Get('movimentos')
  movimentos(
    @SessaoAtual() s: Sessao,
    @Query('itemId') itemId?: string,
    @Query('osId') osId?: string,
    @Query('tipo') tipo?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string
  ) {
    return this.estoque.movimentos(s.tenantId, { itemId, osId, tipo, de, ate });
  }

  @Post('movimentos')
  registrar(@SessaoAtual() s: Sessao, @Body() dto: MovimentoDto) {
    return this.estoque.registrar(s, dto);
  }

  @Get('lotes')
  lotes(@SessaoAtual() s: Sessao, @Query('itemId') itemId?: string) {
    return this.estoque.lotes(s.tenantId, itemId);
  }

  @Get('consumo-centros')
  consumoCentros(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    return this.estoque.consumoCentros(s.tenantId, competencia ?? competenciaAtual());
  }

  @Get('curva-abc')
  curvaAbc(@SessaoAtual() s: Sessao, @Query('meses') meses?: string) {
    return this.estoque.curvaAbc(s.tenantId, Math.min(24, Math.max(1, Number(meses) || 3)));
  }

  @Post('inventarios')
  inventario(@SessaoAtual() s: Sessao, @Body() dto: InventarioDto) {
    return this.estoque.inventario(s, dto);
  }
}

@ApiTags('compras')
@ApiBearerAuth()
@Controller('compras')
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Get('requisicoes')
  requisicoes(@SessaoAtual() s: Sessao, @Query('status') status?: string) {
    return this.compras.requisicoes(s.tenantId, status);
  }

  @Post('requisicoes')
  criarRequisicao(@SessaoAtual() s: Sessao, @Body() dto: RequisicaoDto) {
    return this.compras.criarRequisicao(s, dto);
  }

  @Post('requisicoes/gerar-ponto-pedido')
  gerarPontoPedido(@SessaoAtual() s: Sessao) {
    return this.compras.gerarPontoPedido(s);
  }

  @Get('cotacoes')
  cotacoes(@SessaoAtual() s: Sessao) {
    return this.compras.cotacoes(s.tenantId);
  }

  @Post('cotacoes')
  criarCotacao(@SessaoAtual() s: Sessao, @Body() dto: CotacaoDto) {
    return this.compras.criarCotacao(s.tenantId, dto);
  }

  @Get('cotacoes/:id')
  cotacao(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.compras.cotacao(s.tenantId, id);
  }

  @Post('cotacoes/:id/respostas')
  responder(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: RespostaDto) {
    return this.compras.responder(s.tenantId, id, dto);
  }

  @Post('cotacoes/:id/escolher')
  escolher(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: EscolherDto) {
    return this.compras.escolher(s, id, dto);
  }

  @Get('pedidos')
  pedidos(@SessaoAtual() s: Sessao, @Query('status') status?: string) {
    return this.compras.pedidos(s.tenantId, status);
  }

  @Post('pedidos')
  criarPedido(@SessaoAtual() s: Sessao, @Body() dto: PedidoDto) {
    return this.compras.criarPedido(s, dto);
  }

  @Get('pedidos/:id')
  pedido(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.compras.pedido(s.tenantId, id);
  }

  @Papeis('GESTOR', 'ADMIN')
  @Post('pedidos/:id/aprovar')
  @HttpCode(200)
  aprovar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.compras.aprovar(s, id);
  }

  @Post('pedidos/:id/cancelar')
  @HttpCode(200)
  cancelar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.compras.cancelar(s.tenantId, id);
  }

  @Post('pedidos/:id/recebimentos')
  receber(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: RecebimentoDto) {
    return this.compras.receber(s, id, dto);
  }
}
