import { PrismaClient } from '@prisma/client';
import { pd } from '../comum/decimal';
import { criarTitulos, gerarRecorrencias, gerarTitulosDaOs, registrarBaixa, rotinaDiaria, tituloDoRecebimento } from '../financeiro/financeiro-core';
import { dataBanco, hojeLocal, somarDias, textoData } from '../planejamento/calendario';
import { json } from '../tabelas-custos/entrada';
import { CUSTO_FIXO_OUTUBRO } from './semear';

const NOMES_CF: Record<string, string> = {
  agua: 'Água e esgoto',
  alarme: 'Alarme e monitoramento',
  aluguel: 'Aluguel',
  contabilidade: 'Contabilidade',
  luz: 'Energia elétrica (escritório)',
  pessoalAdm: 'Pessoal administrativo',
  pessoalComercial: 'Pessoal comercial',
  proLabore: 'Pró-labore',
  seguros: 'Seguros',
  sistemas: 'Sistemas e licenças',
  tarifas: 'Tarifas e taxas',
  taxasBancarias: 'Taxas bancárias',
  telefone: 'Telefone e internet',
  treinamentos: 'Treinamentos',
  outros: 'Outras despesas fixas'
};

const VENCIMENTO: Record<string, number> = {
  aluguel: 5,
  pessoalAdm: 5,
  proLabore: 5,
  contabilidade: 10,
  sistemas: 10,
  alarme: 10,
  luz: 15,
  telefone: 15,
  agua: 18,
  tarifas: 20,
  treinamentos: 20,
  seguros: 25,
  outros: 28,
  taxasBancarias: 30
};

/** Contas, centros de custo, recorrências que fecham os R$ 22.000 de outubro, títulos de OS, avulsos e comissões. */
export async function semearFinanceiro(db: PrismaClient, tenantId: string, id: (s: string) => string, r: { centros: string[] }) {
  const hoje = hojeLocal();
  const usuario = id('usuario-marina');
  const parametros = { multaAtraso: pd('0.02'), jurosMes: pd('0.01'), diasBloqueioInadimplencia: 30, toleranciaCustoFixo: pd('0.1'), condicaoPadrao: 'à vista' };
  await db.parametros.update({ where: { tenantId }, data: parametros });

  const contas = [
    { chave: 'bb', nome: 'Banco do Brasil · conta movimento', tipo: 'BANCO' as const, banco: '001', agencia: '3420-5', numero: '28.771-9', saldo: '85000' },
    { chave: 'caixa', nome: 'Caixa da oficina', tipo: 'CAIXA' as const, banco: null, agencia: null, numero: null, saldo: '1200' }
  ];
  for (const c of contas) {
    const dados = { tenantId, nome: c.nome, tipo: c.tipo, banco: c.banco, agencia: c.agencia, numero: c.numero, saldoInicial: pd(c.saldo), dataSaldoInicial: dataBanco('2026-09-01'), ativa: true };
    await db.contaFinanceira.upsert({ where: { id: id(`conta-${c.chave}`) }, create: { id: id(`conta-${c.chave}`), ...dados }, update: dados });
  }
  const bb = id('conta-bb');

  for (const [categoria, nome] of Object.entries(NOMES_CF)) {
    const dados = { tenantId, nome, tipo: 'FIXO' as const, compoeCustoFixo: true, categoriaCustoFixo: categoria, papel: `CF:${categoria}`, ativo: true };
    await db.centroCusto.upsert({ where: { id: id(`cc-${categoria}`) }, create: { id: id(`cc-${categoria}`), ...dados }, update: dados });
  }
  const sistema: [string, string, string][] = [
    ['receita', 'Receita de serviços', 'RECEITA_SERVICOS'],
    ['comissoes', 'Comissões', 'COMISSOES'],
    ['materia-prima', 'Matéria-prima', 'CATEGORIA:materiaPrima'],
    ['pecas', 'Peças de reposição', 'CATEGORIA:pecas'],
    ['insumos', 'Insumos', 'CATEGORIA:insumos'],
    ['ferramentaria', 'Ferramentaria', 'CATEGORIA:ferramentaria']
  ];
  for (const [chave, nome, papel] of sistema) {
    const dados = { tenantId, nome, tipo: 'VARIAVEL' as const, compoeCustoFixo: false, papel, ativo: true };
    await db.centroCusto.upsert({ where: { id: id(`cc-${chave}`) }, create: { id: id(`cc-${chave}`), ...dados }, update: dados });
  }
  const maquinas = await db.centroTrabalho.findMany({ where: { id: { in: r.centros } } });
  for (const m of maquinas) {
    const dados = { tenantId, nome: `Manutenção — ${m.nome}`, tipo: 'VARIAVEL' as const, compoeCustoFixo: false, custoDiretoCentro: json({ centroTrabalhoId: m.id, componente: 'manutencao' }), ativo: true };
    await db.centroCusto.upsert({ where: { id: id(`cc-man-${m.codigo}`) }, create: { id: id(`cc-man-${m.codigo}`), ...dados }, update: dados });
  }

  for (const [categoria, descricao, valor] of CUSTO_FIXO_OUTUBRO) {
    const avulso = categoria === 'treinamentos';
    const dados = {
      tenantId,
      descricao,
      centroCustoId: id(`cc-${categoria}`),
      valor: pd(valor),
      diaVencimento: VENCIMENTO[categoria] ?? 10,
      inicio: dataBanco(avulso ? '2026-10-01' : '2026-09-01'),
      fim: avulso ? dataBanco('2026-10-31') : null,
      ativa: true
    };
    await db.recorrencia.upsert({ where: { id: id(`rec-${categoria}`) }, create: { id: id(`rec-${categoria}`), ...dados }, update: dados });
  }
  await gerarRecorrencias(db, tenantId, '2026-09', usuario);
  await gerarRecorrencias(db, tenantId, '2026-10', usuario);
  const p = await db.parametros.findUniqueOrThrow({ where: { tenantId } });
  const fixos = await db.titulo.findMany({ where: { tenantId, recorrenciaId: { not: null }, competencia: { in: ['2026-09', '2026-10'] }, status: 'ABERTO' } });
  for (const t of fixos) {
    const venc = textoData(t.vencimento);
    if (venc > hoje) continue;
    await registrarBaixa(db, tenantId, t, { data: venc, contaId: bb, multa: '0', juros: '0', usuarioId: usuario, observacao: 'Débito automático' }, p);
  }

  // OS-2026-00037 entregue: 3 parcelas (30/60/90); a primeira foi antecipada nesta semana e gera a comissão do Paulo.
  await gerarTitulosDaOs(db, tenantId, id('os-37'), usuario);
  const parcela1 = await db.titulo.findFirst({ where: { tenantId, origemTipo: 'OS', origemId: id('os-37'), parcela: '1/3' } });
  if (parcela1 && parcela1.status === 'ABERTO') {
    await registrarBaixa(db, tenantId, parcela1, { data: somarDias(hoje, -1), contaId: bb, observacao: 'Antecipação pelo cliente', usuarioId: usuario }, p);
  }

  const receita = id('cc-receita');
  const avulsos: { chave: string; cliente: string; descricao: string; valor: string; vence: number; pago?: number }[] = [
    { chave: 'pirabeiraba', cliente: 'pirabeiraba', descricao: 'Usinagem de placa porta-molde — serviço avulso', valor: '1380.00', vence: -45 },
    { chave: 'babitonga', cliente: 'babitonga', descricao: 'Recuperação de rosca do eixo — serviço avulso', valor: '640.00', vence: -10 },
    { chave: 'schroeder', cliente: 'schroeder', descricao: 'Retífica de assento de válvula — lote 4', valor: '2180.00', vence: 2 },
    { chave: 'metalvale', cliente: 'metalvale', descricao: 'Conserto de matriz de corte — serviço avulso', valor: '935.50', vence: 1 },
    { chave: 'schroeder-pago', cliente: 'schroeder', descricao: 'Afiação de fresas — serviço avulso', valor: '1540.00', vence: -1, pago: -1 }
  ];
  for (const a of avulsos) {
    const clienteId = id(`cliente-${a.cliente}`);
    let t = await db.titulo.findFirst({ where: { tenantId, clienteId, descricao: a.descricao } });
    if (!t) {
      const c = await db.cliente.findUniqueOrThrow({ where: { id: clienteId } });
      const venc = somarDias(hoje, a.vence);
      [t] = await criarTitulos(
        db,
        tenantId,
        { tipo: 'RECEBER', pessoaTipo: 'CLIENTE', clienteId, pessoaNome: c.fantasia || c.nome, descricao: a.descricao, centroCustoId: receita, competencia: venc.slice(0, 7), emissao: somarDias(venc, -28) },
        [{ vencimento: venc, valor: a.valor }],
        usuario
      );
    }
    if (a.pago !== undefined && t.status === 'ABERTO') {
      await registrarBaixa(db, tenantId, t, { data: somarDias(hoje, a.pago), contaId: bb, usuarioId: usuario }, p);
    }
  }

  await tituloDoRecebimento(db, tenantId, id('receb-pc-2'), usuario);
  const rotina = await rotinaDiaria(db, tenantId);
  return { contas: { bb, caixa: id('conta-caixa') }, centrosCusto: { receita, aluguel: id('cc-aluguel'), comissoes: id('cc-comissoes') }, bloqueados: rotina.clientesBloqueados.map((c) => c.id) };
}

