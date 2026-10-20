import { Module } from '@nestjs/common';
import { SuprimentosModule } from '../suprimentos/suprimentos.module';
import { ChaoDeFabricaController, OrdensController } from './ordens.controller';
import { OrdensService } from './ordens.service';

@Module({ imports: [SuprimentosModule], controllers: [OrdensController, ChaoDeFabricaController], providers: [OrdensService], exports: [OrdensService] })
export class OrdensModule {}
