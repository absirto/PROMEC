import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Papeis, Sessao, SessaoAtual } from '../comum/sessao';
import { FeriadoDto, FilaDto, ParadaDto, PromessaDto } from './planejamento.dto';
import { PlanejamentoService } from './planejamento.service';

@ApiTags('planejamento')
@ApiBearerAuth()
@Controller()
export class PlanejamentoController {
  constructor(private readonly planejamento: PlanejamentoService) {}

  @Get('planejamento')
  obter(@SessaoAtual() s: Sessao, @Query('horizonte') horizonte?: string) {
    const h = Math.min(365, Math.max(7, Number(horizonte) || 60));
    return this.planejamento.planejamento(s.tenantId, h);
  }

  @Papeis('GESTOR', 'ADMIN', 'ORCAMENTISTA')
  @Put('planejamento/fila')
  definirFila(@SessaoAtual() s: Sessao, @Body() dto: FilaDto) {
    return this.planejamento.definirFila(s.tenantId, dto.ordem);
  }

  @Papeis('GESTOR', 'ADMIN', 'ORCAMENTISTA')
  @Delete('planejamento/fila')
  filaAutomatica(@SessaoAtual() s: Sessao) {
    return this.planejamento.filaAutomatica(s.tenantId);
  }

  @Post('planejamento/promessa')
  @HttpCode(200)
  promessa(@SessaoAtual() s: Sessao, @Body() dto: PromessaDto) {
    return this.planejamento.promessa(s.tenantId, dto);
  }

  @Get('feriados')
  feriados(@SessaoAtual() s: Sessao) {
    return this.planejamento.feriados(s.tenantId);
  }

  @Post('feriados')
  criarFeriado(@SessaoAtual() s: Sessao, @Body() dto: FeriadoDto) {
    return this.planejamento.criarFeriado(s.tenantId, dto);
  }

  @Delete('feriados/:id')
  removerFeriado(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.planejamento.removerFeriado(s.tenantId, id);
  }

  @Get('centros-trabalho/:id/paradas')
  paradas(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.planejamento.paradas(s.tenantId, id);
  }

  @Post('centros-trabalho/:id/paradas')
  criarParada(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: ParadaDto) {
    return this.planejamento.criarParada(s.tenantId, id, dto);
  }

  @Delete('centros-trabalho/:id/paradas/:paradaId')
  removerParada(@SessaoAtual() s: Sessao, @Param('id') id: string, @Param('paradaId') paradaId: string) {
    return this.planejamento.removerParada(s.tenantId, id, paradaId);
  }
}
