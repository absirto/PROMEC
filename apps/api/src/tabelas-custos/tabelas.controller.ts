import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import { CriarTabelaDto } from './tabelas.dto';
import { TabelasService } from './tabelas.service';

@ApiTags('tabelas-custos')
@ApiBearerAuth()
@Controller('tabelas-custos')
@Modulo('custos')
export class TabelasController {
  constructor(private readonly tabelas: TabelasService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao) {
    return this.tabelas.listar(s.tenantId);
  }

  @Get('vigente')
  vigente(@SessaoAtual() s: Sessao) {
    return this.tabelas.vigente(s.tenantId);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.tabelas.detalhe(s.tenantId, id);
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: CriarTabelaDto) {
    return this.tabelas.criar(s.tenantId, dto.competencia);
  }

  @Post(':id/recalcular')
  @HttpCode(200)
  recalcular(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.tabelas.recalcular(s.tenantId, id);
  }

  @Permissao('custo.publicar_tabela')
  @Post(':id/publicar')
  @HttpCode(200)
  publicar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.tabelas.publicar(s.tenantId, id);
  }

  @Delete(':id')
  remover(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.tabelas.remover(s.tenantId, id);
  }
}
