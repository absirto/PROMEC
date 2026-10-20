import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Plus, Siren } from 'lucide-react';
import { data, horas } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { Carregando, ErroEstado } from '../../components/EmptyState';
import { CustoManutencaoCentro, ListaOrdens, PlanoCard } from './Blocos';
import { NovaOrdem } from './NovaOrdem';
import { OrdemSheet } from './OrdemSheet';
import { PlanoForm } from './PlanoForm';
import { RegistrarQuebra } from './Quebra';
import { estaAberta, type Ordem, type Plano } from './manutencao';
import { useOrdens, usePlanos } from './queries';

/** Paradas do centro a partir das ordens que bloquearam a agenda ou registraram quebra. */
function paradasDe(ordens: Ordem[]) {
  return ordens
    .filter((o) => o.paradaId && o.status !== 'CANCELADA')
    .map((o) => ({
      id: o.id,
      numero: o.numero,
      motivo: o.descricao,
      quebra: o.tipo === 'CORRETIVA',
      inicio: o.tipo === 'CORRETIVA' ? o.inicio : o.prevista,
      fim: o.tipo === 'CORRETIVA' ? o.fim : o.status === 'CONCLUIDA' ? o.fim : o.prevista,
      aberta: o.tipo === 'CORRETIVA' && estaAberta(o),
      horasParado: o.horasParado
    }))
    .sort((a, b) => String(b.inicio ?? '').localeCompare(String(a.inicio ?? '')));
}

function Bloco({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[17px] font-semibold">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Seção de manutenção no cadastro do centro: planos, ordens, paradas e custo real. */
export function CentroManutencao({ centroId, centroNome, cadastro }: { centroId: string; centroNome: string; cadastro: string }) {
  const pode = useAuth().pode('manutencao.gerenciar');
  const planos = usePlanos(centroId);
  const ordens = useOrdens({ centroId });
  const [editar, setEditar] = useState<Plano | 'novo' | null>(null);
  const [ordemId, setOrdemId] = useState<string | null>(null);
  const [quebra, setQuebra] = useState(false);
  const [nova, setNova] = useState(false);
  const fecharPlano = useCallback(() => setEditar(null), []);
  const fecharOrdem = useCallback(() => setOrdemId(null), []);
  const fecharQuebra = useCallback(() => setQuebra(false), []);
  const fecharNova = useCallback(() => setNova(false), []);
  const lista = ordens.data ?? [];
  const recentes = [...lista.filter(estaAberta), ...lista.filter((o) => !estaAberta(o))].slice(0, 8);
  const paradas = paradasDe(lista).slice(0, 8);

  return (
    <section id="manutencao" className="card anim-subir p-5 sm:p-6 flex flex-col gap-5 scroll-mt-24 min-w-0" aria-labelledby="manutencao-t">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="manutencao-t" className="m-0 text-[24px] font-bold">Manutenção</h2>
          <span className="text-[13.5px] text-ink-3">Planos preventivos, ordens, paradas e quanto {centroNome || 'o centro'} gasta de verdade para continuar rodando.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {pode && <Button variante="primario" icone={Siren} onClick={() => setQuebra(true)}>Registrar quebra</Button>}
          <Button to={`/manutencao?aba=indicadores&centroId=${centroId}`}>Indicadores</Button>
        </div>
      </div>

      <Bloco titulo="Planos preventivos" acao={pode && <Button tamanho="sm" icone={Plus} onClick={() => setEditar('novo')}>Novo plano</Button>}>
        {planos.isLoading ? <Carregando linhas={2} rotulo="Carregando planos" /> : planos.isError ? <ErroEstado erro={planos.error} tentar={() => planos.refetch()} /> : !planos.data?.length ? (
          <p className="m-0 text-[14px] text-ink-2">Nenhum plano para este centro. Um plano por horas de uso abre a ordem sozinho quando estiver chegando a hora.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {planos.data.map((p) => <PlanoCard key={p.id} p={p} onEditar={pode ? () => setEditar(p) : undefined} onAbrirOrdem={setOrdemId} />)}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Ordens de manutenção" acao={
        <div className="flex flex-wrap gap-2">
          {pode && <Button tamanho="sm" icone={Plus} onClick={() => setNova(true)}>Nova ordem</Button>}
          {lista.length > recentes.length && <Button tamanho="sm" variante="terciario" to={`/manutencao?aba=ordens&centroId=${centroId}`}>Ver todas ({lista.length})</Button>}
        </div>
      }>
        {ordens.isLoading ? <Carregando linhas={2} rotulo="Carregando ordens" /> : ordens.isError ? <ErroEstado erro={ordens.error} tentar={() => ordens.refetch()} /> : !recentes.length ? (
          <p className="m-0 text-[14px] text-ink-2">Nenhuma ordem registrada para este centro.</p>
        ) : (
          <div className="rounded-field border border-border overflow-hidden"><ListaOrdens ordens={recentes} mostrarCentro={false} onAbrir={(o) => setOrdemId(o.id)} /></div>
        )}
      </Bloco>

      <Bloco titulo="Paradas">
        {ordens.isLoading ? null : !paradas.length ? (
          <p className="m-0 text-[14px] text-ink-2">Nenhuma parada por manutenção registrada.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {paradas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-t border-border first:border-t-0 text-[14px]">
                {p.quebra ? <Siren className="size-4 text-bad flex-none" aria-hidden /> : <CalendarClock className="size-4 text-steel flex-none" aria-hidden />}
                <span className="mono text-ink-2">{data(p.inicio)}{p.fim && data(p.fim) !== data(p.inicio) ? ` → ${data(p.fim)}` : ''}</span>
                <span className="flex-[1_1_180px] min-w-0 break-words">{p.quebra ? 'Quebra' : 'Preventiva'} · {p.motivo}</span>
                {p.horasParado != null && <span className="mono text-ink-2">{horas(p.horasParado, 1)}</span>}
                {p.aberta && <Pill tom="bad">Parado agora</Pill>}
                <button type="button" className="mono text-[13.5px] font-medium text-primary-text underline underline-offset-2" onClick={() => setOrdemId(p.id)}>{p.numero}</button>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Custo de manutenção" acao={<Link to={`/manutencao?aba=proposta`} className="text-[13.5px] font-medium">Proposta ao Motor de Custos</Link>}>
        <CustoManutencaoCentro centroId={centroId} cadastro={cadastro} />
      </Bloco>

      {editar && <PlanoForm plano={editar === 'novo' ? null : editar} centroId={centroId} onFechar={fecharPlano} />}
      {ordemId && <OrdemSheet id={ordemId} planos={planos.data} onFechar={fecharOrdem} />}
      {quebra && <RegistrarQuebra centroId={centroId} onFechar={fecharQuebra} onAbrirOrdem={(id) => { setQuebra(false); setOrdemId(id); }} />}
      {nova && <NovaOrdem centroId={centroId} planos={planos.data} onFechar={fecharNova} onCriada={(o) => setOrdemId(o.id)} />}
    </section>
  );
}
