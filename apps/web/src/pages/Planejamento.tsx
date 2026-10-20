import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CalendarOff, GripVertical, Plus, RotateCcw, Save, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Feriado, OrdemNoPlano, Parada, Plano } from '../lib/types';
import { data, horas, pct, toNum } from '../lib/format';
import { useAcao, useCentros } from '../lib/queries';
import { HeroBand } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { Select, TextField } from '../components/Field';
import { useTitulo } from '../layout/titulo';
import { diasDaSemana, diasEntre, entradaDoPlano, moverItem, previaReordenada, rotuloDia, rotuloSemana, somarDias, tomOcupacao } from '../features/planejamento/plano';

const CORES = ['#1D6FB8', '#0F9D76', '#7C5CC4', '#E0A100', '#0E7C86', '#C0352B', '#5B6B7F'];
const FUNDO = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad' };
const BARRA = { ok: 'bg-ok', warn: 'bg-signal', bad: 'bg-bad' };
const HACHURA = 'repeating-linear-gradient(-45deg, var(--pm-border-strong) 0 2px, transparent 2px 7px)';
const DIAS_GANTT = 28;
const nomeCliente = (c: OrdemNoPlano['ref']['cliente']) => (c == null ? '' : typeof c === 'string' ? c : c.nome);
const parada = (ps: Parada[] | undefined, de: string, ate: string) => (ps ?? []).find((p) => p.inicio.slice(0, 10) <= ate && p.fim.slice(0, 10) >= de);

