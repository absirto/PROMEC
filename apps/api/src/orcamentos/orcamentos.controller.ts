import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Permissao, Sessao, SessaoAtual } from '../comum/sessao';
import { LiberarMargemDto, OrcamentoDto, RecusarDto, SimularDto } from './orcamentos.dto';
import { OrcamentosService } from './orcamentos.service';

@ApiTags('orcamentos')
@ApiBearerAuth()
@Controller('orcamentos')
@Modulo('orcamentos')
export class OrcamentosController {
  constructor(private readonly orcamentos: OrcamentosService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('status') status?: string, @Query('q') q?: string) {
    return this.orcamentos.listar(s.tenantId, status, q);
  }

  @Post('simular')
  @HttpCode(200)
  simular(@SessaoAtual() s: Sessao, @Body() dto: SimularDto) {
    return this.orcamentos.simular(s.tenantId, dto);
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: OrcamentoDto) {
    return this.orcamentos.criar(s, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.orcamentos.detalhe(s.tenantId, id);
  }

  @Put(':id')
  substituir(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: OrcamentoDto) {
    return this.orcamentos.substituir(s, id, dto);
  }

  @Post(':id/enviar')
  @HttpCode(200)
  enviar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.orcamentos.enviar(s, id);
  }

  @Permissao('orcamento.aprovar_desconto')
  @Post(':id/liberar-margem')
  @HttpCode(200)
  liberarMargem(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: LiberarMargemDto) {
    return this.orcamentos.liberarMargem(s, id, dto.justificativa);
  }

  @Post(':id/negociar')
  @HttpCode(200)
  negociar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.orcamentos.negociar(s, id);
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  aprovar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.orcamentos.aprovar(s, id);
  }

  @Post(':id/recusar')
  @HttpCode(200)
  recusar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: RecusarDto) {
    return this.orcamentos.recusar(s, id, dto);
  }

  @Post(':id/atualizar-custos')
  @HttpCode(200)
  atualizarCustos(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.orcamentos.atualizarCustos(s, id);
  }
}