/**
 * Devolve o financeiro da empresa de demonstração ao estado semeado: apaga o transacional e o que não é da semente.
 * Os lançamentos de custo fixo semeados (2026-09 e 2026-10) e as Tabelas de Custos publicadas não mudam.
 */
export async function limparFinanceiroDemo(db: PrismaClient, tenantId: string, prefixo: string) {
  const semeado = (campo: string) => ({ NOT: { [campo]: { startsWith: `${prefixo}-` } } });
  await db.$transaction([
    db.comissao.deleteMany({ where: { tenantId } }),
    db.comissaoFechamento.deleteMany({ where: { tenantId } }),
    db.baixa.deleteMany({ where: { tenantId } }),
    db.tituloHistorico.deleteMany({ where: { tenantId } }),
    db.titulo.deleteMany({ where: { tenantId } }),
    db.transferencia.deleteMany({ where: { tenantId } }),
    db.recorrencia.deleteMany({ where: { tenantId, ...semeado('id') } }),
    db.contaFinanceira.deleteMany({ where: { tenantId, ...semeado('id') } }),
    db.centroCusto.deleteMany({ where: { tenantId, ...semeado('id') } }),
    db.lancamentoCustoFixo.deleteMany({ where: { tenantId, ...semeado('id') } }),
    db.sequencia.deleteMany({ where: { tenantId, OR: [{ chave: { startsWith: 'CR-' } }, { chave: { startsWith: 'CP-' } }] } }),
    db.parametros.updateMany({ where: { tenantId }, data: { rotinaExecutadaEm: null } }),
    db.cliente.updateMany({ where: { tenantId }, data: { bloqueioAutomatico: false, liberadoAte: null, liberadoPorId: null } })
  ]);
}