export default function Planejamento() {
  useTitulo('Planejamento e Agenda');
  const { pode } = useAuth();
  const podeMexer = pode('planejamento.gerenciar');
  const q = useQuery({ queryKey: ['planejamento'], queryFn: () => api<Plano>('/planejamento', { query: { horizonte: 60 } }) });
  const centrosQ = useCentros();
  const feriadosQ = useQuery({ queryKey: ['feriados'], queryFn: () => api<Feriado[] | { itens: Feriado[] }>('/feriados') });
  const plano = q.data;
  const paradasQ = useQueries({
    queries: (plano?.centros ?? []).map((c) => ({ queryKey: ['paradas', c.id], queryFn: () => api<Parada[] | { itens: Parada[] }>(`/centros-trabalho/${c.id}/paradas`) }))
  });
  const feriados = useMemo(() => { const f = feriadosQ.data; return Array.isArray(f) ? f : f?.itens ?? []; }, [feriadosQ.data]);
  const versaoParadas = paradasQ.map((p) => p.dataUpdatedAt).join();
  const paradas = useMemo(
    () => new Map((plano?.centros ?? []).map((c, i) => { const d = paradasQ[i]?.data; return [c.id, Array.isArray(d) ? d : d?.itens ?? []] as const; })),
    [plano, versaoParadas]
  );

  const [ordemLocal, setOrdemLocal] = useState<string[] | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [semana, setSemana] = useState<string | null>(null);
  const [feriadosAberto, setFeriadosAberto] = useState(false);
  useEffect(() => setOrdemLocal(null), [plano]);

  const corCentro = useMemo(() => new Map((plano?.centros ?? []).map((c, i) => [c.id, CORES[i % CORES.length]!])), [plano]);
  const ordensServidor = plano?.ordens ?? [];
  const idsOS = ordensServidor.filter((o) => !o.provisoria).map((o) => o.id);

  const previa = useMemo(() => {
    if (!plano || !ordemLocal || !centrosQ.data) return null;
    const base = new Map<string, { horasExpediente: string; eficiencia: string }>();
    try {
      return previaReordenada(entradaDoPlano(plano, centrosQ.data.itens, base, feriados.map((f) => f.data.slice(0, 10)), paradas), ordemLocal);
    } catch {
      return null;
    }
  }, [plano, ordemLocal, centrosQ.data, feriados, paradas]);

  const porId = new Map(ordensServidor.map((o) => [o.id, o]));
  const fila: OrdemNoPlano[] = previa
    ? previa.ordens.map((p) => ({ ...porId.get(p.id)!, ...p, operacoes: p.operacoes.map((op) => ({ ...porId.get(p.id)!.operacoes.find((x) => x.id === op.id)!, ...op })) })).filter((o) => o.ref)
    : ordensServidor;
  const centrosVista = previa ? previa.centros.map((c) => ({ ...plano!.centros.find((x) => x.id === c.id)!, ...c })) : plano?.centros ?? [];
  const alertas = previa ? previa.alertas : plano?.alertas ?? [];
  const sujo = !!ordemLocal && ordemLocal.join() !== idsOS.join();

  const qc = useQueryClient();
  const aplicar = (r: Plano) => { if (r?.ordens) qc.setQueryData(['planejamento'], r); };
  const salvar = useAcao(() => api<Plano>('/planejamento/fila', { method: 'PUT', body: { ordem: ordemLocal } }), {
    invalida: [['painel'], ['ordens-servico']],
    onSuccess: aplicar,
    sucesso: 'Fila gravada. As datas abaixo já são as oficiais.'
  });
  const automatico = useAcao(() => api<Plano>('/planejamento/fila', { method: 'DELETE' }), {
    invalida: [['painel']],
    onSuccess: aplicar,
    sucesso: 'De volta ao automático: atrasadas primeiro, depois prioridade e prazo.'
  });

  const mover = (id: string, delta: number) => {
    const atual = ordemLocal ?? idsOS;
    const i = atual.indexOf(id);
    if (i < 0) return;
    setOrdemLocal(moverItem(atual, i, i + delta));
  };
  const soltarEm = (alvo: string) => {
    if (!arrastando || arrastando === alvo) return;
    const atual = ordemLocal ?? idsOS;
    setOrdemLocal(moverItem(atual, atual.indexOf(arrastando), atual.indexOf(alvo)));
  };

  if (q.isLoading) return <Card><Carregando /></Card>;
  if (q.isError || !plano) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;

  const semanas = centrosVista[0]?.semanas.slice(0, 8).map((s) => s.inicio) ?? [];
  const nSobre = alertas.filter((a) => a.tipo === 'sobrecarga').length;
  const nAtraso = alertas.filter((a) => a.tipo === 'atraso').length;
  const diasGantt = Array.from({ length: DIAS_GANTT }, (_, i) => somarDias(plano.hoje, i));
  const ordemOS = ordemLocal ?? idsOS;

  return (
    <>
      <HeroBand
        ilustracao="engrenagens"
        titulo="Quem faz o quê, e quando"
        texto={
          nSobre || nAtraso
            ? `${nSobre ? `${nSobre} ${nSobre === 1 ? 'semana passa' : 'semanas passam'} de 90% em algum centro` : 'Nenhuma semana sobrecarregada'}${nAtraso ? ` e ${nAtraso} ${nAtraso === 1 ? 'ordem termina' : 'ordens terminam'} depois do prazo` : ''}. Arraste a fila para ver o efeito antes de gravar.`
            : 'A fila cabe na capacidade e tudo sai no prazo. Bom momento para prometer datas.'
        }
        acoes={
          <>
            <Button variante="vidro" icone={CalendarOff} onClick={() => setFeriadosAberto(true)}>Feriados</Button>
            <Button variante="vidro" to="/agenda">Agenda da oficina</Button>
          </>
        }
      />

      {alertas.length > 0 && (
        <Aviso tom={nAtraso ? 'bad' : 'warn'} faixa titulo={previa ? 'Com a nova ordem, fica assim' : 'O que pede atenção'}>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {alertas.slice(0, 8).map((a, i) => {
              const o = a.ordemId ? fila.find((x) => x.id === a.ordemId) : undefined;
              return (
                <li key={i} className="flex gap-2 items-start">
                  <TriangleAlert className={`size-4 mt-0.5 flex-none ${a.tipo === 'atraso' ? 'text-bad' : 'text-warn'}`} aria-hidden />
                  <span>{o && !a.mensagem.startsWith(o.ref.numero) && <strong className="mono">{o.ref.numero}: </strong>}{a.mensagem}</span>
                </li>
              );
            })}
          </ul>
        </Aviso>
      )}

      <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-carga">
        <CardHeader id="h-carga" titulo="Carga × capacidade" sub="Horas comprometidas sobre as horas reais de cada centro, semana a semana. Toque numa semana para ver os dias." />
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full border-separate border-spacing-1 min-w-[640px]">
            <thead>
              <tr>
                <th scope="col" className="text-left text-[13px] font-semibold text-ink-2 pr-2">Centro</th>
                {semanas.map((s) => (
                  <th key={s} scope="col" className="text-[12px] font-semibold text-ink-3 mono whitespace-nowrap">{rotuloSemana(s)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {centrosVista.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="text-left text-[14px] font-medium pr-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: corCentro.get(c.id) }} aria-hidden />{c.nome}</span>
                  </th>
                  {c.semanas.slice(0, 8).map((s) => {
                    const t = tomOcupacao(s.ocupacao);
                    // Capacidade abaixo da semana cheia: férias, ausências ou paradas tiraram horas.
                    const cheia = Math.max(...c.semanas.slice(0, 8).map((x) => toNum(x.capacidade)));
                    const reducao = cheia > 0 ? 1 - toNum(s.capacidade) / cheia : 0;
                    const p = parada(paradas.get(c.id), s.inicio, somarDias(s.inicio, 6));
                    return (
                      <td key={s.inicio} className="p-0">
                        <button
                          type="button"
                          onClick={() => setSemana(semana === s.inicio ? null : s.inicio)}
                          aria-pressed={semana === s.inicio}
                          aria-label={`${c.nome}, semana ${rotuloSemana(s.inicio)}: ${pct(s.ocupacao, 0)} ocupado${reducao > 0.05 ? `, capacidade ${pct(reducao, 0)} menor` : ''}${s.sobrecarga ? ', sobrecarga' : ''}${p ? `, parada: ${p.motivo}` : ''}`}
                          title={`${horas(s.carga, 1)} de ${horas(s.capacidade, 1)}${reducao > 0.05 ? ` · capacidade ${pct(reducao, 0)} menor (ausências ou paradas)` : ''}${p ? ` · parada: ${p.motivo}` : ''}`}
                          className={`relative w-full h-14 rounded-control overflow-hidden flex flex-col items-center justify-center ${FUNDO[t]} ${semana === s.inicio ? 'ring-2 ring-ink-1' : ''}`}
                          style={p ? { backgroundImage: HACHURA } : undefined}
                        >
                          {s.sobrecarga && <span className="hazard absolute inset-x-0 top-0 h-1.5" aria-hidden />}
                          <span className="mono text-[15px] font-bold">{toNum(s.capacidade) === 0 && toNum(s.carga) === 0 ? '—' : pct(s.ocupacao, 0)}</span>
                          {reducao > 0.05 && <span className="text-[10.5px] font-semibold leading-none text-warn">{toNum(s.capacidade) === 0 ? 'sem capacidade' : `cap. −${pct(reducao, 0)}`}</span>}
                          <span className="absolute inset-x-1.5 bottom-1 h-1 rounded-full bg-surface-1/60"><span className={`block h-full rounded-full ${BARRA[t]}`} style={{ width: `${Math.min(100, toNum(s.ocupacao) * 100)}%` }} /></span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 text-caption text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-ok" />até 75%</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-signal" />75 a 90%</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-bad" />acima de 90%</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-5 h-3 rounded" style={{ backgroundImage: HACHURA }} />parada</span>
        </div>
        {semana && (
          <div className="rounded-field bg-surface-2 p-4 flex flex-col gap-3 anim-subir" aria-label={`Dias da semana ${rotuloSemana(semana)}`}>
            <strong className="text-[15px]">Semana {rotuloSemana(semana)}, dia a dia</strong>
            {centrosVista.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,140px)_repeat(7,minmax(0,1fr))] gap-1 items-end">
                <span className="text-[13px] truncate">{c.nome}</span>
                {diasDaSemana(semana).map((d) => {
                  const dia = c.dias.find((x) => x.data === d);
                  const cap = toNum(dia?.capacidade), carga = toNum(dia?.carga);
                  const parado = parada(paradas.get(c.id), d, d);
                  const t = tomOcupacao(cap ? carga / cap : carga ? 9 : 0);
                  return (
                    <div key={d} className="flex flex-col items-center gap-0.5" title={dia ? `${horas(carga, 1)} de ${horas(cap, 1)}` : 'fora do horizonte'}>
                      <div className="w-full h-12 rounded-md bg-surface-3 relative overflow-hidden" style={parado || (!cap && dia) ? { backgroundImage: HACHURA } : undefined}>
                        {cap > 0 && <span className={`absolute bottom-0 inset-x-0 ${BARRA[t]}`} style={{ height: `${Math.min(100, (carga / cap) * 100)}%` }} />}
                      </div>
                      <span className="mono text-[10.5px] text-ink-3">{rotuloDia(d).split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden" aria-labelledby="h-fila">
        <div className="px-5 pt-5 pb-3 flex flex-col gap-3">
          <CardHeader
            id="h-fila"
            titulo="Fila de produção"
            sub={plano.filaManual ? 'Ordem definida à mão. As provisórias reservam capacidade atrás das OS.' : 'Ordem automática: atrasadas primeiro, depois prioridade e prazo.'}
            acao={plano.filaManual && podeMexer && !sujo && <Button tamanho="sm" icone={RotateCcw} carregando={automatico.isPending} onClick={() => automatico.mutate(undefined)}>Voltar ao automático</Button>}
          />
          {sujo && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-field bg-info-soft" role="status">
              <span className="flex-1 min-w-[200px] text-[14px]">Prévia: as datas abaixo já consideram a nova ordem. Nada foi gravado ainda.</span>
              <Button tamanho="sm" icone={Undo2} onClick={() => setOrdemLocal(null)}>Descartar</Button>
              <Button tamanho="sm" variante="primario" icone={Save} carregando={salvar.isPending} onClick={() => salvar.mutate(undefined, { onError: () => qc.invalidateQueries({ queryKey: ['planejamento'] }) })} disabled={!podeMexer}>Gravar a fila</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-caption text-ink-2">
            {centrosVista.map((c) => <span key={c.id} className="inline-flex items-center gap-1.5"><span className="w-4 h-2 rounded" style={{ background: corCentro.get(c.id) }} />{c.nome}</span>)}
            <span className="text-ink-3">· barras: próximos {DIAS_GANTT} dias</span>
          </div>
        </div>
        {fila.length === 0 ? (
          <p className="m-0 px-5 pb-5 text-ink-2">Nada na fila. Quando um orçamento for aprovado, ele já reserva espaço aqui.</p>
        ) : (
          <ol className="m-0 p-0 list-none" aria-label="Fila de produção">
            {fila.map((o) => {
              const i = ordemOS.indexOf(o.id);
              const os = !o.provisoria;
              const href = o.ref.tipo === 'OS' ? `/ordens-servico/${o.ref.id}` : `/orcamentos/${o.ref.id}`;
              return (
                <li
                  key={o.id}
                  draggable={os && podeMexer}
                  onDragStart={(e: DragEvent) => { setArrastando(o.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { if (os && arrastando) { e.preventDefault(); soltarEm(o.id); } }}
                  onDragEnd={() => setArrastando(null)}
                  className={`px-4 sm:px-5 py-3.5 border-t border-border flex flex-col gap-2 ${arrastando === o.id ? 'opacity-60 bg-surface-2' : ''} ${o.provisoria ? 'bg-surface-2' : ''}`}
                  style={o.provisoria ? { outline: '2px dashed var(--pm-border-strong)', outlineOffset: '-6px' } : undefined}
                >
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    {os && podeMexer ? (
                      <span className="flex items-center gap-0.5">
                        <GripVertical className="size-5 text-ink-3 cursor-grab hidden sm:block" aria-hidden />
                        <IconButton icone={ArrowUp} rotulo={`Subir ${o.ref.numero}`} onClick={() => mover(o.id, -1)} disabled={i <= 0} className="size-9" />
                        <IconButton icone={ArrowDown} rotulo={`Descer ${o.ref.numero}`} onClick={() => mover(o.id, 1)} disabled={i === ordemOS.length - 1} className="size-9" />
                      </span>
                    ) : (
                      <span className="w-[76px] hidden sm:block" />
                    )}
                    <span className="mono text-[13px] text-ink-3 w-6 pt-1">{o.posicao}</span>
                    <span className="flex-[1_1_220px] min-w-0 flex flex-col">
                      <Link to={href} className="font-semibold text-ink-1 no-underline hover:underline">
                        <span className="mono text-[13px] text-ink-3">{o.ref.numero}</span> {o.ref.titulo}
                      </Link>
                      <span className="text-caption text-ink-2">{nomeCliente(o.ref.cliente)}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 items-center">
                      {o.provisoria && <Pill tom="steel">reserva</Pill>}
                      {(o.prioridade ?? o.ref.prioridade) && (o.prioridade ?? o.ref.prioridade) !== 'NORMAL' && (
                        <Pill tom={(o.prioridade ?? o.ref.prioridade) === 'URGENTE' ? 'bad' : (o.prioridade ?? o.ref.prioridade) === 'ALTA' ? 'warn' : 'neutral'}>{(o.prioridade ?? o.ref.prioridade)!.toLowerCase()}</Pill>
                      )}
                    </span>
                    <span className="flex flex-col text-right min-w-[150px]">
                      <span className="mono text-[13px]">
                        <span className="text-ink-3">prazo {o.prazo ? data(o.prazo) : '—'}</span> · <strong className={o.atrasada ? 'text-bad' : ''}>{o.fim ? data(o.fim) : 'não cabe'}</strong>
                      </span>
                      {o.atrasada && <span className="text-caption font-semibold text-bad">{o.atrasoDias ? `${o.atrasoDias} ${o.atrasoDias === 1 ? 'dia' : 'dias'} de atraso` : 'sem capacidade no horizonte'}</span>}
                    </span>
                  </div>
                  <div className="relative h-4 rounded bg-surface-3 sm:ml-[110px]" role="img" aria-label={`${o.ref.numero}: ${o.operacoes.map((op) => `${op.descricao} no ${op.centroNome}${op.inicio ? ` de ${data(op.inicio)} a ${data(op.fim)}` : ''}`).join('; ')}`}>
                    {o.prazo && diasEntre(plano.hoje, o.prazo) >= 0 && diasEntre(plano.hoje, o.prazo) < DIAS_GANTT && (
                      <span className="absolute -top-1 -bottom-1 w-0.5 bg-ink-1" style={{ left: `${((diasEntre(plano.hoje, o.prazo) + 1) / DIAS_GANTT) * 100}%` }} title="prazo" />
                    )}
                    {o.operacoes.filter((op) => op.inicio).map((op) => {
                      const ini = Math.max(0, diasEntre(plano.hoje, op.inicio!));
                      const fim = Math.min(DIAS_GANTT - 1, diasEntre(plano.hoje, op.fim ?? diasGantt[DIAS_GANTT - 1]!));
                      if (ini >= DIAS_GANTT) return null;
                      return (
                        <span key={op.id} className="absolute top-0.5 bottom-0.5 rounded-sm" title={`${op.descricao} · ${op.centroNome} · ${horas(op.horas, 1)}`}
                          style={{ left: `${(ini / DIAS_GANTT) * 100}%`, width: `${Math.max(1.5, ((fim - ini + 1) / DIAS_GANTT) * 100)}%`, background: corCentro.get(op.centroId), opacity: o.provisoria ? 0.55 : 1 }} />
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {plano.semDestino.length > 0 && <p className="m-0 px-5 py-3 text-caption text-bad border-t border-border">{plano.semDestino.length} operação(ões) sem centro ou sem capacidade no horizonte.</p>}
      </Card>

      <Paradas centros={centrosVista.map((c) => ({ id: c.id, nome: c.nome }))} paradas={paradas} />
      <Feriados aberto={feriadosAberto} onFechar={() => setFeriadosAberto(false)} feriados={feriados} />
    </>
  );
}

function Paradas({ centros, paradas }: { centros: { id: string; nome: string }[]; paradas: Map<string, Parada[]> }) {
  const [n, setN] = useState({ centroId: '', inicio: '', fim: '', motivo: '' });
  const [tentou, setTentou] = useState(false);
  const inval = [['paradas'], ['planejamento'], ['painel']];
  const add = useAcao(() => api<Parada & { sugestoes?: { id: string; codigo?: string; nome: string }[] }>(`/centros-trabalho/${n.centroId}/paradas`, { method: 'POST', body: { inicio: n.inicio, fim: n.fim || n.inicio, motivo: n.motivo.trim() } }), {
    invalida: inval,
    sucesso: (r) => {
      const eq = r?.sugestoes;
      return eq?.length ? `Parada registrada. Centros equivalentes para levar o serviço: ${eq.map((x) => x.nome).join(', ')}.` : 'Parada registrada. A fila já foi recalculada sem esse centro nesses dias.';
    },
    onSuccess: () => { setN({ centroId: '', inicio: '', fim: '', motivo: '' }); setTentou(false); }
  });
  const del = useAcao(({ c, p }: { c: string; p: string }) => api(`/centros-trabalho/${c}/paradas/${p}`, { method: 'DELETE' }), { invalida: inval, sucesso: 'Parada removida.' });
  const lista = centros.flatMap((c) => (paradas.get(c.id) ?? []).map((p) => ({ ...p, centroId: c.id, centroNome: c.nome })));
  const ok = n.centroId && n.inicio && n.motivo.trim() && (!n.fim || n.fim >= n.inicio);
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-paradas">
      <CardHeader id="h-paradas" titulo="Paradas programadas" sub="Manutenção, reforma ou férias: o centro fica sem capacidade nesses dias." />
      {lista.length === 0 ? <p className="m-0 text-ink-2 text-[14px]">Nenhuma parada marcada.</p> : (
        <ul className="m-0 p-0 list-none flex flex-col">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-border first:border-0">
              <span className="w-5 h-5 rounded flex-none" style={{ backgroundImage: HACHURA }} aria-hidden />
              <span className="flex-1 min-w-[180px]"><strong>{p.centroNome}</strong> · {p.motivo}</span>
              <span className="mono text-[13px]">{data(p.inicio)}{p.fim.slice(0, 10) !== p.inicio.slice(0, 10) ? ` a ${data(p.fim)}` : ''}</span>
              <IconButton icone={Trash2} rotulo={`Remover parada de ${p.centroNome}`} onClick={() => del.mutate({ c: p.centroId, p: p.id })} className="size-9 hover:text-bad" />
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-medium text-ink-2">Centro</span>
          <Select value={n.centroId} onChange={(v) => setN({ ...n, centroId: v })} opcoes={centros.map((c) => ({ valor: c.id, rotulo: c.nome }))} vazio="Escolha" invalido={tentou && !n.centroId} />
        </label>
        <TextField label="De" type="date" mono value={n.inicio} onChange={(v) => setN({ ...n, inicio: v })} erro={tentou && !n.inicio ? 'Quando começa?' : null} />
        <TextField label="Até" type="date" mono value={n.fim} onChange={(v) => setN({ ...n, fim: v })} erro={n.fim && n.inicio && n.fim < n.inicio ? 'Termina antes de começar.' : null} />
        <TextField label="Motivo" value={n.motivo} onChange={(v) => setN({ ...n, motivo: v })} placeholder="Preventiva do spindle" erro={tentou && !n.motivo.trim() ? 'Conte o motivo.' : null} />
        <Button icone={Plus} carregando={add.isPending} onClick={() => { setTentou(true); if (ok) add.mutate(undefined); }}>Marcar parada</Button>
      </div>
    </Card>
  );
}

function Feriados({ aberto, onFechar, feriados }: { aberto: boolean; onFechar: () => void; feriados: Feriado[] }) {
  const [n, setN] = useState({ data: '', descricao: '' });
  const inval = [['feriados'], ['planejamento'], ['painel']];
  const add = useAcao(() => api('/feriados', { method: 'POST', body: { data: n.data, descricao: n.descricao.trim() } }), { invalida: inval, sucesso: 'Feriado incluído. Ninguém produz nesse dia.', onSuccess: () => setN({ data: '', descricao: '' }) });
  const del = useAcao((id: string) => api(`/feriados/${id}`, { method: 'DELETE' }), { invalida: inval, sucesso: 'Feriado removido.' });
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Feriados" rodape={<Button onClick={onFechar}>Fechar</Button>}>
      <p className="m-0 text-ink-2 text-[14px]">Dias sem expediente em todos os centros. A agenda da oficina também respeita.</p>
      <ul className="m-0 p-0 list-none flex flex-col">
        {[...feriados].sort((a, b) => a.data.localeCompare(b.data)).map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2 border-t border-border first:border-0">
            <span className="mono text-[14px] w-[96px]">{data(f.data)}</span>
            <span className="flex-1">{f.descricao}</span>
            <IconButton icone={Trash2} rotulo={`Remover ${f.descricao}`} onClick={() => del.mutate(f.id)} className="size-9 hover:text-bad" />
          </li>
        ))}
        {feriados.length === 0 && <li className="text-ink-2">Nenhum feriado cadastrado.</li>}
      </ul>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_auto] gap-3 items-end">
        <TextField label="Data" type="date" mono value={n.data} onChange={(v) => setN({ ...n, data: v })} />
        <TextField label="Descrição" value={n.descricao} onChange={(v) => setN({ ...n, descricao: v })} placeholder="Aniversário da cidade" />
        <Button icone={Plus} disabled={!n.data || !n.descricao.trim()} carregando={add.isPending} onClick={() => add.mutate(undefined)}>Incluir</Button>
      </div>
    </Modal>
  );
}

