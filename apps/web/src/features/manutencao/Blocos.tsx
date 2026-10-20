import { Link } from 'react-router-dom';
import { Pencil, TriangleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { HistoricoCustos } from '../../lib/types';
import { brl, data, horas, mesNome, pct, toNum } from '../../lib/format';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { AnelPreventiva } from './AnelPreventiva';
import { GraficoCustos } from './GraficoCustos';
import { StatusOrdemPill } from './OrdemSheet';
import { anelPreventiva, depreciacaoMes, numCurto, ORIGEM_ORDEM, SITUACAO, TIPO_ORDEM, type IndicadoresCentro, type Ordem, type Plano, type Substituicao } from './manutencao';
import { compararSubstituicao } from '@promec/motor';

/** Um plano preventivo com o anel da situação, o intervalo e a ordem aberta. */
export function PlanoCard({ p, onEditar, onAbrirOrdem }: { p: Plano; onEditar?: () => void; onAbrirOrdem?: (id: string) => void }) {
  const a = anelPreventiva(p.tipo, p.situacao);
  const base = p.tipo === 'HORAS' ? `a cada ${numCurto(p.intervaloHoras)} h de uso · ${numCurto(p.horasDesdeUltima)} h desde a última` : `a cada ${p.intervaloDias} dias${p.situacao.proximaData ? ` · próxima ${data(p.situacao.proximaData)}` : ''}`;
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-3 rounded-field border border-border bg-surface-1 ${p.ativo ? '' : 'opacity-70'}`}>
      <AnelPreventiva tipo={p.tipo} situacao={p.situacao} inativo={!p.ativo} />
      <div className="flex-[1_1_200px] min-w-0 flex flex-col gap-0.5">
        <span className="font-semibold break-words">{p.nome}</span>
        <span className="text-caption text-ink-3">{base}</span>
        <span className="text-[13.5px] flex flex-wrap items-center gap-2">
          {p.ativo ? <Pill tom={a.tom}>{SITUACAO[p.situacao.situacao]?.[0] ?? p.situacao.situacao}</Pill> : <Pill tom="neutral">Pausado</Pill>}
          {p.ativo && <span className={a.tom === 'bad' ? 'text-bad font-medium' : a.tom === 'warn' ? 'text-warn font-medium' : 'text-ink-2'}>{a.texto}</span>}
          {p.checklist.length > 0 && <span className="text-caption text-ink-3">· {p.checklist.length} item(ns) no checklist</span>}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {p.ordemAberta && (onAbrirOrdem
          ? <button type="button" onClick={() => onAbrirOrdem(p.ordemAberta!.id)} className="mono text-[13.5px] font-medium text-primary-text underline underline-offset-2">{p.ordemAberta.numero}</button>
          : <Link to={`/manutencao?aba=ordens&busca=${encodeURIComponent(p.ordemAberta.numero)}`} className="mono text-[13.5px] font-medium">{p.ordemAberta.numero}</Link>)}
        {onEditar && <Button tamanho="sm" variante="terciario" icone={Pencil} onClick={onEditar} aria-label={`Editar ${p.nome}`}>Editar</Button>}
      </div>
    </li>
  );
}

/** Lista compacta de ordens: número, o quê, centro, tipo, parada, custo e situação. */
export function ListaOrdens({ ordens, onAbrir, mostrarCentro = true }: { ordens: Ordem[]; onAbrir: (o: Ordem) => void; mostrarCentro?: boolean }) {
  return (
    <ul className="m-0 p-0 list-none">
      {ordens.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-t border-border first:border-t-0">
          <button type="button" onClick={() => onAbrir(o)} aria-label={`Abrir ${o.numero}: ${o.descricao}`}
            className="flex-[1_1_240px] min-w-0 text-left flex flex-col gap-0.5 rounded-control -mx-2 px-2 py-1 hover:bg-surface-2">
            <span className="text-caption text-ink-3">
              <span className="mono">{o.numero}</span> · {TIPO_ORDEM[o.tipo] ?? o.tipo} {ORIGEM_ORDEM[o.origem] ?? ''}
              {mostrarCentro && o.centroNome && ` · ${o.centroNome}`}
            </span>
            <span className="font-medium break-words">{o.descricao}</span>
          </button>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
            {o.prevista && <span className="text-ink-3">prevista <span className="mono">{data(o.prevista)}</span></span>}
            {o.horasParado != null && <span className="text-ink-3">parado <span className="mono">{horas(o.horasParado, 1)}</span></span>}
            <span className="mono font-semibold">{brl(o.custoTotal)}</span>
            <StatusOrdemPill status={o.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Ind({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="p-3 rounded-field bg-surface-2 min-w-0">
      <dt className="text-caption text-ink-3">{rotulo}</dt>
      <dd className="m-0 mono text-[20px] font-bold leading-tight">{valor}</dd>
      {sub && <dd className="m-0 text-[12px] text-ink-2">{sub}</dd>}
    </div>
  );
}

/** Indicadores de um centro: MTBF, MTTR, disponibilidade, custo por hora, gráfico e comparação com a categoria. */
export function IndicadorCentroCard({ c, centro }: { c: IndicadoresCentro; centro?: { valorAquisicao?: string; valorResidual?: string; vidaUtilMeses?: number } }) {
  const i = c.indicadores;
  const dif = toNum(c.diferenca);
  let subst: Substituicao | null = c.alerta?.substituicao ?? null;
  if (!subst && centro && toNum(centro.valorAquisicao) > 0) {
    try {
      subst = compararSubstituicao({
        manutencaoAtualMes: c.media6, depreciacaoAtualMes: String(depreciacaoMes(centro.valorAquisicao, centro.valorResidual, centro.vidaUtilMeses || 60)),
        valorNovo: centro.valorAquisicao ?? '0', vidaUtilNovoMeses: String(centro.vidaUtilMeses || 60), residualNovo: centro.valorResidual ?? '0', manutencaoNovoMes: c.mediaCategoria
      });
    } catch { subst = null; }
  }
  return (
    <article className="card p-5 flex flex-col gap-4 min-w-0" aria-labelledby={`ind-${c.centro.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <h3 id={`ind-${c.centro.id}`} className="m-0 text-[18px] font-semibold"><Link to={`/centros-trabalho/${c.centro.id}`} className="text-ink-1 no-underline hover:underline">{c.centro.nome}</Link></h3>
          {c.centro.codigo && <span className="mono text-caption text-ink-3">{c.centro.codigo}</span>}
        </div>
        {c.alerta && <Pill tom="bad" icone={TriangleAlert}>Acima da categoria</Pill>}
      </div>
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Ind rotulo="MTBF" valor={i.mtbf != null ? horas(i.mtbf, 0) : '—'} sub={i.quebras ? `${i.quebras} quebra(s)` : 'sem quebras no período'} />
        <Ind rotulo="MTTR" valor={i.mttr != null ? horas(i.mttr, 1) : '—'} sub={`${horas(i.horasParado, 1)} parado`} />
        <Ind rotulo="Disponibilidade" valor={pct(i.disponibilidade)} />
        <Ind rotulo="Custo por hora produzida" valor={i.custoPorHoraProduzida != null ? brl(i.custoPorHoraProduzida) : '—'} />
      </dl>
      <GraficoCustos meses={c.custoPorMes} media6={c.media6} media12={c.media12} cadastro={c.cadastro} />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        <span>No cadastro <strong className="mono">{brl(c.cadastro)}</strong>/mês</span>
        <span>Média real (6 meses) <strong className="mono">{brl(c.media6)}</strong>
          {Math.abs(dif) >= 0.5 && <span className={`mono ml-1 ${dif > 0 ? 'text-bad' : 'text-ok'}`}>({dif > 0 ? '+' : '−'}{brl(Math.abs(dif))})</span>}
        </span>
        <span className="text-ink-2">Média da categoria <span className="mono">{brl(c.mediaCategoria)}</span></span>
      </div>
      {c.alerta && <p role="status" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{c.alerta.mensagem.replace(/(\d+)\.(\d{2})/g, '$1,$2')}</p>}
      {subst && (
        <div className="p-3 rounded-field bg-surface-2 flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Manter ou substituir?</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13.5px]">
            <span>Manter o atual <strong className="mono block">{brl(subst.atualMes)}/mês</strong></span>
            <span>Ativo novo de mesmo valor <strong className="mono block">{brl(subst.novoMes)}/mês</strong></span>
            <span>{toNum(subst.economiaMes) >= 0 ? 'Economia trocando' : 'Custo a mais trocando'} <strong className={`mono block ${subst.vale ? 'text-ok' : ''}`}>{brl(Math.abs(toNum(subst.economiaMes)))}/mês</strong></span>
          </div>
          <span className="text-caption text-ink-2">{subst.vale ? 'Pelos números, um ativo novo sai mais barato por mês. Vale cotar.' : 'Pelos números, manter o atual ainda compensa.'} Depreciação mais manutenção; a do novo usa a média da categoria.</span>
        </div>
      )}
    </article>
  );
}

/** Custo de manutenção do centro mês a mês, a partir do histórico de custos diretos. */
export function CustoManutencaoCentro({ centroId, cadastro }: { centroId: string; cadastro: string }) {
  const q = useQuery({ queryKey: ['centros-trabalho', centroId, 'historico-custos'], queryFn: () => api<HistoricoCustos>(`/centros-trabalho/${centroId}/historico-custos`, { query: { meses: 6 } }), retry: false });
  if (!q.data?.meses?.length) return null;
  const meses = q.data.meses.map((m) => {
    const comp = (m.componentes ?? (m as unknown as Record<string, string>)) as Record<string, string | undefined>;
    const man = toNum(comp.manutencao);
    return { competencia: m.competencia, valor: String(man), total: toNum(m.total), parte: toNum(m.total) > 0 ? man / toNum(m.total) : 0 };
  });
  const media = q.data.mediaProposta?.manutencao ?? String(meses.reduce((a, m) => a + toNum(m.valor), 0) / meses.length);
  const totalMan = meses.reduce((a, m) => a + toNum(m.valor), 0);
  const totalGeral = meses.reduce((a, m) => a + m.total, 0);
  return (
    <div className="flex flex-col gap-3">
      <GraficoCustos meses={meses} media6={media} rotuloMedia={`Média de ${meses.length} meses`} cadastro={cadastro} />
      <p className="m-0 text-[14px] text-ink-2">
        Nos últimos {meses.length} meses a manutenção somou <strong className="mono text-ink-1">{brl(totalMan)}</strong>
        {totalGeral > 0 && <>, {pct(totalMan / totalGeral, 0)} de todo o gasto direto do centro</>}. Mês mais caro: {(() => { const m = [...meses].sort((a, b) => toNum(b.valor) - toNum(a.valor))[0]!; return <span className="mono">{mesNome(m.competencia)} ({brl(m.valor)})</span>; })()}.
      </p>
    </div>
  );
}
