import { Papel, Prisma, PrismaClient, StatusOrcamento } from '@prisma/client';
import { calcularTabelaCustos } from '@promec/motor';
import * as bcrypt from 'bcryptjs';
import { pd } from '../comum/decimal';
import { completarCnpj } from '../comum/documento';
import { calcular, colunasDePrecificacao, colunasDoResultado, LinhaEntrada } from '../orcamentos/calculo';
import { formatarNumero } from '../orcamentos/numeracao';
import { json, montarEntrada, resultadoDe } from '../tabelas-custos/entrada';
import { semearAgenda } from './agenda';
import { semearCrm } from './crm';
import { semearManutencao } from './manutencao';
import { garantirPerfis } from '../acesso/permissoes';
import { mesclarObjeto } from '../ordens/custo';
import { semearFinanceiro } from './financeiro';
import { semearSuprimentos } from './suprimentos';
import { semearOrdens } from './ordens';

export interface OpcoesSemente {
  /** Prefixo dos ids, para semear mais de uma empresa no mesmo banco (testes). */
  prefixo: string;
  nome: string;
  dominio: string;
  senha: string;
}

const dia = 24 * 60 * 60 * 1000;
const haDias = (n: number) => new Date(Date.now() - n * dia);
const dataEm = (n: number) => {
  const d = new Date(Date.now() + n * dia);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const CUSTO_FIXO_OUTUBRO: [string, string, string][] = [
  ['aluguel', 'Aluguel do galpão', '8000'],
  ['pessoalAdm', 'Assistente administrativo e encargos', '4800'],
  ['proLabore', 'Pró-labore da gestão', '3000'],
  ['luz', 'Energia do escritório e iluminação', '1850'],
  ['contabilidade', 'Escritório de contabilidade', '1200'],
  ['sistemas', 'ERP, CAD/CAM e licenças', '690'],
  ['seguros', 'Seguro predial e de máquinas', '620'],
  ['treinamentos', 'Curso de programação CNC', '400'],
  ['telefone', 'Telefone e internet', '390'],
  ['agua', 'Água e esgoto', '260'],
  ['outros', 'Material de limpeza e copa', '250'],
  ['tarifas', 'Tarifas e taxas municipais', '210'],
  ['alarme', 'Monitoramento e alarme', '180'],
  ['taxasBancarias', 'Taxas bancárias', '150']
];

const CUSTO_FIXO_SETEMBRO = CUSTO_FIXO_OUTUBRO.filter(([c]) => c !== 'treinamentos').map(
  ([c, d, v]): [string, string, string] => (c === 'luz' ? [c, d, '1650'] : [c, d, v])
);

export async function semearEmpresa(db: PrismaClient, o: OpcoesSemente) {
  const id = (s: string) => `${o.prefixo}-${s}`;
  const tenantId = id('empresa');

  await db.empresa.upsert({ where: { id: tenantId }, create: { id: tenantId, nome: o.nome, telefone: '4734320000' }, update: { nome: o.nome, telefone: '4734320000' } });
  const perfis = await garantirPerfis(db, tenantId, true);
  const perfil = (nome: string) => perfis.find((p) => p.nome === nome)!.id;
  const parametros = {
    criterioRateio: 'horas',
    metodoPreco: 'divisor',
    impostosPadrao: pd('0.14'),
    comissaoPadrao: pd('0'),
    margemAlvo: pd('0.20'),
    margemMinima: pd('0.15'),
    validadeOrcamentoDias: 15
  };
  await db.parametros.upsert({ where: { tenantId }, create: { tenantId, ...parametros }, update: parametros });

  const senhaHash = await bcrypt.hash(o.senha, 10);
  const usuarios: Record<string, { nome: string; papel: Papel; perfilId: string; telefone: string; trocarSenha: boolean }> = {
    marina: { nome: 'Marina Kowalski', papel: 'ADMIN', perfilId: perfil('Administrador'), telefone: '47991114455', trocarSenha: false },
    paulo: { nome: 'Paulo Henrique Souza', papel: 'ORCAMENTISTA', perfilId: perfil('Orçamentista'), telefone: '47991112233', trocarSenha: false },
    carla: { nome: 'Carla Mendes', papel: 'GESTOR', perfilId: perfil('Financeiro'), telefone: '47991117788', trocarSenha: false },
    ricardo: { nome: 'Ricardo Lima', papel: 'OPERADOR', perfilId: perfil('Produção/Técnico'), telefone: '47991119900', trocarSenha: false }
  };
  for (const [login, u] of Object.entries(usuarios)) {
    const email = `${login}@${o.dominio}`;
    await db.usuario.upsert({
      where: { email },
      create: { id: id(`usuario-${login}`), tenantId, email, senhaHash, ...u },
      update: { tenantId, senhaHash, ativo: true, ...u }
    });
  }

  const centros = [
    { chave: 'torno', codigo: 'TCNC-01', nome: 'Torno CNC de entrada' },
    { chave: 'fresa', codigo: 'FCNC-01', nome: 'Fresa CNC 01' },
    { chave: 'cu', codigo: 'CU-02', nome: 'Centro de usinagem 02' }
  ];
  const operadores = [
    { chave: 'ricardo', nome: 'Ricardo Lima', funcao: 'Operador de torno CNC', centro: 'torno' },
    { chave: 'diego', nome: 'Diego Ramos Ferreira', funcao: 'Operador de fresa CNC', centro: 'fresa' },
    { chave: 'anderson', nome: 'Anderson Luiz Vieira', funcao: 'Operador de centro de usinagem', centro: 'cu' }
  ];
  for (const [i, c] of centros.entries()) {
    const dados = {
      codigo: c.codigo,
      nome: c.nome,
      tipo: 'maquina',
      status: 'ativo',
      horasExpediente: pd('220'),
      eficiencia: pd('0.75'),
      manutencao: pd('700'),
      insumos: pd('700'),
      outros: pd('0'),
      valorAquisicao: pd('150000'),
      valorResidual: pd('0'),
      vidaUtilMeses: 60,
      potenciaKw: pd('0'),
      fatorCarga: pd('0'),
      tarifaKwh: pd('0'),
      pesoManual: null,
      areaM2: null
    };
    await db.centroTrabalho.upsert({
      where: { id: id(`centro-${c.chave}`) },
      create: { id: id(`centro-${c.chave}`), tenantId, criadoEm: new Date(Date.UTC(2026, 0, 5, 9, i)), ...dados },
      update: dados
    });
  }
  await db.colaborador.deleteMany({ where: { id: id('colab-paulo'), apontamentos: { none: {} }, operacoes: { none: {} } } });
  await db.colaborador.upsert({ where: { id: id('colab-ricardo') }, create: { id: id('colab-ricardo'), tenantId, nome: 'Ricardo Lima' }, update: {} });
  await db.usuario.update({ where: { email: `ricardo@${o.dominio}` }, data: { colaboradorId: id('colab-ricardo') } });
  const marcelo = { nome: 'Marcelo Antunes', funcao: 'Soldador', vinculo: 'CLT' as const, salario: pd('4300'), encargos: pd('2750'), beneficios: pd('0'), jornadaHoras: pd('220'), ativo: true };
  await db.colaborador.upsert({ where: { id: id('colab-marcelo') }, create: { id: id('colab-marcelo'), tenantId, ...marcelo }, update: marcelo });
  for (const op of operadores) {
    const dados = {
      nome: op.nome,
      funcao: op.funcao,
      vinculo: 'CLT' as const,
      salario: pd('5000'),
      encargos: pd('3200'),
      beneficios: pd('0'),
      jornadaHoras: pd('220'),
      ativo: true
    };
    const colaboradorId = id(`colab-${op.chave}`);
    await db.colaborador.upsert({ where: { id: colaboradorId }, create: { id: colaboradorId, tenantId, ...dados }, update: dados });
    await db.centroOperador.deleteMany({ where: { tenantId, colaboradorId, centroId: { not: id(`centro-${op.centro}`) } } });
    await db.centroOperador.upsert({
      where: { centroId_colaboradorId: { centroId: id(`centro-${op.centro}`), colaboradorId } },
      create: { tenantId, centroId: id(`centro-${op.centro}`), colaboradorId, alocacao: pd('1') },
      update: { alocacao: pd('1') }
    });
  }

  // Box 3 da oficina: fica fora das Tabelas de Custos semeadas para não mexer no rateio canônico (117,78/h).
  const box3 = id('centro-box3');
  const dadosBox = {
    codigo: 'BOX-03',
    nome: 'Box 3 (elevador)',
    tipo: 'box',
    status: 'ativo',
    horasExpediente: pd('220'),
    eficiencia: pd('0.8'),
    manutencao: pd('250'),
    insumos: pd('400'),
    valorAquisicao: pd('38000'),
    valorResidual: pd('4000'),
    vidaUtilMeses: 120,
    diasSemana: [1, 2, 3, 4, 5, 6]
  };
  await db.centroTrabalho.upsert({ where: { id: box3 }, create: { id: box3, tenantId, criadoEm: new Date(Date.UTC(2026, 9, 15, 9)), ...dadosBox }, update: dadosBox });
  const jonas = id('colab-jonas');
  const dadosJonas = { nome: 'Jonas Ferreira', funcao: 'Mecânico de manutenção', vinculo: 'CLT' as const, salario: pd('3900'), encargos: pd('2500'), beneficios: pd('450'), jornadaHoras: pd('220'), ativo: true };
  await db.colaborador.upsert({ where: { id: jonas }, create: { id: jonas, tenantId, ...dadosJonas }, update: dadosJonas });
  await db.centroOperador.upsert({
    where: { centroId_colaboradorId: { centroId: box3, colaboradorId: jonas } },
    create: { tenantId, centroId: box3, colaboradorId: jonas, alocacao: pd('1') },
    update: { alocacao: pd('1') }
  });

  for (const [competencia, itens] of [
    ['2026-09', CUSTO_FIXO_SETEMBRO],
    ['2026-10', CUSTO_FIXO_OUTUBRO]
  ] as const) {
    for (const [categoria, descricao, valor] of itens) {
      const lid = id(`cf-${competencia}-${categoria}`);
      await db.lancamentoCustoFixo.upsert({
        where: { id: lid },
        create: { id: lid, tenantId, competencia, categoria, descricao, valor: pd(valor) },
        update: { competencia, categoria, descricao, valor: pd(valor) }
      });
    }
  }

  const tabelas = {
    setembro: { id: id('tabela-2026-09-v1'), competencia: '2026-09', status: 'ENCERRADA' as const, publicadaEm: new Date('2026-09-01T11:00:00Z'), encerradaEm: new Date('2026-10-01T11:00:00Z') },
    outubro: { id: id('tabela-2026-10-v1'), competencia: '2026-10', status: 'VIGENTE' as const, publicadaEm: new Date('2026-10-01T11:00:00Z'), encerradaEm: null }
  };
  await db.tabelaCustos.updateMany({ where: { tenantId, status: 'VIGENTE', id: { not: tabelas.outubro.id } }, data: { status: 'ENCERRADA', encerradaEm: new Date() } });
  for (const t of Object.values(tabelas)) {
    const completa = await montarEntrada(db, tenantId, t.competencia);
    const entrada = { ...completa, centros: completa.centros.filter((c) => c.id !== box3) };
    const dados = { status: t.status, desatualizada: false, entrada: json(entrada), resultado: json(calcularTabelaCustos(entrada)), publicadaEm: t.publicadaEm, encerradaEm: t.encerradaEm };
    await db.tabelaCustos.upsert({
      where: { id: t.id },
      create: { id: t.id, tenantId, competencia: t.competencia, versao: 1, criadaEm: new Date(t.publicadaEm.getTime() - dia), ...dados },
      update: dados
    });
  }

  const clientes = [
    { chave: 'metalvale', raiz: '128473650001', nome: 'Metalúrgica Vale do Itajaí Ltda.', fantasia: 'Metalúrgica Vale', email: 'compras@metalvale.com.br', telefone: '4733330000', cidade: 'Blumenau' },
    { chave: 'schroeder', raiz: '073915280001', nome: 'Hidráulica Schroeder Indústria e Comércio Ltda.', fantasia: 'Hidráulica Schroeder', email: 'suprimentos@hidraulicaschroeder.com.br', telefone: '4733712200', cidade: 'Jaraguá do Sul' },
    { chave: 'pirabeiraba', raiz: '215604930001', nome: 'Ferramentaria Pirabeiraba Ltda.', fantasia: 'Ferramentaria Pirabeiraba', email: 'orcamentos@ferpirabeiraba.com.br', telefone: '4734241890', cidade: 'Joinville' },
    { chave: 'babitonga', raiz: '304817260001', nome: 'Náutica Babitonga Estaleiro Ltda.', fantasia: 'Estaleiro Babitonga', email: 'engenharia@estaleirobabitonga.com.br', telefone: '4734446120', cidade: 'São Francisco do Sul' },
    { chave: 'tupinamba', raiz: '096352170001', nome: 'Tupinambá Implementos Agrícolas S.A.', fantasia: 'Tupinambá Implementos', email: 'compras@tupinamba.ind.br', telefone: '4735210400', cidade: 'Rio do Sul', status: 'BLOQUEADO' as const, observacoes: 'Bloqueado pelo financeiro: duas duplicatas em atraso.' }
  ];
  for (const c of clientes) {
    const dados = {
      tipo: 'PJ' as const,
      documento: completarCnpj(c.raiz),
      nome: c.nome,
      fantasia: c.fantasia,
      email: c.email,
      telefone: c.telefone,
      cidade: c.cidade,
      uf: 'SC',
      status: c.status ?? ('ATIVO' as const),
      observacoes: c.observacoes ?? ''
    };
    await db.cliente.upsert({ where: { id: id(`cliente-${c.chave}`) }, create: { id: id(`cliente-${c.chave}`), tenantId, ...dados }, update: dados });
  }

  const centro = (chave: string) => id(`centro-${chave}`);
  type Evento = [evento: string, status: StatusOrcamento, versao: number, diasAtras: number, detalhe?: string];
  const orcamentos: {
    n: number;
    cliente: string;
    titulo: string;
    lote: number;
    desconto: string;
    tabela: keyof typeof tabelas;
    status: StatusOrcamento;
    validadeEm: number;
    linhas: LinhaEntrada[];
    eventos: Evento[];
    motivoRecusa?: string;
    prazoEm?: number;
    comissao?: string;
    condicao?: string;
    objeto?: Record<string, string>;
    observacoes?: string;
  }[] = [
    {
      n: 124,
      comissao: '0.03',
      condicao: '28 dias',
      cliente: 'schroeder',
      titulo: 'Eixo de transmissão SAE 1045 retificado — lote de 20',
      lote: 20,
      desconto: '0',
      tabela: 'outubro',
      status: 'CONVERTIDO',
      validadeEm: 3,
      linhas: [
        { tipo: 'materialCorte', descricao: 'Barra redonda SAE 1045 Ø50', comprimentoMm: '320', sobraMm: '5', pesoPorMetroKg: '15.41', precoKg: '9.80' },
        { tipo: 'ferramental', descricao: 'Pastilhas CNMG para desbaste', custo: '180' },
        { tipo: 'operacao', descricao: 'Torneamento', centroId: centro('torno'), cicloHorasPorPeca: '0.25', setupHorasPorLote: '2' },
        { tipo: 'operacao', descricao: 'Fresamento do rasgo de chaveta', centroId: centro('fresa'), cicloHorasPorPeca: '0.1', setupHorasPorLote: '1.5' },
        { tipo: 'terceiro', descricao: 'Retífica cilíndrica externa', base: 'peca', custo: '18', markup: '0.1' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 12], ['enviado', 'ENVIADO', 1, 11], ['aprovado', 'APROVADO', 1, 4], ['convertido', 'CONVERTIDO', 1, 4, 'OS-2026-00038']]
    },
    {
      n: 125,
      cliente: 'pirabeiraba',
      titulo: 'Placa base de molde em aço P20 — 2 peças',
      lote: 2,
      desconto: '0.03',
      tabela: 'outubro',
      status: 'RECUSADO',
      validadeEm: 5,
      motivoRecusa: 'Cliente fechou com fornecedor de Curitiba pelo prazo de entrega.',
      linhas: [
        { tipo: 'material', descricao: 'Bloco P20 pré-temperado 400×300×60', base: 'peca', quantidade: '1', custoUnitario: '640' },
        { tipo: 'operacao', descricao: 'Usinagem de cavidades e furação', centroId: centro('cu'), cicloHorasPorPeca: '3.5', setupHorasPorLote: '1.5' },
        { tipo: 'terceiro', descricao: 'Retífica plana das faces', base: 'peca', custo: '120' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 10], ['enviado', 'ENVIADO', 1, 9], ['recusado', 'RECUSADO', 1, 2, 'Cliente fechou com fornecedor de Curitiba pelo prazo de entrega.']]
    },
    {
      n: 126,
      cliente: 'babitonga',
      titulo: 'Flange inox 316 DN100 — lote de 30',
      lote: 30,
      desconto: '0.02',
      tabela: 'setembro',
      status: 'EM_NEGOCIACAO',
      validadeEm: 9,
      observacoes: 'Cliente pediu prazo de 20 dias; avaliar entrega parcial.',
      linhas: [
        { tipo: 'materialCorte', descricao: 'Barra inox 316 Ø230', comprimentoMm: '28', sobraMm: '4', pesoPorMetroKg: '330', precoKg: '41.50' },
        { tipo: 'operacao', descricao: 'Torneamento de face e diâmetros', centroId: centro('torno'), cicloHorasPorPeca: '0.35', setupHorasPorLote: '2.5' },
        { tipo: 'operacao', descricao: 'Furação dos 8 furos', centroId: centro('fresa'), cicloHorasPorPeca: '0.15', setupHorasPorLote: '1' },
        { tipo: 'frete', descricao: 'Entrega em São Francisco do Sul', valor: '180' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 20], ['enviado', 'ENVIADO', 1, 19], ['negociacao', 'EM_NEGOCIACAO', 1, 15], ['nova_versao', 'EM_NEGOCIACAO', 2, 14]]
    },
    {
      n: 127,
      cliente: 'metalvale',
      titulo: 'Pino guia temperado Ø12 — lote de 50',
      lote: 50,
      desconto: '0.10',
      tabela: 'outubro',
      status: 'RASCUNHO',
      validadeEm: 15,
      linhas: [
        { tipo: 'material', descricao: 'Barra prata VND Ø12', base: 'peca', quantidade: '1', custoUnitario: '3.20' },
        { tipo: 'operacao', descricao: 'Torneamento e chanfro', centroId: centro('torno'), cicloHorasPorPeca: '0.05', setupHorasPorLote: '1.5' },
        { tipo: 'terceiro', descricao: 'Têmpera e revenimento', base: 'lote', custo: '220', markup: '0.15' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 1]]
    },
    {
      n: 128,
      objeto: { desenho: 'BUC-H7-020', revisao: 'C', material: 'Latão C360 Ø25' },
      cliente: 'metalvale',
      titulo: 'Bucha de latão com tolerância H7 — lote piloto de 10 peças',
      lote: 10,
      desconto: '0.05',
      tabela: 'outubro',
      status: 'ENVIADO',
      validadeEm: 13,
      linhas: [
        { tipo: 'material', descricao: 'Barra de latão C360 Ø25', base: 'peca', quantidade: '1', custoUnitario: '8.00' },
        { tipo: 'operacao', descricao: 'Torneamento CNC', centroId: centro('torno'), cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 3], ['enviado', 'ENVIADO', 1, 2]]
    },
    {
      n: 115,
      comissao: '0.03',
      condicao: '30/60/90',
      cliente: 'metalvale',
      titulo: 'Engrenagem de dentes retos módulo 2 — lote de 12',
      lote: 12,
      desconto: '0',
      tabela: 'setembro',
      status: 'CONVERTIDO',
      validadeEm: -15,
      linhas: [
        { tipo: 'material', descricao: 'Tarugo SAE 4140 Ø80', base: 'peca', quantidade: '1', custoUnitario: '46.00' },
        { tipo: 'operacao', descricao: 'Torneamento do blank', centroId: centro('torno'), cicloHorasPorPeca: '0.2', setupHorasPorLote: '1' },
        { tipo: 'operacao', descricao: 'Geração dos dentes', centroId: centro('cu'), cicloHorasPorPeca: '0.45', setupHorasPorLote: '2' },
        { tipo: 'terceiro', descricao: 'Têmpera por indução', base: 'lote', custo: '260', markup: '0.1' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 30], ['enviado', 'ENVIADO', 1, 29], ['aprovado', 'APROVADO', 1, 25], ['convertido', 'CONVERTIDO', 1, 25, 'OS-2026-00037']]
    },
    {
      n: 116,
      cliente: 'babitonga',
      titulo: 'Eixo da bomba de porão em inox 420 — 6 peças',
      lote: 6,
      desconto: '0',
      tabela: 'outubro',
      status: 'CONVERTIDO',
      validadeEm: 9,
      linhas: [
        { tipo: 'materialCorte', descricao: 'Barra inox 420 Ø40', comprimentoMm: '620', sobraMm: '10', pesoPorMetroKg: '9.86', precoKg: '36' },
        { tipo: 'operacao', descricao: 'Torneamento', centroId: centro('torno'), cicloHorasPorPeca: '0.6', setupHorasPorLote: '1.5' },
        { tipo: 'operacao', descricao: 'Fresamento dos rasgos', centroId: centro('fresa'), cicloHorasPorPeca: '0.25', setupHorasPorLote: '1' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 9], ['enviado', 'ENVIADO', 1, 8], ['aprovado', 'APROVADO', 1, 6], ['convertido', 'CONVERTIDO', 1, 6, 'OS-2026-00039']]
    },
    {
      n: 117,
      cliente: 'pirabeiraba',
      titulo: 'Bucha-guia temperada para molde de injeção — 8 peças',
      lote: 8,
      desconto: '0',
      tabela: 'outubro',
      status: 'CONVERTIDO',
      validadeEm: 1,
      linhas: [
        { tipo: 'material', descricao: 'Barra SAE 52100 Ø35', base: 'peca', quantidade: '1', custoUnitario: '14.50' },
        { tipo: 'operacao', descricao: 'Torneamento', centroId: centro('torno'), cicloHorasPorPeca: '0.3', setupHorasPorLote: '1.5' },
        { tipo: 'terceiro', descricao: 'Têmpera e retífica', base: 'lote', custo: '380', markup: '0.1' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 14], ['enviado', 'ENVIADO', 1, 13], ['aprovado', 'APROVADO', 1, 10], ['convertido', 'CONVERTIDO', 1, 10, 'OS-2026-00040']]
    },
    {
      n: 122,
      cliente: 'schroeder',
      titulo: 'Pino de articulação para escavadeira — lote de 100',
      lote: 100,
      desconto: '0',
      tabela: 'outubro',
      status: 'APROVADO',
      validadeEm: 12,
      prazoEm: 8,
      linhas: [
        { tipo: 'material', descricao: 'Barra SAE 4340 Ø30', base: 'peca', quantidade: '1', custoUnitario: '12.40' },
        { tipo: 'operacao', descricao: 'Torneamento e rosca', centroId: centro('torno'), cicloHorasPorPeca: '0.25', setupHorasPorLote: '2' },
        { tipo: 'terceiro', descricao: 'Nitretação', base: 'lote', custo: '450', markup: '0.1' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 5], ['enviado', 'ENVIADO', 1, 4], ['aprovado', 'APROVADO', 1, 1]]
    },
    {
      n: 121,
      objeto: { desenho: 'BUC-H7-020', revisao: 'C', material: 'Latão C360 Ø25' },
      cliente: 'metalvale',
      titulo: 'Bucha de latão com tolerância H7 — lote de 10 peças',
      lote: 10,
      desconto: '0.05',
      tabela: 'outubro',
      status: 'CONVERTIDO',
      validadeEm: 14,
      linhas: [
        { tipo: 'material', descricao: 'Barra de latão C360 Ø25', base: 'peca', quantidade: '1', custoUnitario: '8.00', itemId: id('item-latao') },
        { tipo: 'operacao', descricao: 'Torneamento CNC', centroId: centro('torno'), cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' }
      ],
      eventos: [['criado', 'RASCUNHO', 1, 2], ['enviado', 'ENVIADO', 1, 2], ['aprovado', 'APROVADO', 1, 1], ['convertido', 'CONVERTIDO', 1, 1, 'OS-2026-00041']]
    }
  ];

  const ano = 2026;
  const resultados: Record<number, string> = {};
  for (const orc of orcamentos) {
    const tabela = await db.tabelaCustos.findUniqueOrThrow({ where: { id: tabelas[orc.tabela].id } });
    const p = { lote: orc.lote, impostos: '0.14', comissao: orc.comissao ?? '0', margemAlvo: '0.20', margemMinima: '0.15', desconto: orc.desconto, metodo: 'divisor' as const };
    const { linhas, resultado } = calcular(orc.linhas, resultadoDe(tabela), p);
    const dataDe = (evento: string) => {
      const e = orc.eventos.find((x) => x[0] === evento);
      return e ? haDias(e[3]) : null;
    };
    const oid = id(`orcamento-${orc.n}`);
    const dados = {
      numero: formatarNumero(ano, orc.n),
      clienteId: id(`cliente-${orc.cliente}`),
      tabelaCustosId: tabela.id,
      titulo: orc.titulo,
      segmento: 'USINAGEM' as const,
      validade: dataEm(orc.validadeEm),
      observacoes: orc.observacoes ?? '',
      linhas: json(linhas),
      ...colunasDePrecificacao(p),
      ...colunasDoResultado(resultado),
      status: orc.status,
      versao: Math.max(...orc.eventos.map((e) => e[2])),
      margemLiberada: false,
      justificativaLiberacao: null,
      liberadaPorId: null,
      motivoRecusa: orc.motivoRecusa ?? null,
      enviadoEm: dataDe('enviado'),
      aprovadoEm: dataDe('aprovado'),
      recusadoEm: dataDe('recusado'),
      criadoEm: dataDe('criado')!,
      prazoPrometido: orc.prazoEm === undefined ? null : dataEm(orc.prazoEm),
      objeto: orc.objeto ? json(mesclarObjeto({}, orc.objeto)) : Prisma.DbNull,
      condicaoPagamento: orc.condicao ?? '',
      vendedorId: id('usuario-paulo')
    };
    await db.orcamento.upsert({ where: { id: oid }, create: { id: oid, tenantId, ...dados }, update: dados });
    await db.orcamentoHistorico.deleteMany({ where: { orcamentoId: oid } });
    await db.orcamentoHistorico.createMany({
      data: orc.eventos.map(([evento, status, versao, diasAtras, detalhe]) => ({
        tenantId,
        orcamentoId: oid,
        evento,
        status,
        versao,
        detalhe,
        precoFinalLote: pd(resultado.precoFinalLote),
        usuarioId: id(['aprovado', 'recusado', 'convertido'].includes(evento) ? 'usuario-marina' : 'usuario-paulo'),
        data: haDias(diasAtras)
      }))
    });
    resultados[orc.n] = resultado.precoFinalLote;
  }

  const chave = `ORC-${ano}`;
  const seq = await db.sequencia.findUnique({ where: { tenantId_chave: { tenantId, chave } } });
  if (!seq || seq.valor < 128) {
    await db.sequencia.upsert({ where: { tenantId_chave: { tenantId, chave } }, create: { tenantId, chave, valor: 128 }, update: { valor: 128 } });
  }

  const ordens = await semearOrdens(db, tenantId, id);
  const suprimentos = await semearSuprimentos(db, tenantId, id, { centroFresa: centro('fresa') });
  const manutencao = await semearManutencao(db, tenantId, id, { centros: { torno: centro('torno'), fresa: centro('fresa'), cu: centro('cu') }, box3 });
  const financeiro = await semearFinanceiro(db, tenantId, id, { centros: [centro('torno'), centro('fresa'), centro('cu')] });
  const crm = await semearCrm(db, tenantId, id);
  const agenda = await semearAgenda(db, tenantId, id, { box3, jonas, fresa: centro('fresa'), cliente: id('cliente-metalvale') });

  return {
    tenantId,
    emails: { gestor: `marina@${o.dominio}`, orcamentista: `paulo@${o.dominio}`, financeiro: `carla@${o.dominio}`, producao: `ricardo@${o.dominio}` },
    tabelaVigenteId: tabelas.outubro.id,
    centros: { torno: centro('torno'), fresa: centro('fresa'), cu: centro('cu') },
    clientes: Object.fromEntries(clientes.map((c) => [c.chave, id(`cliente-${c.chave}`)])) as Record<string, string>,
    orcamentoBuchaId: id('orcamento-128'),
    colaboradores: { ricardo: id('colab-ricardo'), diego: id('colab-diego'), anderson: id('colab-anderson') },
    ordens,
    box3,
    jonas,
    agenda,
    suprimentos,
    financeiro,
    crm,
    manutencao,
    orcamentoProvisorioId: id('orcamento-122'),
    precos: resultados
  };
}
