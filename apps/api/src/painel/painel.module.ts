import { Module } from '@nestjs/common';
import { OrdensModule } from '../ordens/ordens.module';
import { PlanejamentoModule } from '../planejamento/planejamento.module';
import { PainelController } from './painel.controller';
import { PainelService } from './painel.service';

@Module({ imports: [OrdensModule, PlanejamentoModule], controllers: [PainelController], providers: [PainelService] })
export class PainelModule {}
