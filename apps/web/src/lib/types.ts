import type {
  CriterioRateio,
  ResultadoCustoReal,
  SituacaoDesvio,
  EntradaTabela,
  LinhaOrcamento,
  MetodoPreco,
  Ocorrencia,
  ResultadoOrcamento,
  ResultadoTabela,
  SituacaoMargem,
  StatusCentro,
  TipoCentro
} from '@promec/motor';

export type Papel = 'ADMIN' | 'GESTOR' | 'ORCAMENTISTA' | 'OPERADOR';
export interface Usuario { id: string; nome: string; email: string; papel: Papel }
export interface Me extends Usuario { empresa: { id: string; nome: string } }
export interface Lista<T> { itens: T[]; total: number }

export interface Parametros {
  nomeEmpresa: string;
  criterioRateio: CriterioRateio;
  metodoPreco: MetodoPreco;
  impostosPadrao: string;
  comissaoPadrao: string;
  margemAlvo: string;
  margemMinima: string;
  validadeOrcamentoDias: number;
}

export type Vinculo = 'CLT' | 'PJ' | 'HORISTA' | 'SOCIO';
export interface Colaborador {
  id: string;
  nome: string;
  funcao: string;
  vinculo: Vinculo;
  salario: string;
  encargos: string;
  beneficios: string;
  jornadaHoras: string;
  ativo: boolean;
  custoMensal: string;
  custoHora: string;
  alocacoes: { centroId: string; centroNome: string; alocacao: string }[];
}

export interface Operador { colaboradorId: string; nome: string; alocacao: string }
export interface Centro {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoCentro;
  status: StatusCentro;
  horasExpediente: string;
  eficiencia: string;
  manutencao: string;
  insumos: string;
  outros: string;
  valorAquisicao: string;
  valorResidual: string;
  vidaUtilMeses: number;
  potenciaKw: string;
  fatorCarga: string;
  tarifaKwh: string;
  pesoManual: string | null;
  areaM2: string | null;
  operadores: Operador[];
  custoHoraVigente: string | null;
  diasSemana?: number[];
  aviso?: string | null;
}

export type Categoria =
  | 'agua' | 'alarme' | 'aluguel' | 'contabilidade' | 'luz' | 'pessoalAdm' | 'pessoalComercial' | 'proLabore'
  | 'seguros' | 'sistemas' | 'tarifas' | 'taxasBancarias' | 'telefone' | 'treinamentos' | 'outros';
export interface Lancamento { id: string; categoria: Categoria; descricao: string; valor: string }
export interface CustoFixoMes { competencia: string; total: string; lancamentos: Lancamento[] }
export interface CompetenciaResumo { competencia: string; total: string; lancamentos: number | Lancamento[] }

export type StatusTabela = 'RASCUNHO' | 'VIGENTE' | 'ENCERRADA';
export interface TabelaResumo {
  id: string;
  competencia: string;
  versao: number;
  status: StatusTabela;
  desatualizada: boolean;
  publicadaEm: string | null;
  criadaEm: string;
  resumo: { custoFixo: string; centros: number; cheioMedio: string; bloqueios: number };
}
export interface Comparativo { centroId: string; nome: string; anterior: string; atual: string; variacao: string }
export interface TabelaDetalhe extends TabelaResumo {
  entrada: EntradaTabela;
  resultado: ResultadoTabela;
  comparativo?: Comparativo[];
}

export type TipoCliente = 'PF' | 'PJ';
export type StatusCliente = 'ATIVO' | 'BLOQUEADO' | 'INATIVO';
export interface Cliente {
  id: string;
  tipo: TipoCliente;
  documento: string;
  nome: string;
  fantasia: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  status: StatusCliente;
  observacoes: string;
  resumo?: { orcamentos: number; aprovados: number; valorAprovado: string };
}

export type StatusOrcamento = 'RASCUNHO' | 'ENVIADO' | 'EM_NEGOCIACAO' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO' | 'CONVERTIDO';
export type Segmento = 'OFICINA' | 'USINAGEM' | 'CALDEIRARIA';

type ComCentro<T> = T extends { tipo: 'operacao' | 'maoDeObra' }
  ? Omit<T, 'custoHora' | 'rateioHora'> & { centroId?: string; custoHora?: string; rateioHora?: string }
  : T;
