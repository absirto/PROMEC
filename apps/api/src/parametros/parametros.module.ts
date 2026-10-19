import { Global, Module } from '@nestjs/common';
import { ParametrosController } from './parametros.controller';
import { ParametrosService } from './parametros.service';

@Global()
@Module({ controllers: [ParametrosController], providers: [ParametrosService], exports: [ParametrosService] })
export class ParametrosModule {}
