import { Module } from '@nestjs/common';
import { TabelasController } from './tabelas.controller';
import { TabelasService } from './tabelas.service';

@Module({ controllers: [TabelasController], providers: [TabelasService], exports: [TabelasService] })
export class TabelasModule {}
