import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AcessoController } from './acesso.controller';
import { AcessoService } from './acesso.service';
import { MascaraInterceptor } from './mascara.interceptor';

@Module({ controllers: [AcessoController], providers: [AcessoService, { provide: APP_INTERCEPTOR, useClass: MascaraInterceptor }] })
export class AcessoModule {}
