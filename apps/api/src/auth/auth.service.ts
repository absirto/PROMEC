import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ErroApi, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { garantirPerfis, papelDoPerfil } from '../acesso/permissoes';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login({ email, senha }: LoginDto) {
    const encontrado = await this.prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!encontrado || !encontrado.ativo || !(await bcrypt.compare(senha, encontrado.senhaHash))) {
      throw new ErroApi(401, 'CREDENCIAIS', 'E-mail ou senha não conferem. Confira os dois e tente de novo; se esqueceu a senha, fale com o gestor da empresa.');
    }
    await garantirPerfis(this.prisma, encontrado.tenantId);
    const u = await this.prisma.usuario.update({ where: { id: encontrado.id }, data: { ultimoAcesso: new Date() }, include: { perfil: true } });
    const papel = papelDoPerfil(u.perfil!);
    const token = await this.jwt.signAsync({ sub: u.id, tenantId: u.tenantId, papel, nome: u.nome });
    return {
      token,
      trocarSenha: u.trocarSenha,
      usuario: { id: u.id, nome: u.nome, email: u.email, papel, perfil: { id: u.perfil!.id, nome: u.perfil!.nome }, permissoes: u.perfil!.permissoes, trocarSenha: u.trocarSenha }
    };
  }

  async me(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, include: { empresa: true, perfil: true } });
    if (!u || !u.perfil) throw naoEncontrado('seu usuário');
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      papel: papelDoPerfil(u.perfil),
      perfil: { id: u.perfil.id, nome: u.perfil.nome },
      permissoes: u.perfil.permissoes,
      trocarSenha: u.trocarSenha,
      colaboradorId: u.colaboradorId,
      empresa: { id: u.empresa.id, nome: u.empresa.nome }
    };
  }
}
