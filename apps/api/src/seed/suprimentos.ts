import { PrismaClient, TipoItem, TipoLocal } from '@prisma/client';
import { custoMedioAposEntrada, sugestaoDeCompra } from '@promec/motor';
import { pd } from '../comum/decimal';
import { completarCnpj } from '../comum/documento';
import { dataBanco, hojeLocal, somarDias } from '../planejamento/calendario';
import { json } from '../tabelas-custos/entrada';

type Chave = 'latao' | 'aco1045' | 'chapa' | 'inox' | 'sae4340' | 'oleo' | 'pastilha' | 'lixa' | 'kitcg' | 'filtro' | 'pastToro' | 'alargador';
interface ItemSemente {
  chave: Chave;
  codigo: string;
  descricao: string;
  tipo: TipoItem;
  compra: string;
  consumo: string;
  fator?: string;
  pesoPorMetro?: string;
  custo: string;
  minimo: string;
  maximo: string;
  rastreavel?: boolean;
  categoria: string;
  local: 'almox' | 'mp' | 'pecas' | 'ferr';
  saldo: string;
  fornecedor?: 'metais' | 'acos' | 'moto';
  margem?: string;
}

const ITENS: ItemSemente[] = [
  { chave: 'latao', codigo: 'MP-LAT-C360-25', descricao: 'Barra de latão C360 Ø25', tipo: 'MATERIA_PRIMA', compra: 'kg', consumo: 'kg', pesoPorMetro: '4.17', custo: '42.00', minimo: '20', maximo: '80', rastreavel: true, categoria: 'materiaPrima', local: 'mp', saldo: '36.9047619048', fornecedor: 'metais' },
  { chave: 'aco1045', codigo: 'MP-1045-45', descricao: 'Aço SAE 1045 Ø45', tipo: 'MATERIA_PRIMA', compra: 'kg', consumo: 'kg', pesoPorMetro: '12.48', custo: '9.80', minimo: '50', maximo: '200', rastreavel: true, categoria: 'materiaPrima', local: 'mp', saldo: '120', fornecedor: 'acos' },
  { chave: 'chapa', codigo: 'MP-CH-316', descricao: 'Chapa de aço carbono 3/16"', tipo: 'MATERIA_PRIMA', compra: 'kg', consumo: 'kg', custo: '8.40', minimo: '150', maximo: '400', categoria: 'materiaPrima', local: 'mp', saldo: '60', fornecedor: 'acos' },
  { chave: 'inox', codigo: 'MP-INOX420-40', descricao: 'Barra inox 420 Ø40', tipo: 'MATERIA_PRIMA', compra: 'kg', consumo: 'kg', pesoPorMetro: '9.86', custo: '36.00', minimo: '30', maximo: '90', rastreavel: true, categoria: 'materiaPrima', local: 'mp', saldo: '25', fornecedor: 'metais' },
  { chave: 'sae4340', codigo: 'MP-4340-30', descricao: 'Barra SAE 4340 Ø30', tipo: 'MATERIA_PRIMA', compra: 'kg', consumo: 'kg', pesoPorMetro: '5.55', custo: '14.20', minimo: '40', maximo: '150', rastreavel: true, categoria: 'materiaPrima', local: 'mp', saldo: '60', fornecedor: 'acos' },
  { chave: 'oleo', codigo: 'INS-OLEO-CORTE', descricao: 'Óleo de corte solúvel', tipo: 'INSUMO', compra: 'bombona 20 L', consumo: 'L', fator: '20', custo: '28.50', minimo: '20', maximo: '60', categoria: 'insumos', local: 'almox', saldo: '35' },
  { chave: 'pastilha', codigo: 'FG-CNMG-120408', descricao: 'Pastilha CNMG 120408', tipo: 'FERRAMENTA_GERAL', compra: 'un', consumo: 'un', custo: '38.90', minimo: '10', maximo: '40', categoria: 'ferramentaria', local: 'ferr', saldo: '24' },
  { chave: 'lixa', codigo: 'INS-LIXA-120', descricao: 'Lixa d’água grão 120', tipo: 'INSUMO', compra: 'folha', consumo: 'folha', custo: '2.10', minimo: '50', maximo: '200', categoria: 'insumos', local: 'almox', saldo: '90' },
  { chave: 'kitcg', codigo: 'PR-KIT-CG160', descricao: 'Kit relação CG 160', tipo: 'PECA_REPOSICAO', compra: 'un', consumo: 'un', custo: '189.00', minimo: '2', maximo: '6', categoria: 'pecas', local: 'pecas', saldo: '3', fornecedor: 'moto', margem: '0.35' },
  { chave: 'filtro', codigo: 'PR-FILTRO-CG', descricao: 'Filtro de óleo CG/Fan', tipo: 'PECA_REPOSICAO', compra: 'un', consumo: 'un', custo: '14.20', minimo: '5', maximo: '20', categoria: 'pecas', local: 'pecas', saldo: '12', fornecedor: 'moto', margem: '0.45' },
  { chave: 'pastToro', codigo: 'PR-PAST-TORO', descricao: 'Pastilha de freio dianteira Fiat Toro (jogo)', tipo: 'PECA_REPOSICAO', compra: 'jogo', consumo: 'jogo', custo: '168.00', minimo: '1', maximo: '4', categoria: 'pecas', local: 'pecas', saldo: '2', fornecedor: 'moto', margem: '0.35' },
  { chave: 'alargador', codigo: 'FE-ALARG-20H7', descricao: 'Alargador Ø20 H7', tipo: 'FERRAMENTA_ESPECIFICA', compra: 'un', consumo: 'un', custo: '312.00', minimo: '1', maximo: '2', categoria: 'ferramentaria', local: 'ferr', saldo: '1' }
];

