import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Perfil, Usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { conflito, invalido, naoEncontrado, regra } from '../comum/erros';
import { Sessao } from '../comum/sessao';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarPerfilDto, AtualizarUsuarioDto, PerfilDto, TrocarSenhaDto, UsuarioDto } from './acesso.dto';
import { CATALOGO, garantirPerfis, papelDoPerfil, TODAS } from './permissoes';

const SENHA_FORTE = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{10,}$/;

/** Senha provisória legível: sem caracteres ambíguos, com maiúscula, minúscula e número. */
export function senhaProvisoria() {
  const pick = (s: string) => s[randomInt(s.length)];
  const base = [pick('ABCDEFGHJKLMNPQRSTUVWXYZ'), pick('abcdefghijkmnpqrstuvwxyz'), pick('23456789')];
  while (base.length < 12) base.push(pick('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'));
  return base.sort(() => randomInt(3) - 1).join('');
}

@Injectable()
export class AcessoService {
  constructor(private readonly prisma: PrismaService) {}

  async usuarios(tenantId: string, q?: string, ativo?: string) {
    await garantirPerfis(this.prisma, tenantId);
    const termo = q?.trim();
    const us = await this.prisma.usuario.findMany({
      where: {
        tenantId,
        ...(ativo === 'true' || ativo === 'false' ? { ativo: ativo === 'true' } : {}),
        ...(termo ? { OR: [{ nome: { contains: termo, mode: 'insensitive' } }, { email: { contains: termo, mode: 'insensitive' } }] } : {})
      },
      include: { perfil: true },
      orderBy: { nome: 'asc' }
    });
    return { itens: us.map(saidaUsuario), total: us.length };
  }

  async opcoes(tenantId: string) {
    const us = await this.prisma.usuario.findMany({ where: { tenantId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } });
    return us;
  }

  async usuario(tenantId: string, id: string) {
    return saidaUsuario(await this.buscar(tenantId, id));
  }

