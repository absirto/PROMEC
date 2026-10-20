import { Injectable } from '@nestjs/common';
import { arredondar, planejar, type LinhaOrcamento } from '@promec/motor';
import { conflito, invalido, naoEncontrado } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { dataBanco, segundaDa, somarDias, textoData } from './calendario';
import { calcularPromessa, montarPlanejamento, roteiroDoOrcamento, STATUS_PLANEJAVEIS } from './entrada';
import { FeriadoDto, ParadaDto, PromessaDto } from './planejamento.dto';

@Injectable()
export class PlanejamentoService {
  constructor(private readonly prisma: PrismaService) {}

  async planejamento(tenantId: string, horizonte = 60) {
    const { entrada, referencias, operacoes, centros } = await montarPlanejamento(this.prisma, tenantId, { horizonte });
    const r = planejar(entrada);
    const tipo = new Map(centros.map((c) => [c.id, c.tipo]));
    const filaManual = entrada.ordens.some((o) => o.posicao != null);
    return {
      hoje: entrada.hoje,
      ordens: r.ordens.map((o) => ({
        ...o,
        ref: referencias.get(o.id)!,
        operacoes: o.operacoes.map((op) => ({ ...op, ...(operacoes.get(op.id) ?? { descricao: '', centroNome: '' }) }))
      })),
      centros: r.centros.map((c) => ({ ...c, tipo: tipo.get(c.id) })),
      semDestino: r.semDestino,
      alertas: r.alertas.map((a) => (a.ordemId && referencias.has(a.ordemId) ? { ...a, mensagem: `${referencias.get(a.ordemId)!.numero}: ${a.mensagem}` } : a)),
      filaManual
    };
  }

  async definirFila(tenantId: string, ordem: string[]) {
    if (new Set(ordem).size !== ordem.length) throw invalido('A mesma OS aparece duas vezes na fila. Deixe cada uma uma vez só.');
    const ordens = await this.prisma.ordemServico.findMany({ where: { tenantId, id: { in: ordem } }, select: { id: true, numero: true, status: true } });
    if (ordens.length !== ordem.length) throw naoEncontrado('uma das OS da fila');
    const fora = ordens.find((o) => !(STATUS_PLANEJAVEIS as readonly string[]).includes(o.status));
    if (fora) throw conflito('OS_FORA_DA_FILA', `${fora.numero} não está mais na fila de produção. Atualize a tela e arraste de novo.`);
    await this.prisma.$transaction([
      this.prisma.ordemServico.updateMany({ where: { tenantId, posicaoFila: { not: null } }, data: { posicaoFila: null } }),
      ...ordem.map((id, i) => this.prisma.ordemServico.update({ where: { id }, data: { posicaoFila: i + 1 } }))
    ]);
    return this.planejamento(tenantId);
  }

  async filaAutomatica(tenantId: string) {
    await this.prisma.ordemServico.updateMany({ where: { tenantId, posicaoFila: { not: null } }, data: { posicaoFila: null } });
    return this.planejamento(tenantId);
  }

  async promessa(tenantId: string, dto: PromessaDto) {
    if (dto.orcamentoId) {
      const o = await this.prisma.orcamento.findFirst({ where: { id: dto.orcamentoId, tenantId } });
      if (!o) throw naoEncontrado('esse orçamento');
      return calcularPromessa(this.prisma, tenantId, roteiroDoOrcamento(o.linhas as unknown as LinhaOrcamento[], o.lote), o.id);
    }
    if (!dto.operacoes?.length) throw invalido('Informe o orçamento ou as operações (centro e horas) para calcular o prazo.');
    const centros = await this.prisma.centroTrabalho.count({ where: { tenantId, id: { in: dto.operacoes.map((o) => o.centroId) } } });
    if (centros !== new Set(dto.operacoes.map((o) => o.centroId)).size) throw naoEncontrado('um dos centros de trabalho');
    return calcularPromessa(
      this.prisma,
      tenantId,
      dto.operacoes.map((o, i) => ({ centroId: o.centroId, sequencia: (i + 1) * 10, horasRestantes: String(o.horas) }))
    );
  }

