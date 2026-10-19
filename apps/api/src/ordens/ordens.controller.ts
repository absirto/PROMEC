import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Papeis, Sessao, SessaoAtual } from '../comum/sessao';
import {
  AtualizarCustoDto,
  AtualizarOperacaoDto,
  AtualizarOsDto,
  CancelarDto,
  ConverterDto,
  CriarOsDto,
  CustoOsDto,
  EntregarDto,
  IniciarDto,
  InspecaoDto,
  OperacaoOsDto,
  PararDto,
  PausarDto
} from './ordens.dto';
import { OrdensService } from './ordens.service';

@ApiTags('ordens-servico')
@ApiBearerAuth()
@Controller('ordens-servico')
export class OrdensController {
  constructor(private readonly ordens: OrdensService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('status') status?: string, @Query('q') q?: string, @Query('atrasadas') atrasadas?: string) {
    return this.ordens.listar(s.tenantId, { status, q, atrasadas });
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: CriarOsDto) {
    return this.ordens.criarRapida(s, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.ordens.detalhe(s.tenantId, id);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarOsDto) {
    return this.ordens.atualizar(s, id, dto);
  }

  @Post(':id/liberar')
  @HttpCode(200)
  liberar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.ordens.liberar(s, id);
  }

  @Post(':id/operacoes')
  incluirOperacao(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: OperacaoOsDto) {
    return this.ordens.incluirOperacao(s, id, dto);
  }

  @Patch(':id/operacoes/:opId')
  atualizarOperacao(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('opId') opId: string, @Body() dto: AtualizarOperacaoDto) {
    return this.ordens.atualizarOperacao(s, id, opId, dto);
  }

  @Delete(':id/operacoes/:opId')
  removerOperacao(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('opId') opId: string) {
    return this.ordens.removerOperacao(s, id, opId);
  }

  @Post(':id/operacoes/:opId/iniciar')
  @HttpCode(200)
  iniciar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('opId') opId: string, @Body() dto: IniciarDto) {
    return this.ordens.iniciar(s, id, opId, dto);
  }

  @Post(':id/operacoes/:opId/parar')
  @HttpCode(200)
  parar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('opId') opId: string, @Body() dto: PararDto) {
    return this.ordens.parar(s, id, opId, dto);
  }

  @Post(':id/custos')
  incluirCusto(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: CustoOsDto) {
    return this.ordens.incluirCusto(s, id, dto);
  }

  @Patch(':id/custos/:custoId')
  atualizarCusto(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('custoId') custoId: string, @Body() dto: AtualizarCustoDto) {
    return this.ordens.atualizarCusto(s, id, custoId, dto);
  }

  @Delete(':id/custos/:custoId')
  removerCusto(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('custoId') custoId: string) {
    return this.ordens.removerCusto(s, id, custoId);
  }

  @Post(':id/pausar')
  @HttpCode(200)
  pausar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: PausarDto) {
    return this.ordens.pausar(s, id, dto);
  }

  @Post(':id/retomar')
  @HttpCode(200)
  retomar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.ordens.retomar(s, id);
  }

  @Post(':id/inspecao')
  @HttpCode(200)
  inspecao(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: InspecaoDto) {
    return this.ordens.inspecao(s, id, dto);
  }

  @Post(':id/entregar')
  @HttpCode(200)
  entregar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: EntregarDto) {
    return this.ordens.entregar(s, id, dto);
  }

  @Papeis('GESTOR', 'ADMIN')
  @Post(':id/cancelar')
  @HttpCode(200)
  cancelar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: CancelarDto) {
    return this.ordens.cancelar(s, id, dto.motivo);
  }
}

@ApiTags('ordens-servico')
@ApiBearerAuth()
@Controller()
export class ChaoDeFabricaController {
  constructor(private readonly ordens: OrdensService) {}

  @Post('orcamentos/:id/converter')
  converter(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: ConverterDto) {
    return this.ordens.converter(s, id, dto.prazo);
  }

  @Get('apontamentos/abertos')
  abertos(@SessaoAtual() s: Sessao, @Query('colaboradorId') colaboradorId?: string) {
    return this.ordens.apontamentosAbertos(s.tenantId, colaboradorId);
  }

  @Get('operador/fila')
  fila(@SessaoAtual() s: Sessao, @Query('colaboradorId') colaboradorId?: string) {
    return this.ordens.fila(s.tenantId, colaboradorId);
  }
}