  async criarUsuario(tenantId: string, dto: UsuarioDto) {
    const perfil = await this.perfil(tenantId, dto.perfilId);
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw conflito('EMAIL_DUPLICADO', 'Esse e-mail já é usado por outro acesso. Use outro e-mail ou reative o usuário existente.');
    }
    if (dto.colaboradorId) await this.colaborador(tenantId, dto.colaboradorId);
    const senha = senhaProvisoria();
    const u = await this.prisma.usuario.create({
      data: {
        tenantId,
        nome: dto.nome.trim(),
        email,
        senhaHash: await bcrypt.hash(senha, 10),
        papel: papelDoPerfil(perfil),
        perfilId: perfil.id,
        colaboradorId: dto.colaboradorId ?? null,
        telefone: dto.telefone ?? null,
        trocarSenha: true
      },
      include: { perfil: true }
    });
    return { ...saidaUsuario(u), senhaProvisoria: senha };
  }

  async atualizarUsuario(s: Sessao, id: string, dto: AtualizarUsuarioDto) {
    const u = await this.buscar(s.tenantId, id);
    const perfil = dto.perfilId ? await this.perfil(s.tenantId, dto.perfilId) : null;
    if (u.id === s.id && (dto.ativo === false || (perfil && !perfil.permissoes.includes('usuarios.gerenciar')))) {
      throw regra('AUTO_BLOQUEIO', 'Você não pode desativar o próprio acesso nem tirar de si a gestão de usuários. Peça a outro administrador.');
    }
    if (dto.colaboradorId) await this.colaborador(s.tenantId, dto.colaboradorId);
    const novo = await this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome?.trim(),
        ativo: dto.ativo,
        telefone: dto.telefone,
        colaboradorId: dto.colaboradorId,
        ...(perfil ? { perfilId: perfil.id, papel: papelDoPerfil(perfil) } : {})
      },
      include: { perfil: true }
    });
    return saidaUsuario(novo);
  }

  async redefinirSenha(tenantId: string, id: string) {
    await this.buscar(tenantId, id);
    const senha = senhaProvisoria();
    const u = await this.prisma.usuario.update({ where: { id }, data: { senhaHash: await bcrypt.hash(senha, 10), trocarSenha: true }, include: { perfil: true } });
    return { ...saidaUsuario(u), senhaProvisoria: senha };
  }

  async trocarSenha(s: Sessao, dto: TrocarSenhaDto) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: s.id } });
    if (!(await bcrypt.compare(dto.senhaAtual, u.senhaHash))) {
      throw regra('SENHA_ATUAL_INCORRETA', 'A senha atual não confere. Digite de novo a senha com que você entrou.');
    }
    if (!SENHA_FORTE.test(dto.novaSenha)) {
      throw regra('SENHA_FRACA', 'A nova senha precisa ter pelo menos 10 caracteres, com número, letra maiúscula e minúscula. Escolha uma senha mais forte.');
    }
    if (dto.novaSenha === dto.senhaAtual) throw regra('SENHA_FRACA', 'A nova senha precisa ser diferente da atual.');
    await this.prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(dto.novaSenha, 10), trocarSenha: false } });
    return { ok: true, trocarSenha: false };
  }

  async perfis(tenantId: string) {
    await garantirPerfis(this.prisma, tenantId);
    const ps = await this.prisma.perfil.findMany({ where: { tenantId }, include: { _count: { select: { usuarios: true } } }, orderBy: [{ padrao: 'desc' }, { criadoEm: 'asc' }] });
    return ps.map((p) => ({ id: p.id, nome: p.nome, padrao: p.padrao, permissoes: p.permissoes, usuarios: p._count.usuarios }));
  }

  async criarPerfil(tenantId: string, dto: PerfilDto) {
    const permissoes = this.conferirPermissoes(dto.permissoes);
    if (await this.prisma.perfil.findFirst({ where: { tenantId, nome: dto.nome.trim() } })) throw conflito('PERFIL_DUPLICADO', `Já existe um perfil chamado ${dto.nome.trim()}.`);
    const p = await this.prisma.perfil.create({ data: { tenantId, nome: dto.nome.trim(), permissoes } });
    return (await this.perfis(tenantId)).find((x) => x.id === p.id);
  }

  async atualizarPerfil(tenantId: string, id: string, dto: AtualizarPerfilDto) {
    const p = await this.perfil(tenantId, id);
    if (p.padrao && dto.nome && dto.nome.trim() !== p.nome) {
      throw regra('PERFIL_PADRAO', `${p.nome} é um perfil padrão e não muda de nome. Crie um perfil novo se precisar de outro nome.`);
    }
    const permissoes = dto.permissoes ? this.conferirPermissoes(dto.permissoes) : undefined;
    await this.prisma.perfil.update({ where: { id }, data: { nome: dto.nome?.trim(), permissoes } });
    return (await this.perfis(tenantId)).find((x) => x.id === id);
  }

  permissoes() {
    return CATALOGO;
  }

  private conferirPermissoes(ps: string[]) {
    const desconhecida = ps.find((p) => !TODAS.includes(p));
    if (desconhecida) throw invalido(`A permissão ${desconhecida} não existe. Escolha pelo catálogo de permissões.`, [{ campo: 'permissoes', mensagem: `${desconhecida} desconhecida` }]);
    return [...new Set(ps)];
  }

  private async perfil(tenantId: string, id: string) {
    const p = await this.prisma.perfil.findFirst({ where: { id, tenantId } });
    if (!p) throw naoEncontrado('esse perfil');
    return p;
  }

  private async colaborador(tenantId: string, id: string) {
    if (!(await this.prisma.colaborador.findFirst({ where: { id, tenantId } }))) throw naoEncontrado('esse colaborador');
  }

  private async buscar(tenantId: string, id: string) {
    const u = await this.prisma.usuario.findFirst({ where: { id, tenantId }, include: { perfil: true } });
    if (!u) throw naoEncontrado('esse usuário');
    return u;
  }
}

function saidaUsuario(u: Usuario & { perfil: Perfil | null }) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil ? { id: u.perfil.id, nome: u.perfil.nome } : null,
    ativo: u.ativo,
    ultimoAcesso: u.ultimoAcesso,
    colaboradorId: u.colaboradorId,
    telefone: u.telefone,
    trocarSenha: u.trocarSenha
  };
}
