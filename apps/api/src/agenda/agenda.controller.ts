import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Sessao, SessaoAtual } from '../comum/sessao';
import { AgendamentoDto, AtualizarAgendamentoDto, ChegouDto } from './agenda.dto';
import { AgendaService } from './agenda.service';

@ApiTags('agendamentos')
@ApiBearerAuth()
@Controller('agendamentos')
@Modulo('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('de') de?: string, @Query('ate') ate?: string, @Query('centroId') centroId?: string) {
    return this.agenda.listar(s.tenantId, { de, ate, centroId });
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: AgendamentoDto) {
    return this.agenda.criar(s.tenantId, dto);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarAgendamentoDto) {
    return this.agenda.atualizar(s.tenantId, id, dto);
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  confirmar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.agenda.mudar(s.tenantId, id, 'CONFIRMADO');
  }

  @Post(':id/chegou')
  @HttpCode(200)
  chegou(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: ChegouDto) {
    return this.agenda.chegou(s, id, dto.abrirOs);
  }

  @Post(':id/nao-veio')
  @HttpCode(200)
  naoVeio(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.agenda.mudar(s.tenantId, id, 'NAO_VEIO');
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  cancelar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.agenda.mudar(s.tenantId, id, 'CANCELADO');
  }
}
