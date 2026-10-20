import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Modulo, SemPermissao, Sessao, SessaoAtual } from '../comum/sessao';
import { AtualizarPerfilDto, AtualizarUsuarioDto, PerfilDto, TrocarSenhaDto, UsuarioDto } from './acesso.dto';
import { AcessoService } from './acesso.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@Modulo('usuarios')
@Controller()
export class AcessoController {
  constructor(private readonly acesso: AcessoService) {}

  @Get('usuarios')
  usuarios(@SessaoAtual() s: Sessao, @Query('q') q?: string, @Query('ativo') ativo?: string) {
    return this.acesso.usuarios(s.tenantId, q, ativo);
  }

  @SemPermissao()
  @Get('usuarios/opcoes')
  opcoes(@SessaoAtual() s: Sessao) {
    return this.acesso.opcoes(s.tenantId);
  }

  @Post('usuarios')
  criar(@SessaoAtual() s: Sessao, @Body() dto: UsuarioDto) {
    return this.acesso.criarUsuario(s.tenantId, dto);
  }

  @Get('usuarios/:id')
  usuario(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.acesso.usuario(s.tenantId, id);
  }

  @Patch('usuarios/:id')
  atualizar(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarUsuarioDto) {
    return this.acesso.atualizarUsuario(s, id, dto);
  }

  @Post('usuarios/:id/redefinir-senha')
  @HttpCode(200)
  redefinir(@SessaoAtual() s: Sessao, @Param('id') id: string) {
    return this.acesso.redefinirSenha(s.tenantId, id);
  }

  @SemPermissao()
  @Post('auth/trocar-senha')
  @HttpCode(200)
  trocarSenha(@SessaoAtual() s: Sessao, @Body() dto: TrocarSenhaDto) {
    return this.acesso.trocarSenha(s, dto);
  }

  @Get('perfis')
  perfis(@SessaoAtual() s: Sessao) {
    return this.acesso.perfis(s.tenantId);
  }

  @Post('perfis')
  criarPerfil(@SessaoAtual() s: Sessao, @Body() dto: PerfilDto) {
    return this.acesso.criarPerfil(s.tenantId, dto);
  }

  @Patch('perfis/:id')
  atualizarPerfil(@SessaoAtual() s: Sessao, @Param('id') id: string, @Body() dto: AtualizarPerfilDto) {
    return this.acesso.atualizarPerfil(s.tenantId, id, dto);
  }

  @SemPermissao()
  @Get('permissoes')
  permissoes() {
    return this.acesso.permissoes();
  }
}