  /** Ocupação da semana atual e da próxima, e alertas do planejamento, para o painel. */
  async resumoPainel(tenantId: string) {
    const p = await this.planejamento(tenantId, 28);
    const atual = segundaDa(p.hoje);
    const proxima = somarDias(atual, 7);
    const ocupacao = (c: (typeof p.centros)[number], s: string) => arredondar(c.semanas.find((x) => x.inicio === s)?.ocupacao ?? '0', 4);
    return {
      ocupacao: p.centros.map((c) => ({ centroId: c.id, nome: c.nome, semanaAtual: ocupacao(c, atual), proximaSemana: ocupacao(c, proxima) })),
      alertas: p.alertas
        .filter((a) => a.tipo === 'sobrecarga' || !p.ordens.find((o) => o.id === a.ordemId)?.provisoria)
        .map((a) => ({ tipo: a.tipo === 'atraso' ? ('perigo' as const) : ('atencao' as const), mensagem: a.mensagem, link: '/planejamento' }))
    };
  }

  async feriados(tenantId: string) {
    const fs = await this.prisma.feriado.findMany({ where: { tenantId }, orderBy: { data: 'asc' } });
    return fs.map((f) => ({ id: f.id, data: textoData(f.data), descricao: f.descricao }));
  }

  async criarFeriado(tenantId: string, dto: FeriadoDto) {
    const data = dataBanco(dto.data);
    const existe = await this.prisma.feriado.findFirst({ where: { tenantId, data } });
    if (existe) throw conflito('FERIADO_DUPLICADO', `${textoData(data).split('-').reverse().join('/')} já está cadastrado como ${existe.descricao}.`);
    const f = await this.prisma.feriado.create({ data: { tenantId, data, descricao: dto.descricao.trim() } });
    return { id: f.id, data: textoData(f.data), descricao: f.descricao };
  }

  async removerFeriado(tenantId: string, id: string) {
    const f = await this.prisma.feriado.findFirst({ where: { id, tenantId } });
    if (!f) throw naoEncontrado('esse feriado');
    await this.prisma.feriado.delete({ where: { id } });
    return { id, removido: true };
  }

  async paradas(tenantId: string, centroId: string) {
    await this.centro(tenantId, centroId);
    const ps = await this.prisma.paradaCentro.findMany({ where: { tenantId, centroId }, orderBy: { inicio: 'asc' } });
    return ps.map(saidaParada);
  }

  async criarParada(tenantId: string, centroId: string, dto: ParadaDto) {
    const c = await this.centro(tenantId, centroId);
    if (dto.fim.slice(0, 10) < dto.inicio.slice(0, 10)) throw invalido('O fim da parada precisa ser no mesmo dia ou depois do início.');
    const p = await this.prisma.paradaCentro.create({
      data: { tenantId, centroId, inicio: dataBanco(dto.inicio), fim: dataBanco(dto.fim), motivo: dto.motivo.trim() }
    });
    const equivalentes = await this.prisma.centroTrabalho.findMany({
      where: { tenantId, tipo: c.tipo, id: { not: c.id }, status: 'ativo' },
      select: { id: true, codigo: true, nome: true },
      orderBy: { codigo: 'asc' }
    });
    return { ...saidaParada(p), sugestoes: equivalentes };
  }

  async removerParada(tenantId: string, centroId: string, paradaId: string) {
    const p = await this.prisma.paradaCentro.findFirst({ where: { id: paradaId, centroId, tenantId } });
    if (!p) throw naoEncontrado('essa parada');
    await this.prisma.paradaCentro.delete({ where: { id: paradaId } });
    return { id: paradaId, removida: true };
  }

  private async centro(tenantId: string, id: string) {
    const c = await this.prisma.centroTrabalho.findFirst({ where: { id, tenantId } });
    if (!c) throw naoEncontrado('esse centro de trabalho');
    return c;
  }
}

const saidaParada = (p: { id: string; inicio: Date; fim: Date; motivo: string }) => ({
  id: p.id,
  inicio: textoData(p.inicio),
  fim: textoData(p.fim),
  motivo: p.motivo
});
