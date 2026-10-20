import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarClienteDto, CriarClienteDto } from './clientes.dto';
import { ClientesService } from './clientes.service';

@ApiTags('clientes')
@ApiBearerAuth()
@Controller('clientes')
@Modulo('cadastros')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('q') q?: string, @Query('status') status?: string) {
    return this.clientes.listar(s.tenantId, q, status);
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: CriarClienteDto) {
    return this.clientes.criar(s.tenantId, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.clientes.detalhe(s.tenantId, id);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarClienteDto) {
    return this.clientes.atualizar(s, id, dto);
  }

  @Delete(':id')
  inativar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.clientes.inativar(s.tenantId, id);
  }
}
