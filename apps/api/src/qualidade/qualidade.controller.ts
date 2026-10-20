import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarPlanoDto, DecidirGarantiaDto, EncerrarNcDto, GarantiaDto, NcDto, PlanoDto, TratarNcDto } from './qualidade.dto';
import { QualidadeService } from './qualidade.service';

@ApiTags('qualidade')
@ApiBearerAuth()
@Controller()
@Modulo('qualidade')
export class QualidadeController {
  constructor(private readonly qualidade: QualidadeService) {}

  @Get('qualidade/planos')
  planos(@SessaoAtual() s: Sessao) {
    return this.qualidade.planos(s.tenantId);
  }

  @Post('qualidade/planos')
  criarPlano(@SessaoAtual() s: Sessao, @Body() dto: PlanoDto) {
    return this.qualidade.criarPlano(s.tenantId, dto);
  }

  @Get('qualidade/planos/:id')
  plano(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.qualidade.plano(s.tenantId, id);
  }

  @Patch('qualidade/planos/:id')
  atualizarPlano(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarPlanoDto) {
    return this.qualidade.atualizarPlano(s.tenantId, id, dto);
  }

  @Get('qualidade/ncs')
  ncs(@SessaoAtual() s: Sessao, @Query('status') status?: string, @Query('origem') origem?: string, @Query('osId') osId?: string) {
    return this.qualidade.ncs(s.tenantId, { status, origem, osId });
  }

  @Post('qualidade/ncs')
  criarNc(@SessaoAtual() s: Sessao, @Body() dto: NcDto) {
    return this.qualidade.criarNc(s.tenantId, dto);
  }

  @Get('qualidade/ncs/:id')
  nc(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.qualidade.nc(s.tenantId, id);
  }

  @Patch('qualidade/ncs/:id')
  tratarNc(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: TratarNcDto) {
    return this.qualidade.tratarNc(s.tenantId, id, dto);
  }

  @Post('qualidade/ncs/:id/encerrar')
  @HttpCode(200)
  encerrarNc(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: EncerrarNcDto) {
    return this.qualidade.encerrarNc(s.tenantId, id, dto.eficaz);
  }

  @Get('qualidade/rastreabilidade')
  rastreabilidade(@SessaoAtual() s: Sessao, @Query('loteId') loteId?: string, @Query('osId') osId?: string) {
    return this.qualidade.rastreabilidade(s.tenantId, { loteId, osId });
  }

  @Get('qualidade/garantias')
  garantias(@SessaoAtual() s: Sessao, @Query('status') status?: string) {
    return this.qualidade.garantias(s.tenantId, status);
  }

  @Post('qualidade/garantias')
  abrirGarantia(@SessaoAtual() s: Sessao, @Body() dto: GarantiaDto) {
    return this.qualidade.abrirGarantia(s.tenantId, dto);
  }

  @Post('qualidade/garantias/:id/decidir')
  @HttpCode(200)
  decidir(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: DecidirGarantiaDto) {
    return this.qualidade.decidirGarantia(s, id, dto);
  }

  @Permissao('os.visualizar', 'qualidade.visualizar')
  @Get('ordens-servico/:id/laudo')
  laudo(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.qualidade.laudo(s.tenantId, id);
  }
}
