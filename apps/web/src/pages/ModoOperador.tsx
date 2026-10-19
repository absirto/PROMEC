import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, Minus, Pause, Play, Plus, RefreshCw, Square, TriangleAlert, UserRound, Wrench, X } from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import type { Apontamento, FilaOperador, Lista, MotivoPausa, TipoApontamento } from '../lib/types';
import { data, hhmm, iniciais, num } from '../lib/format';
import { useColaboradores } from '../lib/queries';
import { gravar, ler } from '../lib/storage';
import { useToast } from '../components/Toast';
import { LogoProMEC } from '../components/Illustrations';
import { Carregando } from '../components/EmptyState';
import { cronometro, MOTIVOS_PAUSA, normalizarFila, segundosDesde, useAgora } from '../features/os/os';
import { StatusOSPill } from '../features/os/componentes';

const CHAVE = 'promec.operador';
const lista = <T,>(x: T[] | Lista<T> | undefined | null): T[] => (Array.isArray(x) ? x : x?.itens ?? []);

const mensagemOperador = (e: unknown) => {
  if (e instanceof ApiError && e.codigo === 'APONTAMENTO_ABERTO') return 'Você já tem uma operação rodando. Pare aquela primeiro; ninguém aponta duas máquinas ao mesmo tempo.';
  if (e instanceof ApiError && e.codigo === 'SETUP_ENCERRADO') return 'O setup desta operação já foi encerrado. Agora é com a produção.';
  if (e instanceof ApiError && e.codigo === 'SEM_APONTAMENTO_ABERTO') return 'Não tem nada rodando para parar. Atualize a fila: alguém pode ter parado antes.';
  if (e instanceof ApiError && e.codigo === 'STATUS_INVALIDO') return 'Essa OS não está liberada para começar agora. Se ela estiver pausada, retome primeiro; se estiver aberta, peça ao líder para liberar.';
  if (e instanceof ApiError && e.codigo === 'NAO_HABILITADO') return 'Você não está alocado nessa máquina. Peça ao seu líder para liberar antes de começar.';
  return msgErro(e);
};

const grande = 'min-h-[56px] rounded-[20px] font-bold text-[18px] inline-flex items-center justify-center gap-2.5 px-5 transition active:scale-[.97] disabled:opacity-50';

