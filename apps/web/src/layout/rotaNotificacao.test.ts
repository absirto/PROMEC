import { describe, expect, it } from 'vitest';
import { rotaNotificacao } from './rotaNotificacao';

describe('rotaNotificacao', () => {
  it('traduz rotas da API para as telas', () => {
    expect(rotaNotificacao('/financeiro/titulos?tipo=RECEBER&status=VENCIDO')?.rota).toBe('/financeiro/receber');
    expect(rotaNotificacao('/financeiro/titulos/t1')?.rota).toBe('/financeiro/receber?titulo=t1');
    expect(rotaNotificacao('/compras/requisicoes')?.rota).toBe('/compras?aba=requisicoes');
    expect(rotaNotificacao('/estoque/saldos?abaixoDoMinimo=true')?.rota).toBe('/estoque?abaixoDoMinimo=true&aba=saldos');
    expect(rotaNotificacao('/manutencao/ordens?status=EM_EXECUCAO')?.rota).toBe('/manutencao?status=EM_EXECUCAO&aba=ordens');
    expect(rotaNotificacao('/rh/habilitacoes?vencendo=30')?.rota).toBe('/rh?vencendo=30&aba=habilitacoes');
    expect(rotaNotificacao('/ordens-servico/os-1')?.rota).toBe('/ordens-servico/os-1');
    expect(rotaNotificacao('https://x/portal/orcamento/a')).toEqual({ rota: 'https://x/portal/orcamento/a', externo: true });
    expect(rotaNotificacao('/manutencao/ordens/om1')?.rota).toBe('/manutencao?aba=ordens&ordem=om1');
    expect(rotaNotificacao(null)).toBeNull();
  });
});
