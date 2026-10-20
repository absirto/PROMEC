import { Module } from '@nestjs/common';
import { PlanejamentoController } from './planejamento.controller';
import { PlanejamentoService } from './planejamento.service';

@Module({ controllers: [PlanejamentoController], providers: [PlanejamentoService], exports: [PlanejamentoService] })
export class PlanejamentoModule {}
