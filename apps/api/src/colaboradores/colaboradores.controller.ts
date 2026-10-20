import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarColaboradorDto, CriarColaboradorDto } from './colaboradores.dto';
import { ColaboradoresService } from './colaboradores.service';

@ApiTags('colaboradores')
@ApiBearerAuth()
@Controller('colaboradores')
@Modulo('cadastros', 'rh')
export class ColaboradoresController {
  constructor(private readonly colaboradores: ColaboradoresService) {}

  @Get()
  listar(@SessaoAtual() s: Sessao, @Query('q') q?: string, @Query('ativo') ativo?: string) {
    return this.colaboradores.listar(s.tenantId, q, ativo);
  }

  @Post()
  criar(@SessaoAtual() s: Sessao, @Body() dto: CriarColaboradorDto) {
    return this.colaboradores.criar(s, dto);
  }

  @Get(':id')
  detalhe(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.colaboradores.detalhe(s.tenantId, id);
  }

  @Patch(':id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarColaboradorDto) {
    return this.colaboradores.atualizar(s, id, dto);
  }

  @Delete(':id')
  inativar(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.colaboradores.inativar(s.tenantId, id);
  }
}