const LOTES: { chave: Chave; codigo: string; fornecedor: 'metais' | 'acos'; corrida: string; norma: string; inicial: string; saldo: string }[] = [
  { chave: 'latao', codigo: '24-8812', fornecedor: 'metais', corrida: '24-8812', norma: 'ASTM B16 · UNS C36000', inicial: '36.9047619048', saldo: '35' },
  { chave: 'aco1045', codigo: 'L-1045-0921', fornecedor: 'acos', corrida: 'A1045-3310', norma: 'SAE J403 · 1045', inicial: '120', saldo: '120' },
  { chave: 'inox', codigo: 'L-420-0815', fornecedor: 'metais', corrida: '420-5521', norma: 'ASTM A276 · 420', inicial: '25', saldo: '25' },
  { chave: 'sae4340', codigo: 'L-4340-0930', fornecedor: 'acos', corrida: 'B4340-1187', norma: 'SAE J404 · 4340', inicial: '60', saldo: '60' }
];

async function sequencia(db: PrismaClient, tenantId: string, prefixo: string, minimo: number) {
  const chave = `${prefixo}-2026`;
  const s = await db.sequencia.findUnique({ where: { tenantId_chave: { tenantId, chave } } });
  if (!s || s.valor < minimo) await db.sequencia.upsert({ where: { tenantId_chave: { tenantId, chave } }, create: { tenantId, chave, valor: minimo }, update: { valor: minimo } });
}

