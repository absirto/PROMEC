import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { competenciaAtual, RE_COMPETENCIA } from '../comum/decimal';
import { invalido } from '../comum/erros';
import { Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarLancamentoDto, CopiarDto, CriarLancamentoDto } from './custo-fixo.dto';
import { CustoFixoService } from './custo-fixo.service';

@ApiTags('custo-fixo')
@ApiBearerAuth()
@Controller('custo-fixo')
export class CustoFixoController {
  constructor(private readonly custoFixo: CustoFixoService) {}

  @Get('competencias')
  competencias(@SessaoAtual() s: Sessao) {
    return this.custoFixo.competencias(s.tenantId);
  }

  @Get()
  daCompetencia(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    if (competencia && !RE_COMPETENCIA.test(competencia)) throw invalido('A competência precisa estar no formato AAAA-MM, por exemplo 2026-10.');
    return this.custoFixo.daCompetencia(s.tenantId, competencia ?? competenciaAtual());
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: CriarLancamentoDto) {
    return this.custoFixo.criar(s.tenantId, dto);
  }

  @Post('copiar')
  copiar(@SessaoAtual() s: Sessao, @Body() dto: CopiarDto) {
    return this.custoFixo.copiar(s.tenantId, dto);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarLancamentoDto) {
    return this.custoFixo.atualizar(s.tenantId, id, dto);
  }

  @Delete(':id')
  remover(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.custoFixo.remover(s.tenantId, id);
  }
}
