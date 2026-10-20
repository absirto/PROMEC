import { Module } from '@nestjs/common';
import { OrdensModule } from '../ordens/ordens.module';
import { PlanejamentoModule } from '../planejamento/planejamento.module';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { ManutencaoModule } from '../manutencao/manutencao.controller';
import { PainelController } from './painel.controller';
import { PainelService } from './painel.service';

@Module({ imports: [OrdensModule, PlanejamentoModule, FinanceiroModule, ManutencaoModule], controllers: [PainelController], providers: [PainelService] })
export class PainelModule {}
