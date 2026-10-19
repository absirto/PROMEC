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
  custoRealFinal?: string | null;
  desvioFinal?: string | null;
}
export interface FilaOperador {
  os: { id: string; numero: string; titulo: string; prazo: string | null; prioridade: Prioridade; status: StatusOS; lote: number; atrasada?: boolean };
  operacao: OperacaoOS;
  apontamentoAberto: Apontamento | null;
}
