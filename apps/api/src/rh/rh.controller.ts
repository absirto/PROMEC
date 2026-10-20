import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { hojeLocal } from '../planejamento/calendario';
import { Modulo, Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarAusenciaDto, AtualizarHabilitacaoDto, AusenciaDto, HabilitacaoDto } from './rh.dto';
import { RhService } from './rh.service';

@ApiTags('rh')
@ApiBearerAuth()
@Modulo('rh')
@Controller('rh')
export class RhController {
  constructor(private readonly rh: RhService) {}

  @Get('ausencias')
  ausencias(@SessaoAtual() s: Sessao, @Query('colaboradorId') colaboradorId?: string, @Query('de') de?: string, @Query('ate') ate?: string) {
    return this.rh.ausencias(s.tenantId, { colaboradorId, de, ate });
  }

  @Post('ausencias')
  criarAusencia(@SessaoAtual() s: Sessao, @Body() dto: AusenciaDto) {
    return this.rh.criarAusencia(s.tenantId, dto);
  }

  @Patch('ausencias/:id')
  atualizarAusencia(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarAusenciaDto) {
    return this.rh.atualizarAusencia(s.tenantId, id, dto);
  }

  @Delete('ausencias/:id')
  removerAusencia(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.rh.removerAusencia(s.tenantId, id);
  }

  @Get('habilitacoes/matriz')
  matriz(@SessaoAtual() s: Sessao) {
    return this.rh.matriz(s.tenantId);
  }

  @Get('habilitacoes')
  habilitacoes(@SessaoAtual() s: Sessao, @Query('vencendo') vencendo?: string) {
    return this.rh.habilitacoes(s.tenantId, vencendo);
  }

  @Post('habilitacoes')
  criarHabilitacao(@SessaoAtual() s: Sessao, @Body() dto: HabilitacaoDto) {
    return this.rh.criarHabilitacao(s.tenantId, dto);
  }

  @Patch('habilitacoes/:id')
  atualizarHabilitacao(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarHabilitacaoDto) {
    return this.rh.atualizarHabilitacao(s.tenantId, id, dto);
  }

  @Delete('habilitacoes/:id')
  removerHabilitacao(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.rh.removerHabilitacao(s.tenantId, id);
  }

  @Get('disponibilidade')
  disponibilidade(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    return this.rh.disponibilidade(s.tenantId, competencia ?? hojeLocal().slice(0, 7));
  }

  @Get('produtividade')
  produtividade(@SessaoAtual() s: Sessao, @Query('meses') meses?: string) {
    return this.rh.produtividade(s.tenantId, Math.min(12, Math.max(2, Number(meses) || 3)));
  }
}

@Module({ controllers: [RhController], providers: [RhService], exports: [RhService] })
export class RhModule {}
