import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, ArrowRight, Cpu, Plus, Timer, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ListaOS, OSResumo, StatusOS } from '../lib/types';
import { data, pct, toNum } from '../lib/format';
import { HeroBand } from '../components/HeroBand';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Listagem } from '../components/Listagem';
import { Pill } from '../components/Pill';
import { useTitulo } from '../layout/titulo';
import { STATUS_OS, nomeDe } from '../features/os/os';
import { StatusOSPill } from '../features/os/componentes';
import { SEGMENTO } from '../lib/rotulos';

type Filtro = 'todos' | 'ATRASADAS' | StatusOS;
const ORDEM: StatusOS[] = ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA', 'CONTROLE_QUALIDADE', 'CONCLUIDA', 'ENTREGUE', 'CANCELADA'];
const corSituacao = { ok: 'text-ok', atencao: 'text-warn', perigo: 'text-bad' } as const;

function CartaoOS({ o }: { o: OSResumo }) {
  const prog = Math.min(1, toNum(o.progresso));
  const centro = nomeDe(o.centroAtual);
  const operador = nomeDe(o.operadorAtual);
  return (
    <li>
      <Link to={`/ordens-servico/${o.id}`} className="card anim-subir no-underline text-ink-1 p-4 flex flex-col gap-3 h-full hover:-translate-y-0.5 hover:shadow-2 transition duration-micro">
        <div className="flex items-start justify-between gap-2">
          <span className="flex flex-col min-w-0">
            <span className="mono text-caption text-ink-3">{o.numero} · {SEGMENTO[o.segmento]}</span>
            <span className="font-semibold text-[15.5px] leading-snug">{o.titulo}</span>
            <span className="text-caption text-ink-2 truncate">{o.cliente?.nome}</span>
          </span>
          <StatusOSPill status={o.status} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-caption text-ink-2">
            <span>Progresso</span>
            <span className="mono font-semibold text-ink-1">{pct(prog, 0)}</span>
          </div>
          <span className="h-2 rounded-full bg-surface-3 overflow-hidden" role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${o.numero}`}>
            <span className="anim-crescer block h-full rounded-full bg-steel" style={{ width: `${prog * 100}%` }} />
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><Cpu className="size-3.5" aria-hidden />{centro ?? 'sem máquina agora'}</span>
          <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" aria-hidden />{operador ?? 'ninguém apontando'}</span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <span className={`inline-flex items-center gap-1.5 text-[13px] ${o.atrasada ? 'text-bad font-semibold' : 'text-ink-2'}`}>
            <AlarmClock className="size-3.5" aria-hidden />
            {o.prazo ? `${o.atrasada ? 'Atrasada · era ' : 'Prazo '}${data(o.prazo)}` : 'sem prazo'}
          </span>
          <span className="mono text-[13px] inline-flex items-center gap-1" title="Margem orçada → projetada">
            <span className="text-ink-3">{pct(o.margemOrcada)}</span>
            <ArrowRight className="size-3.5 text-ink-3" aria-label="projetada" />
            <strong className={corSituacao[o.situacao] ?? ''}>{pct(o.margemProjetada)}</strong>
            <span className={`size-2.5 rounded-full ${{ ok: 'bg-ok', atencao: 'bg-signal', perigo: 'bg-bad' }[o.situacao] ?? 'bg-neutral'}`} aria-label={`situação ${o.situacao}`} />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function OSLista() {
  const { pode: podeFn_ } = useAuth();
  const podeGerir = podeFn_('os.gerenciar');
  useTitulo('Ordens de Serviço');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const termo = useDeferredValue(busca.trim());
  const q = useQuery({
    queryKey: ['ordens-servico', 'lista', filtro, termo],
    queryFn: () =>
      api<ListaOS>('/ordens-servico', {
        query: { status: filtro === 'todos' || filtro === 'ATRASADAS' ? undefined : filtro, atrasadas: filtro === 'ATRASADAS' ? 'true' : undefined, q: termo }
      }),
    placeholderData: (p) => p,
    refetchInterval: 60_000
  });
  const itens = q.data?.itens ?? [];
  const cont = q.data?.contagem ?? {};
  const total = ORDEM.reduce((a, s) => a + (cont[s] ?? 0), 0);

  return (
    <>
      <HeroBand
        ilustracao="torno"
        titulo="Ordens de Serviço"
        texto={
          cont.ATRASADAS
            ? `${cont.EM_EXECUCAO ?? 0} rodando agora e ${cont.ATRASADAS} ${cont.ATRASADAS === 1 ? 'atrasada' : 'atrasadas'}. Comece por elas.`
            : `${cont.EM_EXECUCAO ?? 0} rodando agora. Nenhuma atrasada: o chão de fábrica está no ritmo.`
        }
        acoes={
          <>
            <Button variante="vidro" icone={Timer} to="/operador">Modo Operador</Button>
            <Button variante="primario" icone={Plus} to="/ordens-servico/nova">Serviço rápido</Button>
          </>
        }
      />
      <Listagem<Filtro>
        rotulo="Lista de ordens de serviço"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por número, peça, placa ou cliente"
        filtros={[
          { valor: 'todos' as Filtro, rotulo: 'Todas', n: total },
          ...(cont.ATRASADAS ? [{ valor: 'ATRASADAS' as Filtro, rotulo: 'Atrasadas', n: cont.ATRASADAS }] : []),
          ...ORDEM.filter((s) => cont[s]).map((s) => ({ valor: s as Filtro, rotulo: STATUS_OS[s].rotulo, n: cont[s] }))
        ]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={
          q.isSuccess && total === 0 && !termo ? (
            <EmptyState
              ilustracao="torno"
              titulo="Nenhuma OS por aqui"
              texto="Quando um orçamento é aprovado, é só converter em OS. Para um serviço pequeno, abra um serviço rápido."
              acao={podeGerir && <Button variante="primario" icone={Plus} to="/ordens-servico/nova">Serviço rápido</Button>}
            />
          ) : null
        }
        semResultado={itens.length === 0}
        total={filtro === 'todos' ? q.data?.total ?? 0 : cont[filtro] ?? q.data?.total ?? 0}
        mostrando={itens.length}
      >
        {itens.length > 0 && (
          <ul className="list-none m-0 p-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3.5">
            {itens.map((o) => <CartaoOS key={o.id} o={o} />)}
          </ul>
        )}
        {filtro === 'ATRASADAS' && itens.length > 0 && (
          <p className="m-0 px-4 pb-3 text-caption text-ink-3"><Pill tom="bad">prazo vencido</Pill> Renegocie o prazo com o cliente antes que ele ligue.</p>
        )}
      </Listagem>
    </>
  );
}