function Contador({ rotulo, valor, onChange, tom, de }: { rotulo: string; valor: number; onChange: (n: number) => void; tom: 'ok' | 'neutral'; de?: number }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-[20px] border border-border ${tom === 'ok' ? 'bg-ok-soft' : 'bg-surface-2'}`}>
      <button type="button" onClick={() => onChange(Math.max(0, valor - 1))} aria-label={`Menos uma: ${rotulo}`} className="size-14 rounded-[16px] grid place-items-center bg-surface-1 border border-border-strong">
        <Minus className="size-7" aria-hidden />
      </button>
      <span className="flex-1 flex flex-col items-center" aria-live="polite">
        <span className={`mono text-[44px] font-bold leading-none ${tom === 'ok' ? 'text-ok' : valor > 0 ? 'text-bad' : ''}`}>{valor}</span>
        <span className="text-[14px] font-semibold text-ink-2">{rotulo}{de ? ` de ${de}` : ''}</span>
      </span>
      <button type="button" onClick={() => onChange(valor + 1)} aria-label={`Mais uma: ${rotulo}`} className={`size-14 rounded-[16px] grid place-items-center ${tom === 'ok' ? 'bg-ok text-surface-1' : 'bg-surface-1 border border-border-strong'}`}>
        <Plus className="size-7" aria-hidden />
      </button>
    </div>
  );
}

function EscolherOperador({ onEscolher }: { onEscolher: (id: string) => void }) {
  const q = useColaboradores();
  return (
    <section className="flex flex-col gap-5 max-w-[900px] w-full mx-auto" aria-labelledby="h-quem">
      <h1 id="h-quem" className="m-0 text-[clamp(36px,5vw,52px)] font-bold leading-none">Quem está na máquina?</h1>
      <p className="m-0 text-[18px] text-ink-2">Toque no seu nome. O tablet lembra de você até alguém trocar.</p>
      {q.isLoading ? <Carregando /> : (
        <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {(q.data?.itens ?? []).filter((c) => c.ativo).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onEscolher(c.id)} className="w-full min-h-[88px] card p-4 flex items-center gap-4 text-left hover:-translate-y-0.5 transition">
                <span className="size-14 rounded-full grid place-items-center bg-steel-2 text-white font-bold text-[20px] flex-none">{iniciais(c.nome)}</span>
                <span className="flex flex-col"><span className="font-bold text-[19px]">{c.nome}</span><span className="text-[15px] text-ink-2">{c.funcao}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ModoOperador() {
  const qc = useQueryClient();
  const toast = useToast();
  const [operadorId, setOperadorId] = useState<string | null>(() => ler(CHAVE));
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [boas, setBoas] = useState(0);
  const [refugo, setRefugo] = useState(0);
  const [painel, setPainel] = useState<null | 'parar' | 'pausa'>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const colabs = useColaboradores();

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.density = 'operador';
    document.title = 'Modo Operador · ProMEC';
    return () => { delete el.dataset.density; };
  }, []);

  const fila = useQuery({
    queryKey: ['operador', 'fila', operadorId],
    queryFn: () => api<unknown[] | Lista<unknown>>('/operador/fila', { query: { colaboradorId: operadorId } }),
    enabled: !!operadorId,
    refetchInterval: 15_000
  });
  const abertosQ = useQuery({
    queryKey: ['operador', 'abertos', operadorId],
    queryFn: () => api<Apontamento[] | Lista<Apontamento>>('/apontamentos/abertos', { query: { colaboradorId: operadorId } }),
    enabled: !!operadorId,
    refetchInterval: 15_000
  });
  const itens = useMemo(() => lista(fila.data).map(normalizarFila), [fila.data]);
  const aberto = lista(abertosQ.data)[0] ?? itens.find((i) => i.apontamentoAberto?.colaboradorId === operadorId)?.apontamentoAberto ?? null;
  const agora = useAgora(!!aberto);
  const atual: FilaOperador | undefined = aberto ? itens.find((i) => i.operacao.id === aberto.operacaoId) : itens.find((i) => i.operacao.id === selecionada) ?? itens[0];
  const operador = colabs.data?.itens.find((c) => c.id === operadorId);

  useEffect(() => { setBoas(0); setRefugo(0); }, [aberto?.id]);

  const trocar = (id: string | null) => {
    gravar(CHAVE, id);
    setOperadorId(id);
    setSelecionada(null);
    setErro(null);
  };

  const executar = async (fn: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      toast(sucesso, 'ok');
      setPainel(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['operador'] }), qc.invalidateQueries({ queryKey: ['ordens-servico'] })]);
    } catch (e) {
      setErro(mensagemOperador(e));
    } finally {
      setOcupado(false);
    }
  };

  const base = (it: FilaOperador) => `/ordens-servico/${it.os.id}`;
  const iniciar = (it: FilaOperador, tipo: TipoApontamento) =>
    executar(() => api(`${base(it)}/operacoes/${it.operacao.id}/iniciar`, { method: 'POST', body: { colaboradorId: operadorId, tipo } }), tipo === 'SETUP' ? 'Setup começou. Bom trabalho!' : 'Produção rodando. Conte as peças boas no fim.');
  const parar = (it: FilaOperador, extra: { encerrarSetup?: boolean; encerrarOperacao?: boolean }, msg: string) => {
    setSelecionada(it.operacao.id);
    return executar(() => api(`${base(it)}/operacoes/${it.operacao.id}/parar`, { method: 'POST', body: { colaboradorId: operadorId, quantidadeBoa: boas, refugo, ...extra } }), msg);
  };
  const trocarPara = (it: FilaOperador, tipo: TipoApontamento) =>
    executar(async () => {
      await api(`${base(it)}/operacoes/${it.operacao.id}/parar`, { method: 'POST', body: { colaboradorId: operadorId, quantidadeBoa: boas, refugo, encerrarSetup: tipo === 'PRODUCAO' } });
      await api(`${base(it)}/operacoes/${it.operacao.id}/iniciar`, { method: 'POST', body: { colaboradorId: operadorId, tipo } });
    }, tipo === 'PRODUCAO' ? 'Setup encerrado. Produção rodando.' : 'Voltou para o setup.');
  const pausar = (it: FilaOperador, motivo: MotivoPausa) => executar(() => api(`${base(it)}/pausar`, { method: 'POST', body: { motivo } }), 'Pausa registrada. O líder já fica sabendo.');
  const retomar = (it: FilaOperador) => executar(() => api(`${base(it)}/retomar`, { method: 'POST' }), 'De volta ao trabalho.');

  const op = atual?.operacao;
  const seg = aberto ? segundosDesde(aberto.inicio, agora) : 0;

  return (
    <div className="min-h-screen flex flex-col gap-4 p-3 sm:p-4">
      <header className="glass rounded-full pl-3 pr-2 py-2 flex items-center gap-3">
        <LogoProMEC className="size-11" />
        <span className="font-display text-[22px] font-bold flex-1 truncate">Modo Operador</span>
        {operador && (
          <span className="hidden sm:inline-flex items-center gap-2 text-[16px] font-semibold"><UserRound className="size-5" aria-hidden />{operador.nome}</span>
        )}
        {operadorId && (
          <button type="button" onClick={() => trocar(null)} className={`${grande} !text-[16px] !min-h-[48px] !rounded-full bg-surface-1 border border-border-strong`}>Trocar</button>
        )}
        <Link to="/ordens-servico" aria-label="Sair do Modo Operador" className={`${grande} !min-h-[48px] !rounded-full !px-4 bg-surface-3 no-underline text-ink-1`}><ArrowLeft className="size-5" aria-hidden /><span className="hidden md:inline text-[16px]">Sair</span></Link>
      </header>

      {!operadorId ? (
        <EscolherOperador onEscolher={trocar} />
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
          <section aria-labelledby="h-fila" className="flex flex-col gap-3 order-2 lg:order-1">
            <div className="flex items-center justify-between">
              <h2 id="h-fila" className="m-0 text-[24px] font-bold">Sua fila</h2>
              <button type="button" onClick={() => { fila.refetch(); abertosQ.refetch(); }} aria-label="Atualizar a fila" className="size-12 rounded-full grid place-items-center hover:bg-surface-3"><RefreshCw className="size-5" aria-hidden /></button>
            </div>
            {fila.isLoading ? <Carregando linhas={3} /> : fila.isError ? (
              <p role="alert" className="m-0 p-4 rounded-[20px] bg-bad-soft text-[16px]">{msgErro(fila.error)}</p>
            ) : itens.length === 0 ? (
              <p className="m-0 p-5 card text-[17px] text-ink-2">Nada na sua fila agora. Fale com o líder ou aproveite para organizar a bancada.</p>
            ) : (
              <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
                {itens.map((it) => {
                  const on = it.operacao.id === op?.id;
                  return (
                    <li key={it.operacao.id}>
                      <button type="button" onClick={() => !aberto && setSelecionada(it.operacao.id)} aria-pressed={on} aria-label={`${it.os.numero}, operação ${it.operacao.sequencia}: ${it.os.titulo}`} disabled={!!aberto && !on}
                        className={`w-full text-left card p-4 flex flex-col gap-1.5 border-2 transition ${on ? '!border-primary' : ''} disabled:opacity-60`}>
                        <span className="flex justify-between gap-2 items-center">
                          <span className="mono text-[14px] text-ink-3">{it.os.numero} · Op {it.operacao.sequencia}</span>
                          {it.os.prioridade === 'URGENTE' || it.os.prioridade === 'ALTA' ? <span className="text-[13px] font-bold text-bad">{it.os.prioridade === 'URGENTE' ? 'Urgente' : 'Alta'}</span> : null}
                        </span>
                        <span className="font-bold text-[18px] leading-tight">{it.os.titulo}</span>
                        <span className="text-[15px] text-ink-2">{it.operacao.descricao} · {it.operacao.centroNome}</span>
                        <span className={`text-[14px] ${it.os.atrasada ? 'text-bad font-semibold' : 'text-ink-3'}`}>{it.os.prazo ? `prazo ${data(it.os.prazo)}` : ''}{it.apontamentoAberto ? ' · rodando' : ''}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <main className="order-1 lg:order-2 flex flex-col gap-4" aria-live="polite">
            {erro && (
              <div role="alert" className="flex items-start gap-3 p-4 rounded-[20px] bg-bad-soft text-[17px]">
                <TriangleAlert className="size-6 text-bad flex-none mt-0.5" aria-hidden />
                <span className="flex-1">{erro}</span>
                <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso" className="size-10 grid place-items-center rounded-full hover:bg-surface-1"><X className="size-5" aria-hidden /></button>
              </div>
            )}
            {!atual || !op ? (
              <section className="card p-8 text-center text-[18px] text-ink-2">{fila.isLoading ? 'Buscando a sua fila…' : 'Escolha uma operação na fila para começar.'}</section>
            ) : (
              <section className="card !rounded-[26px] p-5 sm:p-6 flex flex-col gap-4" aria-label="Operação">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <span className="flex flex-col min-w-0">
                    <span className="mono text-[15px] text-ink-3">{atual.os.numero} · Op {op.sequencia}</span>
                    <span className="font-display text-[clamp(28px,4vw,36px)] font-bold leading-tight">{atual.os.titulo}</span>
                    <span className="text-[17px] text-ink-2">
                      {op.descricao} · meta {num(op.cicloOrcadoHorasPorPeca)} h por peça ({hhmm(op.cicloOrcadoHorasPorPeca)}) · setup {num(op.setupOrcadoHoras)} h
                    </span>
                  </span>
                  <StatusOSPill status={atual.os.status} />
                </div>

                <div role="tablist" aria-label="Tipo de apontamento" className="grid grid-cols-2 gap-2 p-1.5 rounded-[22px] bg-surface-3">
                  {(['SETUP', 'PRODUCAO'] as TipoApontamento[]).map((t) => {
                    const ativo = aberto ? aberto.tipo === t : t === (op.setupConcluido ? 'PRODUCAO' : 'SETUP');
                    return (
                      <button key={t} type="button" role="tab" aria-selected={ativo} disabled={ocupado || (!aberto) || (t === 'SETUP' && op.setupConcluido)}
                        onClick={() => aberto && aberto.tipo !== t && trocarPara(atual, t)}
                        className={`${grande} !rounded-[18px] ${ativo ? (t === 'SETUP' ? 'bg-signal text-[#1E1B16]' : 'bg-steel text-surface-1') : 'text-ink-2'} disabled:opacity-100`}>
                        {t === 'SETUP' ? <Wrench className="size-6" aria-hidden /> : <Play className="size-6" aria-hidden />}
                        {t === 'SETUP' ? 'Setup' : 'Produção'}
                        {t === 'SETUP' && op.setupConcluido && <CheckCheck className="size-5" aria-label="encerrado" />}
                      </button>
                    );
                  })}
                </div>

                {aberto ? (
                  <>
                    <div className="flex items-baseline gap-4 flex-wrap">
                      <span className="mono text-[clamp(64px,11vw,96px)] font-bold tracking-[-.04em] leading-none" role="timer" aria-label={`Tempo de ${aberto.tipo === 'SETUP' ? 'setup' : 'produção'}`}>{cronometro(seg)}</span>
                      <span className="mono text-[22px] text-ink-2">{num(seg / 3600)} h</span>
                    </div>
                    <span className="text-[16px] text-ink-2">
                      {aberto.tipo === 'SETUP' ? `Orçado ${num(op.setupOrcadoHoras)} h de setup. Já foi ${num(op.setupRealHoras)} h antes desta rodada.` : `Já são ${op.quantidadeBoa} peças boas de ${atual.os.lote}. Conte as desta rodada:`}
                    </span>
                    {aberto.tipo === 'PRODUCAO' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Contador rotulo="peças boas" valor={boas} onChange={setBoas} tom="ok" />
                        <Contador rotulo="refugo" valor={refugo} onChange={setRefugo} tom="neutral" />
                      </div>
                    )}
                    {painel === 'parar' ? (
                      <div className="flex flex-col gap-2.5 p-4 rounded-[22px] bg-surface-2 border border-border">
                        <span className="text-[18px] font-bold">Como fica?</span>
                        <button type="button" disabled={ocupado} onClick={() => parar(atual, {}, 'Parado. O tempo ficou registrado.')} className={`${grande} bg-surface-1 border-2 border-border-strong`}><Square className="size-6" aria-hidden />Só parar por agora</button>
                        {aberto.tipo === 'SETUP' && (
                          <button type="button" disabled={ocupado} onClick={() => parar(atual, { encerrarSetup: true }, 'Setup encerrado. Agora é produção.')} className={`${grande} bg-signal text-[#1E1B16]`}><Wrench className="size-6" aria-hidden />Encerrar setup</button>
                        )}
                        <button type="button" disabled={ocupado} onClick={() => parar(atual, { encerrarSetup: true, encerrarOperacao: true }, `Operação ${op.sequencia} encerrada. Boa!`)} className={`${grande} bg-primary-fill text-primary-on`}><CheckCheck className="size-6" aria-hidden />Encerrar a operação {op.sequencia}</button>
                        <button type="button" onClick={() => setPainel(null)} className={`${grande} text-ink-2`}>Continuar trabalhando</button>
                      </div>
                    ) : painel === 'pausa' ? (
                      <div className="flex flex-col gap-2.5 p-4 rounded-[22px] bg-warn-soft">
                        <span className="text-[20px] font-bold">Por que parou?</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(Object.keys(MOTIVOS_PAUSA) as MotivoPausa[]).map((m) => (
                            <button key={m} type="button" disabled={ocupado} onClick={() => pausar(atual, m)} className={`${grande} !min-h-[72px] bg-surface-1 border-2 border-border-strong`}>{MOTIVOS_PAUSA[m]}</button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setPainel(null)} className={`${grande} text-ink-2`}>Voltar ao trabalho</button>
                      </div>
                    ) : (
                      <nav aria-label="Ações" className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setPainel('pausa')} className={`${grande} !min-h-[96px] bg-warn-soft text-warn border-2 border-signal`}><Pause className="size-7" aria-hidden />Pausar</button>
                        <button type="button" onClick={() => setPainel('parar')} className={`${grande} !min-h-[96px] bg-primary-fill text-primary-on shadow-[0_8px_20px_rgba(227,93,20,.35)]`}><Square className="size-7" aria-hidden />Parar</button>
                      </nav>
                    )}
                  </>
                ) : atual.os.status === 'PAUSADA' ? (
                  <div className="flex flex-col gap-3 p-4 rounded-[22px] bg-warn-soft">
                    <span className="text-[18px] font-semibold">Esta OS está pausada. Resolvido o motivo, é só voltar.</span>
                    <button type="button" disabled={ocupado} onClick={() => retomar(atual)} className={`${grande} !min-h-[88px] bg-primary-fill text-primary-on`}><Play className="size-7" aria-hidden />Retomar a OS</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" disabled={ocupado || op.setupConcluido} onClick={() => iniciar(atual, 'SETUP')} className={`${grande} !min-h-[112px] bg-signal text-[#1E1B16] text-[22px]`}>
                      <Wrench className="size-8" aria-hidden />{op.setupConcluido ? 'Setup já encerrado' : 'Iniciar setup'}
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => iniciar(atual, 'PRODUCAO')} className={`${grande} !min-h-[112px] bg-primary-fill text-primary-on text-[22px] shadow-[0_8px_20px_rgba(227,93,20,.35)]`}>
                      <Play className="size-8" aria-hidden />Iniciar produção
                    </button>
                    <span className="sm:col-span-2 text-[15px] text-ink-2">{op.quantidadeBoa} de {atual.os.lote} peças boas até agora · setup real {num(op.setupRealHoras)} h</span>
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
