import { Module } from '@nestjs/common';
import { CustoFixoController } from './custo-fixo.controller';
import { CustoFixoService } from './custo-fixo.service';

@Module({ controllers: [CustoFixoController], providers: [CustoFixoService] })
export class CustoFixoModule {}
