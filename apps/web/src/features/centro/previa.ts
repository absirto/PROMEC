import { calcularTabelaCustos, type CriterioRateio, type EntradaCentro, type Ocorrencia, type ResultadoCentro, type ResultadoTabela, type StatusCentro, type TipoCentro } from '@promec/motor';
import { toNum } from '../../lib/format';
import type { Colaborador } from '../../lib/types';

export interface CentroForm {
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
  vidaUtilMeses: string;
  potenciaKw: string;
  fatorCarga: string;
  tarifaKwh: string;
  pesoManual: string;
  areaM2: string;
  operadores: { colaboradorId: string; nome: string; alocacao: string }[];
}

const z = (v: string | null | undefined) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? '0' : v);

/**
 * Recalcula o custo-hora deste centro com o motor, usando os valores do formulário e os demais centros da prévia.
 * Os outros centros entram só com o peso no rateio (horas reais ou a fatia atual, conforme o critério).
 */
export function previaCentro(
  f: CentroForm,
  idAtual: string,
  colaboradores: Map<string, Colaborador>,
  previa: ResultadoTabela | undefined
): { centro: ResultadoCentro | null; ocorrencias: Ocorrencia[]; erro: string | null } {
  const criterio: CriterioRateio = previa?.criterioRateio ?? 'horas';
  const porHoras = criterio === 'horas';
  const anterior = previa?.centros.find((c) => c.id === idAtual);
  const atual: EntradaCentro = {
    id: idAtual,
    nome: f.nome || 'Este centro',
    tipo: f.tipo,
    status: f.status,
    horasExpediente: z(f.horasExpediente),
    eficiencia: z(f.eficiencia),
    maoDeObra: f.operadores
      .filter((o) => o.colaboradorId)
      .map((o) => {
        const c = colaboradores.get(o.colaboradorId);
        return { colaboradorId: o.colaboradorId, nome: c?.nome ?? o.nome, salario: z(c?.salario), encargos: z(c?.encargos), beneficios: z(c?.beneficios), alocacao: z(o.alocacao) };
      }),
    manutencao: z(f.manutencao),
    insumos: z(f.insumos),
    outros: z(f.outros),
    ativo: toNum(f.valorAquisicao) > 0 ? { valorAquisicao: z(f.valorAquisicao), valorResidual: z(f.valorResidual), vidaUtilMeses: z(f.vidaUtilMeses) } : undefined,
    energia: toNum(f.potenciaKw) > 0 ? { potenciaKw: z(f.potenciaKw), fatorCarga: z(f.fatorCarga), tarifaKwh: z(f.tarifaKwh) } : undefined,
    pesoManual: porHoras ? undefined : z(anterior?.pesoRateio)
  };
  const outros: EntradaCentro[] = (previa?.centros ?? [])
    .filter((c) => c.id !== idAtual)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      horasExpediente: String(toNum(c.horasReais) * 2),
      eficiencia: '0.5',
      maoDeObra: [],
      manutencao: '0',
      insumos: '0',
      pesoManual: porHoras ? undefined : c.pesoRateio
    }));
  try {
    const r = calcularTabelaCustos({ custoFixoTotal: previa?.custoFixoTotal ?? '0', criterioRateio: porHoras ? 'horas' : 'manual', centros: [atual, ...outros] });
    const ocorrencias = [...r.bloqueios, ...r.avisos].filter((o) => o.centroId === idAtual);
    return { centro: r.centros.find((c) => c.id === idAtual) ?? null, ocorrencias, erro: null };
  } catch (e) {
    return { centro: null, ocorrencias: [], erro: e instanceof Error ? e.message : 'Não deu para calcular com esses números.' };
  }
}