/** Locais, itens, fornecedores, lotes, compras e qualidade coerentes com as OS e orçamentos semeados. */
export async function semearSuprimentos(db: PrismaClient, tenantId: string, id: (s: string) => string, r: { centroFresa: string }) {
  const hoje = hojeLocal();
  await db.parametros.update({ where: { tenantId }, data: { limiteAprovacaoCompra: pd('5000'), garantiaDias: 90 } });

  const locais: Record<string, [string, TipoLocal]> = {
    almox: ['Almoxarifado', 'ALMOXARIFADO'],
    mp: ['Matéria-prima', 'MATERIA_PRIMA'],
    pecas: ['Peças', 'PECAS'],
    ferr: ['Ferramentaria', 'FERRAMENTARIA']
  };
  for (const [i, [chave, [nome, tipo]]] of Object.entries(locais).entries()) {
    await db.localEstoque.upsert({
      where: { id: id(`local-${chave}`) },
      create: { id: id(`local-${chave}`), tenantId, nome, tipo, criadoEm: new Date(Date.UTC(2026, 0, 2, 8, i)) },
      update: { nome, tipo, ativo: true }
    });
  }

  const fornecedores = {
    metais: { raiz: '417285930001', nome: 'Metais Joinville Ltda.', fantasia: 'Metais Joinville', cidade: 'Joinville', categorias: ['MATERIA_PRIMA'], prazo: 5, condicao: '28 dias', avaliacao: '4.6', entregas: 12, email: 'vendas@metaisjoinville.com.br', telefone: '4734339100' },
    acos: { raiz: '263941870001', nome: 'Aços Itajaí Comércio de Metais Ltda.', fantasia: 'Aços Itajaí', cidade: 'Itajaí', categorias: ['MATERIA_PRIMA'], prazo: 7, condicao: '30/60 dias', avaliacao: '3.9', entregas: 8, email: 'comercial@acositajai.com.br', telefone: '4733481200' },
    moto: { raiz: '359126480001', nome: 'Moto Peças Sul Distribuidora Ltda.', fantasia: 'Moto Peças Sul', cidade: 'Joinville', categorias: ['PECA_REPOSICAO'], prazo: 2, condicao: '21 dias', avaliacao: '4.2', entregas: 15, email: 'pedidos@motopecassul.com.br', telefone: '4734221877' }
  };
  for (const [chave, f] of Object.entries(fornecedores)) {
    const dados = {
      tipo: 'PJ' as const,
      documento: completarCnpj(f.raiz),
      nome: f.nome,
      fantasia: f.fantasia,
      email: f.email,
      telefone: f.telefone,
      cidade: f.cidade,
      uf: 'SC',
      categorias: f.categorias,
      prazoMedioDias: f.prazo,
      condicaoPagamento: f.condicao,
      avaliacao: pd(f.avaliacao),
      entregas: f.entregas,
      status: 'ATIVO' as const
    };
    await db.fornecedor.upsert({ where: { id: id(`forn-${chave}`) }, create: { id: id(`forn-${chave}`), tenantId, ...dados }, update: dados });
  }

  const inoxRecebido = custoMedioAposEntrada({ saldo: '25', custoMedio: '36', quantidade: '20', custoUnitario: '36.50' });
  for (const i of ITENS) {
    const itemId = id(`item-${i.chave}`);
    const custo = i.chave === 'inox' ? inoxRecebido.custoMedio : i.custo;
    const dados = {
      codigo: i.codigo,
      descricao: i.descricao,
      tipo: i.tipo,
      unidadeCompra: i.compra,
      unidadeConsumo: i.consumo,
      fatorConversao: pd(i.fator ?? '1'),
      pesoPorMetroKg: i.pesoPorMetro ? pd(i.pesoPorMetro) : null,
      custoMedio: pd(custo),
      ultimoCusto: pd(i.chave === 'inox' ? '36.50' : i.custo),
      margemPeca: i.margem ? pd(i.margem) : null,
      estoqueMinimo: pd(i.minimo),
      estoqueMaximo: pd(i.maximo),
      fornecedorPreferidoId: i.fornecedor ? id(`forn-${i.fornecedor}`) : null,
      rastreavel: !!i.rastreavel,
      categoriaDespesa: i.categoria,
      ativo: true
    };
    await db.item.upsert({ where: { id: itemId }, create: { id: itemId, tenantId, ...dados }, update: dados });
    const fisico = i.chave === 'latao' ? '35' : i.chave === 'inox' ? inoxRecebido.saldo : i.saldo;
    await db.saldo.deleteMany({ where: { itemId } });
    await db.saldo.create({ data: { tenantId, itemId, localId: id(`local-${i.local}`), fisico: pd(fisico) } });
    const implantacao = {
      tenantId,
      tipo: 'AJUSTE' as const,
      itemId,
      localId: id(`local-${i.local}`),
      quantidade: pd(i.saldo),
      custoUnitario: pd(i.custo),
      valor: pd((Number(i.saldo) * Number(i.custo)).toFixed(10)),
      loteId: LOTES.some((l) => l.chave === i.chave) ? id(`lote-${i.chave}`) : null,
      observacao: 'Saldo de implantação do estoque',
      data: new Date(Date.UTC(2026, 9, 1, 11))
    };
    await db.movimento.upsert({ where: { id: id(`mov-impl-${i.chave}`) }, create: { id: id(`mov-impl-${i.chave}`), ...implantacao }, update: implantacao });
    if (i.fornecedor) {
      const preco = pd(i.chave === 'inox' ? '36.50' : i.custo);
      await db.fornecedorItem.upsert({
        where: { fornecedorId_itemId: { fornecedorId: id(`forn-${i.fornecedor}`), itemId } },
        create: { tenantId, fornecedorId: id(`forn-${i.fornecedor}`), itemId, ultimoPreco: preco },
        update: { ultimoPreco: preco }
      });
    }
  }

  for (const l of LOTES) {
    const dados = {
      itemId: id(`item-${l.chave}`),
      codigo: l.codigo,
      fornecedorId: id(`forn-${l.fornecedor}`),
      localId: id('local-mp'),
      quantidadeInicial: pd(l.inicial),
      saldo: pd(l.saldo),
      certificado: json({ numero: `CQ-${l.corrida}`, corrida: l.corrida, norma: l.norma, observacao: 'Certificado de usina conferido no recebimento' }),
      data: new Date(Date.UTC(2026, 9, 1, 11))
    };
    await db.lote.upsert({ where: { id: id(`lote-${l.chave}`) }, create: { id: id(`lote-${l.chave}`), tenantId, ...dados }, update: dados });
  }

  // Bucha da OS-41: 80,00 de latão já baixados do lote 24-8812 e 0,9 kg ainda reservados.
  const os41 = id('os-41');
  const consumo = {
    tenantId,
    tipo: 'SAIDA_OS' as const,
    itemId: id('item-latao'),
    localId: id('local-mp'),
    quantidade: pd('-1.9047619048'),
    custoUnitario: pd('42'),
    valor: pd('-80'),
    loteId: id('lote-latao'),
    osId: os41,
    osCustoId: `${os41}-custo-1`,
    usuarioId: id('usuario-marina'),
    observacao: 'OS-2026-00041',
    data: new Date(Date.now() - 4 * 3_600_000),
    estornado: false
  };
  await db.movimento.upsert({ where: { id: id('mov-consumo-os41') }, create: { id: id('mov-consumo-os41'), ...consumo }, update: consumo });
  const reserva = { tenantId, itemId: id('item-latao'), localId: id('local-mp'), osId: os41, quantidade: pd('2.8047619048'), consumida: pd('1.9047619048'), status: 'ATIVA' as const };
  await db.reserva.upsert({ where: { id: id('reserva-os41') }, create: { id: id('reserva-os41'), ...reserva }, update: reserva });

  // Compras: ponto de pedido da chapa, cotação do 1045 com três respostas, pedido acima da alçada e pedido parcial.
  const req1 = { tenantId, numero: 'REQ-2026-00001', status: 'ABERTA' as const, origem: 'PONTO_PEDIDO' as const, observacao: 'Gerada pelo ponto de pedido', cotacaoId: null, pedidoId: null };
  await db.requisicao.upsert({ where: { id: id('req-1') }, create: { id: id('req-1'), ...req1 }, update: req1 });
  await db.requisicaoItem.deleteMany({ where: { requisicaoId: id('req-1') } });
  await db.requisicaoItem.create({ data: { tenantId, requisicaoId: id('req-1'), itemId: id('item-chapa'), quantidade: pd(sugestaoDeCompra({ disponivel: '60', minimo: '150', maximo: '400' })) } });

  const req2 = { tenantId, numero: 'REQ-2026-00002', status: 'EM_COTACAO' as const, origem: 'MANUAL' as const, observacao: 'Eixos da Hidráulica Schroeder previstos para novembro', cotacaoId: id('cot-1'), pedidoId: null };
  await db.requisicao.upsert({ where: { id: id('req-2') }, create: { id: id('req-2'), ...req2 }, update: req2 });
  await db.requisicaoItem.deleteMany({ where: { requisicaoId: id('req-2') } });
  await db.requisicaoItem.create({ data: { tenantId, requisicaoId: id('req-2'), itemId: id('item-aco1045'), quantidade: pd('150') } });
  const cot = {
    tenantId,
    numero: 'COT-2026-00001',
    status: 'ABERTA' as const,
    requisicaoIds: [id('req-2')],
    fornecedorIds: [id('forn-acos'), id('forn-metais'), id('forn-moto')],
    itens: json([{ itemId: id('item-aco1045'), quantidade: '150' }]),
    fornecedorEscolhidoId: null,
    justificativa: null,
    pedidoId: null
  };
  await db.cotacao.upsert({ where: { id: id('cot-1') }, create: { id: id('cot-1'), ...cot }, update: cot });
  for (const [f, preco, frete, prazo] of [
    ['acos', '9.60', '80', 5],
    ['metais', '9.95', '0', 3],
    ['moto', '9.40', '220', 12]
  ] as const) {
    const dados = { itens: json([{ itemId: id('item-aco1045'), precoUnitario: preco }]), frete: pd(frete), prazoDias: prazo };
    await db.cotacaoResposta.upsert({
      where: { cotacaoId_fornecedorId: { cotacaoId: id('cot-1'), fornecedorId: id(`forn-${f}`) } },
      create: { tenantId, cotacaoId: id('cot-1'), fornecedorId: id(`forn-${f}`), ...dados },
      update: dados
    });
  }

  const pedidos = [
    { chave: 'pc-1', numero: 'PC-2026-00001', fornecedor: 'acos', status: 'AGUARDANDO_APROVACAO' as const, prazo: 7, itens: [['sae4340', '400', '14.60', '0']], total: '5840' },
    { chave: 'pc-2', numero: 'PC-2026-00002', fornecedor: 'metais', status: 'PARCIAL' as const, prazo: 4, itens: [['latao', '60', '42.00', '0'], ['inox', '40', '36.50', '20']], total: '3980' }
  ];
  for (const p of pedidos) {
    const f = fornecedores[p.fornecedor as keyof typeof fornecedores];
    const dados = {
      tenantId,
      numero: p.numero,
      fornecedorId: id(`forn-${p.fornecedor}`),
      status: p.status,
      frete: pd(0),
      total: pd(p.total),
      previsaoEntrega: dataBanco(somarDias(hoje, p.prazo)),
      condicaoPagamento: f.condicao,
      aprovadoPorId: p.status === 'PARCIAL' ? id('usuario-marina') : null,
      aprovadoEm: p.status === 'PARCIAL' ? new Date(Date.now() - 3 * 86_400_000) : null
    };
    await db.pedido.upsert({ where: { id: id(p.chave) }, create: { id: id(p.chave), ...dados }, update: dados });
    await db.pedidoItem.deleteMany({ where: { pedidoId: id(p.chave) } });
    await db.pedidoItem.createMany({
      data: p.itens.map(([item, q, preco, recebido], n) => ({ id: id(`${p.chave}-item-${n + 1}`), tenantId, pedidoId: id(p.chave), itemId: id(`item-${item}`), quantidade: pd(q), precoUnitario: pd(preco), recebido: pd(recebido) }))
    });
  }
  const recebimentoId = id('receb-pc-2');
  const loteInox = {
    tenantId,
    itemId: id('item-inox'),
    codigo: 'L-420-1019',
    fornecedorId: id('forn-metais'),
    recebimentoId,
    localId: id('local-mp'),
    quantidadeInicial: pd('20'),
    saldo: pd('20'),
    certificado: json({ numero: 'CQ-420-6077', corrida: '420-6077', norma: 'ASTM A276 · 420' }),
    data: new Date(Date.now() - 86_400_000)
  };
  await db.lote.upsert({ where: { id: id('lote-inox-2') }, create: { id: id('lote-inox-2'), ...loteInox }, update: loteInox });
  const receb = {
    tenantId,
    pedidoId: id('pc-2'),
    localId: id('local-mp'),
    notaFiscal: '48211',
    data: new Date(Date.now() - 86_400_000),
    itens: json([{ itemId: id('item-inox'), descricao: 'Barra inox 420 Ø40', quantidade: '20', precoUnitario: '36.50', loteId: id('lote-inox-2') }]),
    divergencias: json({ itens: [{ itemId: id('item-inox'), descricao: 'Barra inox 420 Ø40', tipo: 'QUANTIDADE', esperado: '40', recebido: '20' }], alertas: [] }),
    noPrazo: true,
    contaPagar: json({ valor: '730', vencimento: somarDias(hoje, 27), categoria: 'materiaPrima' }),
    usuarioId: id('usuario-marina')
  };
  await db.recebimento.upsert({ where: { id: recebimentoId }, create: { id: recebimentoId, ...receb }, update: receb });
  const entradaInox = {
    tenantId,
    tipo: 'ENTRADA_RECEBIMENTO' as const,
    itemId: id('item-inox'),
    localId: id('local-mp'),
    quantidade: pd('20'),
    custoUnitario: pd('36.50'),
    valor: pd('730'),
    loteId: id('lote-inox-2'),
    recebimentoId,
    usuarioId: id('usuario-marina'),
    observacao: 'PC-2026-00002 · NF 48211',
    data: new Date(Date.now() - 86_400_000)
  };
  await db.movimento.upsert({ where: { id: id('mov-receb-inox') }, create: { id: id('mov-receb-inox'), ...entradaInox }, update: entradaInox });

  // Qualidade: planos versionados, uma NC aberta e uma garantia em análise.
  const bucha = [
    { id: id('pi-furo'), descricao: 'Furo Ø20 H7', tipo: 'DIMENSIONAL', nominal: '20', tolInferior: '0', tolSuperior: '0.021', unidade: 'mm', instrumento: 'Súbito 18–35 mm' },
    { id: id('pi-externo'), descricao: 'Diâmetro externo Ø25 h6', tipo: 'DIMENSIONAL', nominal: '25', tolInferior: '-0.013', tolSuperior: '0', unidade: 'mm', instrumento: 'Micrômetro 0–25 mm' },
    { id: id('pi-rebarba'), descricao: 'Acabamento sem rebarba', tipo: 'VISUAL', instrumento: null }
  ];
  const comprimento = { id: id('pi-comp'), descricao: 'Comprimento 40 ± 0,1', tipo: 'DIMENSIONAL', nominal: '40', tolInferior: '-0.1', tolSuperior: '0.1', unidade: 'mm', instrumento: 'Paquímetro 150 mm' };
  const planos = [
    { rid: 'plano-bucha-v1', planoId: id('plano-bucha'), versao: 1, nome: 'Dimensional — bucha H7', segmento: 'USINAGEM' as const, itens: bucha },
    { rid: 'plano-bucha-v2', planoId: id('plano-bucha'), versao: 2, nome: 'Dimensional — bucha H7', segmento: 'USINAGEM' as const, itens: [...bucha.slice(0, 2), comprimento, bucha[2]] },
    {
      rid: 'plano-oficina-v1',
      planoId: id('plano-oficina'),
      versao: 1,
      nome: 'Checklist de saída — oficina',
      segmento: 'OFICINA' as const,
      itens: [
        { id: id('pi-torque'), descricao: 'Torque das rodas conferido', tipo: 'CHECK', instrumento: 'Torquímetro' },
        { id: id('pi-oleo'), descricao: 'Nível de óleo e fluidos', tipo: 'CHECK', instrumento: null },
        { id: id('pi-teste'), descricao: 'Test-drive sem ruídos', tipo: 'CHECK', instrumento: null },
        { id: id('pi-limpeza'), descricao: 'Veículo limpo, sem marcas de graxa', tipo: 'VISUAL', instrumento: null }
      ]
    }
  ];
  for (const p of planos) {
    const dados = { tenantId, planoId: p.planoId, versao: p.versao, nome: p.nome, segmento: p.segmento, ativo: true, exigeInspecao: true, itens: json(p.itens) };
    await db.planoInspecao.upsert({ where: { id: id(p.rid) }, create: { id: id(p.rid), ...dados, criadoEm: new Date(Date.UTC(2026, 8, p.versao, 12)) }, update: dados });
  }
  await db.ordemServico.updateMany({ where: { tenantId, segmento: 'USINAGEM', planoInspecaoId: null }, data: { planoInspecaoId: id('plano-bucha'), planoVersao: 2 } });
  await db.ordemServico.updateMany({ where: { tenantId, segmento: 'OFICINA', planoInspecaoId: null }, data: { planoInspecaoId: id('plano-oficina'), planoVersao: 1 } });

  const nc = {
    tenantId,
    numero: 'NC-2026-00001',
    origem: 'PROCESSO' as const,
    descricao: 'Rebarba no rasgo de chaveta em 3 peças do lote; aresta não foi quebrada após o fresamento.',
    status: 'ABERTA' as const,
    osId: id('os-38'),
    centroId: r.centroFresa,
    colaboradorId: id('colab-diego'),
    causa: null,
    acaoCorretiva: null
  };
  await db.naoConformidade.upsert({ where: { id: id('nc-1') }, create: { id: id('nc-1'), ...nc }, update: nc });
  const gar = {
    tenantId,
    numero: 'GAR-2026-00001',
    osId: id('os-37'),
    relato: 'Cliente relata ruído na engrenagem após duas semanas de uso; suspeita de dureza abaixo do especificado.',
    status: 'EM_ANALISE' as const,
    analise: null,
    osGarantiaId: null,
    decididaEm: null
  };
  await db.garantia.upsert({ where: { id: id('gar-1') }, create: { id: id('gar-1'), ...gar }, update: gar });

  await Promise.all([sequencia(db, tenantId, 'REQ', 2), sequencia(db, tenantId, 'COT', 1), sequencia(db, tenantId, 'PC', 2), sequencia(db, tenantId, 'NC', 1), sequencia(db, tenantId, 'GAR', 1)]);

  return {
    locais: { almox: id('local-almox'), mp: id('local-mp'), pecas: id('local-pecas'), ferr: id('local-ferr') },
    itens: Object.fromEntries(ITENS.map((i) => [i.chave, id(`item-${i.chave}`)])) as Record<Chave, string>,
    fornecedores: { metais: id('forn-metais'), acos: id('forn-acos'), moto: id('forn-moto') },
    lotes: { latao: id('lote-latao'), aco1045: id('lote-aco1045'), inox: id('lote-inox'), sae4340: id('lote-sae4340') },
    cotacaoId: id('cot-1'),
    pedidos: { aguardando: id('pc-1'), parcial: id('pc-2') },
    planos: { bucha: id('plano-bucha'), oficina: id('plano-oficina') },
    ncId: id('nc-1'),
    garantiaId: id('gar-1')
  };
}
