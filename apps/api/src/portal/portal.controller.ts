import { Body, Controller, Get, HttpCode, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { Permissao, Publico, Sessao, SessaoAtual } from '../comum/sessao';
import { OrcamentosModule } from '../orcamentos/orcamentos.module';
import { OrdensModule } from '../ordens/ordens.module';
import { LimitePortalGuard } from './limite.guard';
import { PortalService } from './portal.service';

class AprovarDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsBoolean() aceite: boolean;
}

class AjusteDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsString() @IsNotEmpty() mensagem: string;
}

class AvaliacaoDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(10) nota: number;
  @IsOptional() @IsString() comentario?: string;
}

const ip = (req: Request) => String(req.ip ?? req.socket?.remoteAddress ?? '');
const agente = (req: Request) => String(req.headers['user-agent'] ?? '');

@ApiTags('portal')
@Publico()
@UseGuards(LimitePortalGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('orcamento/:token')
  orcamento(@Param('token') token: string) {
    return this.portal.verOrcamento(token);
  }

  @Post('orcamento/:token/aprovar')
  @HttpCode(200)
  aprovar(@Param('token') token: string, @Body() dto: AprovarDto, @Req() req: Request) {
    return this.portal.aprovar(token, dto, ip(req), agente(req));
  }

  @Post('orcamento/:token/ajuste')
  @HttpCode(200)
  ajuste(@Param('token') token: string, @Body() dto: AjusteDto) {
    return this.portal.ajuste(token, dto);
  }

  @Get('os/:token')
  os(@Param('token') token: string) {
    return this.portal.verOs(token);
  }

  @Post('os/:token/avaliacao')
  avaliar(@Param('token') token: string, @Body() dto: AvaliacaoDto, @Req() req: Request) {
    return this.portal.avaliar(token, dto, ip(req));
  }
}

@ApiTags('portal')
@ApiBearerAuth()
@Controller()
export class LinksPortalController {
  constructor(private readonly portal: PortalService) {}

  @Permissao('orcamentos.gerenciar')
  @Post('orcamentos/:id/link-portal')
  @HttpCode(200)
  orcamento(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.portal.linkOrcamento(s, id);
  }

  @Permissao('os.gerenciar')
  @Post('ordens-servico/:id/link-portal')
  @HttpCode(200)
  os(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.portal.linkOs(s, id);
  }
}

@Module({ imports: [OrcamentosModule, OrdensModule], controllers: [PortalController, LinksPortalController], providers: [PortalService, LimitePortalGuard] })
export class PortalModule {}
