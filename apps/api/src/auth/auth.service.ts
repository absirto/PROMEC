import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ErroApi, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login({ email, senha }: LoginDto) {
    const u = await this.prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!u || !u.ativo || !(await bcrypt.compare(senha, u.senhaHash))) {
      throw new ErroApi(401, 'CREDENCIAIS', 'E-mail ou senha não conferem. Confira os dois e tente de novo; se esqueceu a senha, fale com o gestor da empresa.');
    }
    const token = await this.jwt.signAsync({ sub: u.id, tenantId: u.tenantId, papel: u.papel, nome: u.nome });
    return { token, usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel } };
  }

  async me(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, include: { empresa: true } });
    if (!u) throw naoEncontrado('seu usuário');
    return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, empresa: { id: u.empresa.id, nome: u.empresa.nome } };
  }
}
