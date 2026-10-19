import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RE_COMPETENCIA } from '../comum/decimal';
import { invalido } from '../comum/erros';
import { Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarCentroDto, CriarCentroDto } from './centros.dto';
import { CentrosService } from './centros.service';

@ApiTags('centros-trabalho')
@ApiBearerAuth()
@Controller('centros-trabalho')
export class CentrosController {
  constructor(private readonly centros: CentrosService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('q') q?: string, @Query('status') status?: string) {
    return this.centros.listar(s.tenantId, q, status);
  }

  @Get('previa')
  previa(@SessaoAtual() s: Sessao, @Query('competencia') competencia?: string) {
    if (competencia && !RE_COMPETENCIA.test(competencia)) throw invalido('A competência precisa estar no formato AAAA-MM, por exemplo 2026-10.');
    return this.centros.previa(s.tenantId, competencia);
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: CriarCentroDto) {
    return this.centros.criar(s.tenantId, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.centros.detalhe(s.tenantId, id);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarCentroDto) {
    return this.centros.atualizar(s.tenantId, id, dto);
  }

  @Delete(':id')
  desativar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.centros.desativar(s.tenantId, id);
  }
}
