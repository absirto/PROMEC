import { Module } from '@nestjs/common';
import { QualidadeController } from './qualidade.controller';
import { QualidadeService } from './qualidade.service';

@Module({ controllers: [QualidadeController], providers: [QualidadeService] })
export class QualidadeModule {}
