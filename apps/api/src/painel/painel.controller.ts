import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, Sessao, SessaoAtual } from '../comum/sessao';
import { PainelService } from './painel.service';

@ApiTags('painel')
@ApiBearerAuth()
@Controller('painel')
@Modulo('painel')
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  obter(@SessaoAtual() s: Sessao) {
    return this.painel.painel(s);
  }
}
