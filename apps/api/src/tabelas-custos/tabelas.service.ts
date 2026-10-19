import { Injectable } from '@nestjs/common';
import { TabelaCustos } from '@prisma/client';
import { calcularTabelaCustos, dec, soma, txt } from '@promec/motor';
import { conflito, ErroApi, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { buscarVigente, entradaDe, json, montarEntrada, resultadoDe } from './entrada';

const NOMES_STATUS = { RASCUNHO: 'rascunho', VIGENTE: 'vigente', ENCERRADA: 'encerrada' } as const;

@Injectable()
export class TabelasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const tabelas = await this.prisma.tabelaCustos.findMany({ where: { tenantId }, orderBy: [{ competencia: 'desc' }, { versao: 'desc' }] });
    return tabelas.map((t) => this.resumo(t));
  }

  async vigente(tenantId: string) {
    const t = await buscarVigente(this.prisma, tenantId);
    if (!t) throw semVigente();
    return this.detalhe(tenantId, t.id, t);
  }

  async detalhe(tenantId: string, id: string, carregada?: TabelaCustos) {
    const t = carregada ?? (await this.buscar(tenantId, id));
    const anterior = await this.anterior(t);
    return {
      ...this.resumo(t),
      entrada: entradaDe(t),
      resultado: resultadoDe(t),
      ...(anterior ? { comparativo: this.comparar(anterior, t) } : {})
    };
  }

  async criar(tenantId: string, competencia: string) {
    const t = await this.prisma.$transaction(async (tx) => {
      const ultima = await tx.tabelaCustos.findFirst({ where: { tenantId, competencia }, orderBy: { versao: 'desc' } });
      const entrada = await montarEntrada(tx, tenantId, competencia);
      return tx.tabelaCustos.create({
        data: {
          tenantId,
          competencia,
          versao: (ultima?.versao ?? 0) + 1,
          entrada: json(entrada),
          resultado: json(calcularTabelaCustos(entrada))
        }
      });
    });
    return this.detalhe(tenantId, t.id, t);
  }

  async recalcular(tenantId: string, id: string) {
    const t = await this.rascunho(tenantId, id, 'recalcular');
    const entrada = await montarEntrada(this.prisma, tenantId, t.competencia);
    const nova = await this.prisma.tabelaCustos.update({
      where: { id: t.id },
      data: { entrada: json(entrada), resultado: json(calcularTabelaCustos(entrada)) }
    });
    return this.detalhe(tenantId, id, nova);
  }

  async publicar(tenantId: string, id: string) {
    const t = await this.rascunho(tenantId, id, 'publicar');
    const { bloqueios } = resultadoDe(t);
    if (bloqueios.length) {
      throw conflito(
        'BLOQUEIOS',
        `Ainda há ${bloqueios.length === 1 ? 'um ponto que impede' : `${bloqueios.length} pontos que impedem`} a publicação: ${bloqueios[0].mensagem} Resolva nos cadastros, recalcule e publique de novo.`,
        bloqueios
      );
    }
    const agora = new Date();
    const publicada = await this.prisma.$transaction(async (tx) => {
      await tx.tabelaCustos.updateMany({ where: { tenantId, status: 'VIGENTE' }, data: { status: 'ENCERRADA', encerradaEm: agora } });
      return tx.tabelaCustos.update({ where: { id: t.id }, data: { status: 'VIGENTE', publicadaEm: agora, desatualizada: false } });
    });
    return this.detalhe(tenantId, id, publicada);
  }

  async remover(tenantId: string, id: string) {
    const t = await this.rascunho(tenantId, id, 'excluir');
    await this.prisma.tabelaCustos.delete({ where: { id: t.id } });
    return { id: t.id, removida: true };
  }

  private resumo(t: TabelaCustos) {
    const r = resultadoDe(t);
    const cheios = r.centros.map((c) => dec(c.cheioHora));
    return {
      id: t.id,
      competencia: t.competencia,
      versao: t.versao,
      status: t.status,
      desatualizada: t.desatualizada,
      publicadaEm: t.publicadaEm,
      criadaEm: t.criadaEm,
      resumo: {
        custoFixo: r.custoFixoTotal,
        centros: r.centros.length,
        cheioMedio: cheios.length ? txt(soma(cheios).div(cheios.length)) : '0',
        bloqueios: r.bloqueios.length
      }
    };
  }

  /** Vigente anterior: para rascunho é a vigente atual; para publicada é a última publicada antes dela. */
  private anterior(t: TabelaCustos) {
    if (t.status === 'RASCUNHO') return this.prisma.tabelaCustos.findFirst({ where: { tenantId: t.tenantId, status: 'VIGENTE' } });
    if (!t.publicadaEm) return null;
    return this.prisma.tabelaCustos.findFirst({
      where: { tenantId: t.tenantId, id: { not: t.id }, publicadaEm: { lt: t.publicadaEm } },
      orderBy: { publicadaEm: 'desc' }
    });
  }

  private comparar(anterior: TabelaCustos, atual: TabelaCustos) {
    const antes = new Map(resultadoDe(anterior).centros.map((c) => [c.id, c.cheioHora]));
    return resultadoDe(atual).centros.map((c) => {
      const a = antes.get(c.id);
      return {
        centroId: c.id,
        nome: c.nome,
        anterior: a ?? null,
        atual: c.cheioHora,
        variacao: a && !dec(a).isZero() ? txt(dec(c.cheioHora).div(a).minus(1)) : null
      };
    });
  }

  private async buscar(tenantId: string, id: string) {
    const t = await this.prisma.tabelaCustos.findFirst({ where: { id, tenantId } });
    if (!t) throw naoEncontrado('essa versão da Tabela de Custos');
    return t;
  }

  private async rascunho(tenantId: string, id: string, acao: string) {
    const t = await this.buscar(tenantId, id);
    if (t.status !== 'RASCUNHO') {
      throw conflito(
        'TABELA_IMUTAVEL',
        `Não dá para ${acao} a versão ${t.versao} de ${t.competencia} porque ela está ${NOMES_STATUS[t.status]}. Crie uma nova versão em rascunho para fazer ajustes.`
      );
    }
    return t;
  }
}

export const semVigente = (status = 404) =>
  new ErroApi(
    status,
    'SEM_VIGENTE',
    'Ainda não há Tabela de Custos vigente. Crie uma versão com os cadastros atuais e publique para os orçamentos terem de onde tirar o custo-hora.'
  );
