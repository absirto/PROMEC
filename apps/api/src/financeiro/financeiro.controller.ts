import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { hojeLocal } from '../planejamento/calendario';
import { Modulo, Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import {
  AtualizarCentroCustoDto,
  AtualizarContaDto,
  AtualizarRecorrenciaDto,
  AtualizarTituloDto,
  BaixaDto,
  BaixaLoteDto,
  CentroCustoDto,
  CompetenciaDto,
  ContaDto,
  MotivoDto,
  RecorrenciaDto,
  RenegociarDto,
  TituloDto,
  TransferenciaDto
} from './financeiro.dto';
import { competenciaValida, FinanceiroService } from './financeiro.service';

@ApiTags('financeiro')
@ApiBearerAuth()
@Controller()
@Modulo('financeiro')
export class FinanceiroController {
  constructor(private readonly fin: FinanceiroService) {}

  @Get('financeiro/contas')
  contas(@SessaoAtual() s: Sessao) {
    return this.fin.contas(s.tenantId);
  }

  @Post('financeiro/contas')
  criarConta(@SessaoAtual() s: Sessao, @Body() dto: ContaDto) {
    return this.fin.criarConta(s.tenantId, dto);
  }

  @Patch('financeiro/contas/:id')
  atualizarConta(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarContaDto) {
    return this.fin.atualizarConta(s.tenantId, id, dto);
  }

  @Post('financeiro/transferencias')
  transferir(@SessaoAtual() s: Sessao, @Body() dto: TransferenciaDto) {
    return this.fin.transferir(s, dto);
  }

  @Get('financeiro/centros-custo')
  centrosCusto(@SessaoAtual() s: Sessao) {
    return this.fin.centrosCusto(s.tenantId);
  }

  @Post('financeiro/centros-custo')
  criarCentroCusto(@SessaoAtual() s: Sessao, @Body() dto: CentroCustoDto) {
    return this.fin.criarCentroCusto(s.tenantId, dto);
  }

  @Patch('financeiro/centros-custo/:id')
  atualizarCentroCusto(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarCentroCustoDto) {
    return this.fin.atualizarCentroCusto(s.tenantId, id, dto);
  }

  @Get('financeiro/titulos')
  titulos(
    @SessaoAtual() s: Sessao,
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('vencimentoDe') vencimentoDe?: string,
    @Query('vencimentoAte') vencimentoAte?: string,
    @Query('competencia') competencia?: string,
    @Query('pessoaId') pessoaId?: string,
    @Query('q') q?: string
  ) {
    return this.fin.titulos(s.tenantId, { tipo, status, vencimentoDe, vencimentoAte, competencia, pessoaId, q });
  }

  @Post('financeiro/titulos')
  criarTitulo(@SessaoAtual() s: Sessao, @Body() dto: TituloDto) {
    return this.fin.criarTitulo(s, dto);
  }

  @Get('financeiro/titulos/:id')
  titulo(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.fin.titulo(s.tenantId, id);
  }

  @Patch('financeiro/titulos/:id')
  atualizarTitulo(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarTituloDto) {
    return this.fin.atualizarTitulo(s, id, dto);
  }

  @Post('financeiro/titulos/:id/baixas')
  baixar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: BaixaDto) {
    return this.fin.baixar(s, id, dto);
  }

  @Post('financeiro/baixas-lote')
  baixarLote(@SessaoAtual() s: Sessao, @Body() dto: BaixaLoteDto) {
    return this.fin.baixarLote(s, dto);
  }

  @Permissao('financeiro.estornar')
  @Post('financeiro/titulos/:id/baixas/:baixaId/estornar')
  @HttpCode(200)
  estornar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('baixaId') baixaId: string, @Body() dto: MotivoDto) {
    return this.fin.estornar(s, id, baixaId, dto.motivo);
  }

  @Post('financeiro/titulos/:id/renegociar')
  @HttpCode(200)
  renegociar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: RenegociarDto) {
    return this.fin.renegociar(s, id, dto);
  }

  @Post('financeiro/titulos/:id/cancelar')
  @HttpCode(200)
  cancelar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: MotivoDto) {
    return this.fin.cancelar(s, id, dto.motivo);
  }

  @Get('financeiro/recorrencias')
  recorrencias(@SessaoAtual() s: Sessao) {
    return this.fin.recorrencias(s.tenantId);
  }

  @Post('financeiro/recorrencias')
  criarRecorrencia(@SessaoAtual() s: Sessao, @Body() dto: RecorrenciaDto) {
    return this.fin.criarRecorrencia(s.tenantId, dto);
  }

  @Post('financeiro/recorrencias/gerar')
  @HttpCode(200)
  gerar(@SessaoAtual() s: Sessao, @Body() dto: CompetenciaDto) {
    return this.fin.gerarRecorrencias(s, dto.competencia);
  }

  @Patch('financeiro/recorrencias/:id')
  atualizarRecorrencia(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarRecorrenciaDto) {
    return this.fin.atualizarRecorrencia(s.tenantId, id, dto);
  }

  @Post('financeiro/rotina')
  @HttpCode(200)
  rotina(@SessaoAtual() s: Sessao) {
    return this.fin.rotina(s.tenantId);
  }

  @Get('financeiro/comissoes')
  comissoes(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    return this.fin.comissoes(s.tenantId, competenciaValida(competencia ?? hojeLocal().slice(0, 7)));
  }

  @Post('financeiro/comissoes/fechar')
  @HttpCode(200)
  fecharComissoes(@SessaoAtual() s: Sessao, @Body() dto: CompetenciaDto) {
    return this.fin.fecharComissoes(s, dto.competencia);
  }

  @Get('financeiro/fluxo')
  fluxo(@SessaoAtual() s: Sessao, @Query('ate') ate?: string, @Query('agrupamento') agrupamento?: string) {
    const ag = agrupamento === 'dia' || agrupamento === 'mes' ? agrupamento : 'semana';
    return this.fin.fluxo(s.tenantId, ate, ag);
  }

  @Get('financeiro/dre')
  dre(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string, @Query('segmento') segmento?: string) {
    return this.fin.dre(s.tenantId, competenciaValida(competencia ?? hojeLocal().slice(0, 7)), segmento || undefined);
  }

  @Get('financeiro/custo-fixo-realizado')
  custoFixoRealizado(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    return this.fin.custoFixoRealizado(s.tenantId, competenciaValida(competencia ?? hojeLocal().slice(0, 7)));
  }

  @Permissao('custos.gerenciar')
  @Post('custo-fixo/importar-financeiro')
  @HttpCode(200)
  importar(@SessaoAtual() s: Sessao, @Body() dto: CompetenciaDto) {
    return this.fin.importarParaCustoFixo(s, dto.competencia);
  }

  @Permissao('custos.visualizar')
  @Get('centros-trabalho/:id/historico-custos')
  historicoCustos(@SessaoAtual() s: Sessao, @Param('id') id: string, @Query('meses') meses?: string) {
    return this.fin.historicoCustos(s.tenantId, id, Math.min(24, Math.max(1, Number(meses) || 6)));
  }
}