/** Linha como trafega na API: operação e mão de obra levam centroId; a API completa o custo-hora. */
export type LinhaApi = ComCentro<LinhaOrcamento>;

export interface OrcamentoResumo {
  id: string;
  numero: string;
  titulo: string;
  cliente: { id: string; nome: string };
  lote: number;
  status: StatusOrcamento;
  versao: number;
  precoFinalLote: string;
  margemEfetiva: string;
  situacaoMargem: SituacaoMargem;
  validade: string;
  atualizadoEm: string;
}
export interface ListaOrcamentos extends Lista<OrcamentoResumo> { contagem: Partial<Record<StatusOrcamento, number>> }

export interface CabecalhoOrcamento {
  clienteId: string;
  titulo: string;
  segmento: Segmento;
  lote: number;
  validade: string;
  impostos: string;
  comissao: string;
  margemAlvo: string;
  margemMinima: string;
  desconto: string;
  metodo: MetodoPreco;
  observacoes: string;
}
export interface Orcamento extends CabecalhoOrcamento {
  id: string;
  numero: string;
  status: StatusOrcamento;
  versao: number;
  cliente?: { id: string; nome: string };
  linhas: LinhaApi[];
  tabelaCustos: { id: string; competencia: string; versao: number };
  tabelaMaisNova: boolean;
  prazoPrometido?: string | null;
  custoDesatualizado?: boolean;
  promessa?: Promessa | null;
  resultado: ResultadoOrcamento;
  historico: { versao: number; status: StatusOrcamento; precoFinalLote: string; data: string; evento?: string; detalhe?: string | null }[];
  exigeAprovacao?: boolean;
  margemLiberada?: boolean;
  justificativaLiberacao?: string | null;
  motivoRecusa?: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Painel {
  saudacao: string;
  usuario: string;
  tabelaVigente: { id: string; competencia: string; versao: number; desatualizada: boolean; cheioMedio: string } | null;
  orcamentos: { abertos: number; valorAberto: string; aprovadosMes: number; valorAprovadoMes: string; taxaConversao: string; abaixoDoMinimo: number };
  centros: { id: string; nome: string; tipo: TipoCentro; cheioHora: string; precoHora: string }[];
  alertas: { tipo: 'atencao' | 'perigo' | 'info' | 'ok'; mensagem: string; link?: string }[];
  ocupacao?: { centroId: string; nome: string; semanaAtual: string; proximaSemana: string }[];
  suprimentos?: { abaixoDoMinimo: number; valorEstoque: string; pedidosAguardando: number; recebimentosAtrasados: number };
  qualidade?: { ncsAbertas: number; custoNaoQualidadeMes: string; garantiasAbertas: number };
  ordens?: { emExecucao: number; pausadas: number; atrasadas: number; emQualidade: number; margemProjetadaMedia: string | null };
}

export type { Ocorrencia };

export type StatusOS = 'ABERTA' | 'EM_FILA' | 'EM_EXECUCAO' | 'PAUSADA' | 'CONTROLE_QUALIDADE' | 'CONCLUIDA' | 'ENTREGUE' | 'CANCELADA';
export type Prioridade = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';
export type MotivoPausa = 'FALTA_PECA' | 'AGUARDANDO_CLIENTE' | 'QUEBRA' | 'FALTA_OPERADOR' | 'OUTRO';
export type TipoApontamento = 'SETUP' | 'PRODUCAO';
type Nomeado = string | { id?: string; nome: string } | null;

export interface OSResumo {
  id: string;
  numero: string;
  titulo: string;
  segmento: Segmento;
  cliente: { id: string; nome: string };
  status: StatusOS;
  prioridade?: Prioridade;
  prazo: string | null;
  atrasada: boolean;
  progresso: string;
  centroAtual: Nomeado;
  operadorAtual: Nomeado;
  custoOrcado: string;
  custoProjetado: string;
  margemOrcada: string;
  margemProjetada: string;
  situacao: SituacaoDesvio;
  orcamento: { id: string; numero: string } | null;
}
export interface ListaOS extends Lista<OSResumo> { contagem: Partial<Record<StatusOS | 'ATRASADAS', number>> }

export interface ObjetoOS {
  desenho?: string | null; revisao?: string | null; material?: string | null;
  placa?: string | null; veiculo?: string | null; kmEntrada?: number | string | null; kmSaida?: number | string | null;
  projeto?: string | null;
}
export type StatusOperacao = 'PENDENTE' | 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA';
export interface OperacaoOS {
  id: string; sequencia: number; descricao: string; centroId: string; centroNome: string; colaboradorId: string | null; colaboradorNome: string | null;
  custoHora: string; setupOrcadoHoras: string; cicloOrcadoHorasPorPeca: string; setupRealHoras: string; producaoRealHoras: string;
  quantidadeBoa: number; refugo: number; setupConcluido: boolean; status: StatusOperacao; retrabalho: boolean;
}
export interface Apontamento {
  id: string; operacaoId: string; colaboradorId: string; colaboradorNome: string; tipo: TipoApontamento;
  inicio: string; fim: string | null; horas: string | null; quantidadeBoa: number; refugo: number; observacao: string | null;
}
export interface OcorrenciaOS { id: string; tipo: string; motivo: MotivoPausa | string | null; inicio: string; fim: string | null; horas: string | null; observacao: string | null }
export interface CustoOS { id: string; descricao: string; categoria: 'material' | 'ferramental' | 'terceiros' | 'frete'; orcado: string; real: string | null; doOrcamento?: boolean; justificativa?: string | null }
export interface InspecaoOS { id: string; aprovada: boolean; itens: { descricao: string; esperado?: string; medido?: string; conforme: boolean }[]; observacao: string | null; data?: string; criadaEm?: string }
export interface OrdemServico {
  id: string; numero: string; titulo: string; segmento: Segmento; status: StatusOS; prioridade: Prioridade; prazo: string | null; lote: number;
  precoFinalLote: string; impostos?: string; comissao?: string; margemMinima?: string; atrasada?: boolean; observacoes?: string | null;
  cliente: { id: string; nome: string }; orcamento: { id: string; numero: string } | null;
  objeto: ObjetoOS | null; operacoes: OperacaoOS[]; custos: CustoOS[]; apontamentos: Apontamento[]; ocorrencias: OcorrenciaOS[]; inspecoes: InspecaoOS[];
  historico: { evento?: string; detalhe?: string | null; status?: StatusOS; data: string }[];
  tabelaCustos: { id: string; competencia: string; versao: number } | null;
  resultado: ResultadoCustoReal;
  alertas: (string | { tipo?: 'perigo' | 'atencao'; codigo?: string; mensagem: string; operacaoId?: string })[];
  recebidoPor?: string | null;
  planoInspecaoId?: string | null;
  planoVersao?: number | null;
  planoInspecao?: PlanoInspecao | null;
  consumos?: Movimento[];
  reservas?: { id: string; itemId: string; codigo?: string; descricao: string; unidade?: string; quantidade: string; consumida: string; pendente: string; status: string }[];
  ncs?: { id: string; numero?: string; status: string; descricao?: string; origem?: string }[];
  garantiaDeId?: string | null;
  custoRealFinal?: string | null;
  desvioFinal?: string | null;
}
export interface FilaOperador {
  os: { id: string; numero: string; titulo: string; prazo: string | null; prioridade: Prioridade; status: StatusOS; lote: number; atrasada?: boolean };
  operacao: OperacaoOS;
  apontamentoAberto: Apontamento | null;
}

export interface RefPlano { tipo: 'OS' | 'ORCAMENTO'; id: string; numero: string; titulo: string; cliente: { id: string; nome: string } | string | null; status: string; prioridade?: Prioridade; segmento?: Segmento }
export interface OperacaoNoPlano { id: string; centroId: string; inicio: string | null; fim: string | null; horas: string; alocacao: { data: string; horas: string }[]; descricao: string; centroNome: string; sequencia?: number }
export interface OrdemNoPlano {
  id: string; posicao: number; inicio: string | null; fim: string | null; prazo: string | null; atrasoDias: number; atrasada: boolean; provisoria: boolean;
  prioridade?: Prioridade; ref: RefPlano; operacoes: OperacaoNoPlano[];
}
export interface CentroNoPlano {
  id: string; nome: string; tipo: TipoCentro;
  semanas: { inicio: string; capacidade: string; carga: string; ocupacao: string; sobrecarga: boolean }[];
  dias: { data: string; capacidade: string; carga: string }[];
}
export interface AlertaPlano { tipo: 'sobrecarga' | 'atraso'; centroId?: string; ordemId?: string; semana?: string; mensagem: string }
export interface Plano {
  hoje: string; ordens: OrdemNoPlano[]; centros: CentroNoPlano[];
  semDestino: { ordemId: string; operacaoId: string; motivo: string }[]; alertas: AlertaPlano[]; filaManual: boolean;
}
export interface Feriado { id: string; data: string; descricao: string }
export interface Parada { id: string; inicio: string; fim: string; motivo: string }
export interface Promessa { fim: string | null; ocupacaoMaxima: string; sobrecarga: boolean; alertas?: AlertaPlano[] }

export type StatusAgendamento = 'MARCADO' | 'CONFIRMADO' | 'CHEGOU' | 'NAO_VEIO' | 'CANCELADO';
export interface Agendamento {
  id: string; cliente: { id: string | null; nome: string } | null; nomeCliente?: string | null; telefone: string | null; placa: string | null; veiculo: string | null; servico: string;
  centroId: string; centroNome: string; colaboradorId: string | null; colaboradorNome: string | null; inicio: string; duracaoHoras: string | number;
  status: StatusAgendamento; osId: string | null; observacao: string | null;
}

export type TipoItem = 'MATERIA_PRIMA' | 'PECA_REPOSICAO' | 'INSUMO' | 'FERRAMENTA_GERAL' | 'FERRAMENTA_ESPECIFICA' | 'PRODUTO_ACABADO' | 'SERVICO_EXTERNO';
export interface Saldo { fisico: string; reservado: string; disponivel: string }
export interface Item {
  id: string; codigo: string; descricao: string; tipo: TipoItem; unidadeCompra: string; unidadeConsumo: string; fatorConversao: string;
  pesoPorMetroKg: string | null; custoMedio: string; ultimoCusto: string | null; precoVenda: string | null; margemPeca: string | null;
  estoqueMinimo: string; estoqueMaximo: string; fornecedorPreferidoId: string | null; rastreavel: boolean; categoriaDespesa: string | null; ativo: boolean;
  saldo: Saldo; classeABC: 'A' | 'B' | 'C' | null;
  abaixoDoMinimo?: boolean;
  fornecedores?: { fornecedorId: string; nome: string; ultimoPreco: string; data: string }[];
  saldosPorLocal?: { localId: string; localNome: string; fisico: string; reservado: string; disponivel: string }[];
}
export interface Fornecedor {
  id: string; tipo: TipoCliente; documento: string; nome: string; fantasia: string; email: string; telefone: string; cidade: string; uf: string;
  categorias: TipoItem[]; prazoMedioDias: number; condicaoPagamento: string; avaliacao: string; entregas: number; status: StatusCliente;
  itens?: { itemId: string; descricao: string; ultimoPreco: string; data: string }[];
}
export interface LocalEstoque { id: string; nome: string; tipo: 'ALMOXARIFADO' | 'PECAS' | 'MATERIA_PRIMA' | 'FERRAMENTARIA' }
export interface SaldoLocal {
  item: { id: string; codigo: string; descricao: string; unidade: string; tipo: TipoItem }; localId: string | null; localNome: string | null;
  fisico: string; reservado: string; disponivel: string; custoMedio: string; valor: string; minimo: string; situacao: 'ok' | 'baixo' | 'zerado';
}
export type TipoMovimento = 'ENTRADA' | 'ENTRADA_AVULSA' | 'SAIDA_OS' | 'SAIDA_CENTRO' | 'AJUSTE' | 'TRANSFERENCIA' | 'PERDA' | 'DEVOLUCAO' | 'ESTORNO' | string;
export interface Movimento {
  id: string; data: string; tipo: TipoMovimento; item: { id: string; codigo?: string; descricao: string; unidade?: string }; local: { id: string; nome: string } | string | null;
  quantidade: string; custoUnitario: string; valor: string; lote: { id: string; codigo: string } | string | null;
  origem: { tipo: 'OS' | 'CENTRO' | 'RECEBIMENTO' | 'AJUSTE' | 'INVENTARIO'; id: string | null; numero: string | null } | null; usuario: string | { nome: string } | null; observacao: string | null; estornado?: boolean;
}
export interface Lote {
  id: string; codigo: string; itemId: string; fornecedor: { id: string; nome: string } | string | null; recebimentoId: string | null; data: string;
  quantidadeInicial: string; saldo: string; certificado: { numero: string; corrida?: string; norma?: string; observacao?: string } | null;
}
export interface ConsumoCentro { centroId: string; nome: string; consumido: string; insumosCadastro: string; diferenca: string }
export interface LinhaABC { id: string; descricao?: string; codigo?: string; valor: string; participacao: string; acumulado: string; classe: 'A' | 'B' | 'C' }

export type StatusRequisicao = 'ABERTA' | 'EM_COTACAO' | 'ATENDIDA' | 'CANCELADA';
export interface Requisicao {
  id: string; numero?: string; status: StatusRequisicao; origem: 'OS' | 'PONTO_PEDIDO' | 'MANUAL'; criadaEm?: string; criadoEm?: string; cotacaoId?: string | null; pedidoId?: string | null; data?: string; observacao?: string | null;
  os?: { id: string; numero: string } | null;
  itens: { itemId: string; descricao?: string; codigo?: string; unidade?: string; quantidade: string; item?: { id: string; descricao: string; codigo?: string; unidade?: string } }[];
}
export interface Cotacao {
  id: string; numero?: string; status?: string; criadaEm?: string;
  requisicaoIds?: string[];
  itens: { itemId: string; descricao: string; quantidade: string; unidade?: string; custoMedio?: string }[];
  fornecedores: { id: string; nome: string; avaliacao?: string; prazoMedioDias?: number }[];
  respostas: { fornecedorId: string; itens: { itemId: string; precoUnitario: string }[]; frete: string; prazoDias: number }[];
  comparativo?: unknown;
  escolhido?: { fornecedorId: string; justificativa?: string | null } | null; pedidoId?: string | null;
}
export type StatusPedido = 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'PARCIAL' | 'RECEBIDO' | 'CANCELADO';
export interface Pedido {
  id: string; numero: string; status: StatusPedido; fornecedor: { id: string; nome: string; condicaoPagamento?: string; prazoMedioDias?: number };
  total: string; frete?: string; previsao?: string | null; previsaoEntrega?: string | null; atrasado?: boolean; condicaoPagamento?: string; criadoEm?: string; cotacaoId?: string | null;
  itens: { itemId: string; descricao: string; codigo?: string; unidade?: string; quantidade: string; recebido?: string; pendente?: string; precoUnitario: string; rastreavel?: boolean; custoMedio?: string; saldo?: string }[];
  recebimentos?: { id: string; data: string; notaFiscal?: string | null; divergencias?: unknown[]; alertas?: unknown[]; noPrazo?: boolean; contaPagar?: { valor: string; vencimento: string; categoria: string } | null }[];
}

export type TipoItemPlano = 'DIMENSIONAL' | 'VISUAL' | 'SOLDA' | 'CHECK';
export interface ItemPlano { id?: string; descricao: string; tipo: TipoItemPlano; nominal?: string | null; tolInferior?: string | null; tolSuperior?: string | null; unidade?: string | null; instrumento?: string | null }
export interface PlanoInspecao { id: string; nome: string; segmento: Segmento; versao: number; ativo: boolean; exigeInspecao: boolean; itens: ItemPlano[] }
export type OrigemNC = 'MATERIAL' | 'PROCESSO' | 'OPERADOR' | 'PROJETO' | 'FORNECEDOR';
export interface NaoConformidade {
  id: string; numero?: string; origem: OrigemNC; descricao: string; status: 'ABERTA' | 'EM_TRATAMENTO' | 'ENCERRADA';
  os?: { id: string; numero: string } | null; centro?: { id: string; nome: string } | null; lote?: { id: string; codigo: string } | null; fornecedor?: { id: string; nome: string } | null;
  colaborador?: { id: string; nome: string } | null; causa?: string | null; acaoCorretiva?: string | null; responsavel?: { id: string; nome: string } | null; responsavelId?: string | null;
  prazo?: string | null; eficaz?: boolean | null; criadaEm?: string; encerradaEm?: string | null; recorrencia?: boolean;
}
export interface Garantia {
  id: string; os: { id: string; numero: string; titulo?: string; cliente?: { nome: string } | string }; relato: string; status: string; procedente?: boolean | null; analise?: string | null;
  criadaEm?: string; osGarantia?: { id: string; numero: string } | null;
}
