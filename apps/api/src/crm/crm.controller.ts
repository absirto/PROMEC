import { Body, Controller, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import { AtividadeDto, AtualizarAtividadeDto, AtualizarOportunidadeDto, ConcluirAtividadeDto, MoverDto, OportunidadeDto, PerdaDto } from './crm.dto';
import { CrmService } from './crm.service';

@ApiTags('crm')
@ApiBearerAuth()
@Modulo('crm')
@Controller()
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('crm/oportunidades')
  oportunidades(@SessaoAtual() s: Sessao, @Query('etapa') etapa?: string, @Query('responsavelId') responsavelId?: string, @Query('q') q?: string) {
    return this.crm.oportunidades(s.tenantId, { etapa, responsavelId, q });
  }

  @Post('crm/oportunidades')
  criar(@SessaoAtual() s: Sessao, @Body() dto: OportunidadeDto) {
    return this.crm.criarOportunidade(s, dto);
  }

  @Get('crm/oportunidades/:id')
  oportunidade(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.crm.oportunidade(s.tenantId, id);
  }

  @Patch('crm/oportunidades/:id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarOportunidadeDto) {
    return this.crm.atualizarOportunidade(s.tenantId, id, dto);
  }

  @Post('crm/oportunidades/:id/mover')
  @HttpCode(200)
  mover(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: MoverDto) {
    return this.crm.mover(s.tenantId, id, dto.etapa);
  }

  @Post('crm/oportunidades/:id/perder')
  @HttpCode(200)
  perder(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: PerdaDto) {
    return this.crm.perder(s.tenantId, id, dto);
  }

  @Get('crm/atividades')
  atividades(
    @SessaoAtual() s: Sessao,
    @Query('responsavelId') responsavelId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('pendentes') pendentes?: string,
    @Query('clienteId') clienteId?: string
  ) {
    return this.crm.atividades(s.tenantId, { responsavelId, de, ate, pendentes, clienteId });
  }

  @Post('crm/atividades')
  criarAtividade(@SessaoAtual() s: Sessao, @Body() dto: AtividadeDto) {
    return this.crm.criarAtividade(s.tenantId, dto);
  }

  @Patch('crm/atividades/:id')
  atualizarAtividade(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarAtividadeDto) {
    return this.crm.atualizarAtividade(s.tenantId, id, dto);
  }

  @Post('crm/atividades/:id/concluir')
  @HttpCode(200)
  concluir(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: ConcluirAtividadeDto) {
    return this.crm.concluirAtividade(s.tenantId, id, dto);
  }

  @Get('crm/indicadores')
  indicadores(@SessaoAtual() s: Sessao, @Query('meses') meses?: string) {
    return this.crm.indicadores(s.tenantId, Math.min(36, Math.max(1, Number(meses) || 6)));
  }

  @Permissao('crm.visualizar', 'cadastros.visualizar')
  @Get('clientes/:id/ficha')
  ficha(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.crm.ficha(s.tenantId, id);
  }
}

@Module({ controllers: [CrmController], providers: [CrmService] })
export class CrmModule {}
