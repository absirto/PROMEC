import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import { OrdensModule } from '../ordens/ordens.module';
import { hojeLocal } from '../planejamento/calendario';
import { AceitarPropostaDto, AtualizarOrdemDto, AtualizarPlanoDto, CancelarOrdemDto, ConcluirOrdemDto, CustoOrdemDto, OrdemDto, PlanoDto, QuebraDto } from './manutencao.dto';
import { ManutencaoService } from './manutencao.service';

@ApiTags('manutencao')
@ApiBearerAuth()
@Modulo('manutencao')
@Controller('manutencao')
export class ManutencaoController {
  constructor(private readonly m: ManutencaoService) {}

  @Get('planos')
  planos(@SessaoAtual() s: Sessao, @Query('centroId') centroId?: string) {
    return this.m.planos(s.tenantId, centroId);
  }

  @Post('planos')
  criarPlano(@SessaoAtual() s: Sessao, @Body() dto: PlanoDto) {
    return this.m.criarPlano(s.tenantId, dto);
  }

  @Patch('planos/:id')
  atualizarPlano(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarPlanoDto) {
    return this.m.atualizarPlano(s.tenantId, id, dto);
  }

  @Get('ordens')
  ordens(@SessaoAtual() s: Sessao, @Query('status') status?: string, @Query('centroId') centroId?: string, @Query('tipo') tipo?: string) {
    return this.m.listarOrdens(s.tenantId, { status, centroId, tipo });
  }

  @Post('ordens')
  criarOrdem(@SessaoAtual() s: Sessao, @Body() dto: OrdemDto) {
    return this.m.criarOrdem(s.tenantId, dto);
  }

  @Get('ordens/:id')
  ordem(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.m.ordem(s.tenantId, id);
  }

  @Patch('ordens/:id')
  atualizarOrdem(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarOrdemDto) {
    return this.m.atualizarOrdem(s.tenantId, id, dto);
  }

  @Post('ordens/:id/iniciar')
  @HttpCode(200)
  iniciar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.m.iniciar(s.tenantId, id);
  }

  @Post('ordens/:id/concluir')
  @HttpCode(200)
  concluir(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: ConcluirOrdemDto) {
    return this.m.concluir(s.tenantId, id, dto);
  }

  @Post('ordens/:id/cancelar')
  @HttpCode(200)
  cancelar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: CancelarOrdemDto) {
    return this.m.cancelar(s.tenantId, id, dto.motivo);
  }

  @Post('ordens/:id/custos')
  incluirCusto(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: CustoOrdemDto) {
    return this.m.incluirCusto(s, id, dto);
  }

  @Delete('ordens/:id/custos/:custoId')
  removerCusto(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('custoId') custoId: string) {
    return this.m.removerCusto(s, id, custoId);
  }

  @Post('quebras')
  quebra(@SessaoAtual() s: Sessao, @Body() dto: QuebraDto) {
    return this.m.quebra(s, dto);
  }

  @Get('indicadores')
  indicadores(@SessaoAtual() s: Sessao, @Query('centroId') centroId?: string, @Query('meses') meses?: string) {
    return this.m.indicadores(s.tenantId, centroId, Math.min(24, Math.max(1, Number(meses) || 6)));
  }

  @Permissao('manutencao.visualizar', 'custos.visualizar')
  @Get('proposta')
  proposta(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    return this.m.proposta(s.tenantId, competencia ?? hojeLocal().slice(0, 7));
  }

  @Permissao('custos.gerenciar')
  @Post('proposta/aceitar')
  @HttpCode(200)
  aceitar(@SessaoAtual() s: Sessao, @Body() dto: AceitarPropostaDto) {
    return this.m.aceitarProposta(s.tenantId, dto);
  }
}

@Module({ imports: [OrdensModule], controllers: [ManutencaoController], providers: [ManutencaoService], exports: [ManutencaoService] })
export class ManutencaoModule {}
