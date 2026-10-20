import { Injectable } from '@nestjs/common';
import { Parametros } from '@prisma/client';
import { pd, pdOpc, pct, tt } from '../comum/decimal';
import { regra } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import { marcarDesatualizada } from '../tabelas-custos/entrada';
import { prazosDe } from '../financeiro/financeiro-core';
import { ENCARGOS_PADRAO } from '../rh/rh-core';
import { ParametrosDto } from './parametros.dto';

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Parâmetros do tenant, criando os padrões na primeira leitura. */
  carregar(tenantId: string) {
    return this.prisma.parametros.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
  }

  async obter(tenantId: string) {
    const [p, empresa] = await Promise.all([this.carregar(tenantId), this.prisma.empresa.findUniqueOrThrow({ where: { id: tenantId } })]);
    return this.saida(p, empresa.nome);
  }

  async atualizar(tenantId: string, dto: ParametrosDto) {
    const atual = await this.carregar(tenantId);
    const alvo = dto.margemAlvo !== undefined ? pd(dto.margemAlvo) : atual.margemAlvo;
    const minima = dto.margemMinima !== undefined ? pd(dto.margemMinima) : atual.margemMinima;
    if (minima.gt(alvo)) {
      throw regra(
        'MARGEM_MINIMA_MAIOR',
        `A margem mínima (${pct(minima.toFixed())}) ficou acima da margem alvo (${pct(alvo.toFixed())}). Ajuste uma das duas para a mínima ser o piso da alvo.`
      );
    }
    if (dto.condicaoPadrao) prazosDe(dto.condicaoPadrao);
    const encargos = dto.encargosPorVinculo ? { ...ENCARGOS_PADRAO, ...(atual.encargosPorVinculo as Record<string, string>), ...dto.encargosPorVinculo } : undefined;
    if (encargos && Object.entries(encargos).some(([k, v]) => !['CLT', 'PJ', 'HORISTA', 'SOCIO'].includes(k) || !/^\d+(\.\d+)?$/.test(String(v)) || Number(v) > 1)) {
      throw regra('ENCARGOS_INVALIDOS', 'Informe os encargos por vínculo (CLT, PJ, HORISTA, SOCIO) como fração de 0 a 1, por exemplo 0.64.');
    }
    const [p, empresa] = await this.prisma.$transaction(async (tx) => {
      const p = await tx.parametros.update({
        where: { tenantId },
        data: {
          criterioRateio: dto.criterioRateio,
          metodoPreco: dto.metodoPreco,
          impostosPadrao: pdOpc(dto.impostosPadrao),
          comissaoPadrao: pdOpc(dto.comissaoPadrao),
          margemAlvo: alvo,
          margemMinima: minima,
          validadeOrcamentoDias: dto.validadeOrcamentoDias,
          limiteServicoRapido: pdOpc(dto.limiteServicoRapido),
          limiteAprovacaoCompra: pdOpc(dto.limiteAprovacaoCompra),
          garantiaDias: dto.garantiaDias,
          multaAtraso: pdOpc(dto.multaAtraso),
          jurosMes: pdOpc(dto.jurosMes),
          toleranciaCustoFixo: pdOpc(dto.toleranciaCustoFixo),
          diasBloqueioInadimplencia: dto.diasBloqueioInadimplencia,
          condicaoPadrao: dto.condicaoPadrao?.trim(),
          ...(encargos ? { encargosPorVinculo: Object.fromEntries(Object.entries(encargos).map(([k, v]) => [k, String(v)])) } : {})
        }
      });
      const empresa = dto.nomeEmpresa
        ? await tx.empresa.update({ where: { id: tenantId }, data: { nome: dto.nomeEmpresa.trim() } })
        : await tx.empresa.findUniqueOrThrow({ where: { id: tenantId } });
      if (dto.criterioRateio && dto.criterioRateio !== atual.criterioRateio) await marcarDesatualizada(tx, tenantId);
      return [p, empresa] as const;
    });
    return this.saida(p, empresa.nome);
  }

  private saida(p: Parametros, nomeEmpresa: string) {
    return {
      nomeEmpresa,
      criterioRateio: p.criterioRateio,
      metodoPreco: p.metodoPreco,
      impostosPadrao: tt(p.impostosPadrao),
      comissaoPadrao: tt(p.comissaoPadrao),
      margemAlvo: tt(p.margemAlvo),
      margemMinima: tt(p.margemMinima),
      validadeOrcamentoDias: p.validadeOrcamentoDias,
      limiteServicoRapido: tt(p.limiteServicoRapido),
      limiteAprovacaoCompra: tt(p.limiteAprovacaoCompra),
      garantiaDias: p.garantiaDias,
      multaAtraso: tt(p.multaAtraso),
      jurosMes: tt(p.jurosMes),
      diasBloqueioInadimplencia: p.diasBloqueioInadimplencia,
      toleranciaCustoFixo: tt(p.toleranciaCustoFixo),
      condicaoPadrao: p.condicaoPadrao,
      encargosPorVinculo: { ...ENCARGOS_PADRAO, ...((p.encargosPorVinculo as Record<string, string>) ?? {}) }
    };
  }
}
