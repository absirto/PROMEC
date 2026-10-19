import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Papeis, Sessao, SessaoAtual } from '../comum/sessao';
import { ParametrosDto } from './parametros.dto';
import { ParametrosService } from './parametros.service';

@ApiTags('parametros')
@ApiBearerAuth()
@Controller('parametros')
export class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  obter(@SessaoAtual() s: Sessao) {
    return this.parametros.obter(s.tenantId);
  }

  @Papeis('GESTOR', 'ADMIN')
  @Patch()
  atualizar(@SessaoAtual() s: Sessao, @Body() dto: ParametrosDto) {
    return this.parametros.atualizar(s.tenantId, dto);
  }
}
