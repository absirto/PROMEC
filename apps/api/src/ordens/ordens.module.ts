import { Module } from '@nestjs/common';
import { ChaoDeFabricaController, OrdensController } from './ordens.controller';
import { OrdensService } from './ordens.service';

@Module({ controllers: [OrdensController, ChaoDeFabricaController], providers: [OrdensService], exports: [OrdensService] })
export class OrdensModule {}
