import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, RefreshCw, Rocket, Trash2, TriangleAlert, XCircle } from 'lucide-react';
import type { Ocorrencia, ResultadoCentro } from '@promec/motor';
import { api, ApiError } from '../lib/api';
import type { TabelaDetalhe as Detalhe } from '../lib/types';
import { brl, competenciaLonga, data, horas, num, pct, toNum } from '../lib/format';
import { useAcao, useTabela } from '../lib/queries';
import { CRITERIO, TIPO_CENTRO, corTipoCentro } from '../lib/rotulos';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { Pill, StatusTabelaPill } from '../components/Pill';
import { CompositionBar, COR_CENTRO, fatias } from '../components/CompositionBar';
import { ExplainTree } from '../components/ExplainTree';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { useTitulo } from '../layout/titulo';
import { podeLiberarMargem, useAuth } from '../lib/auth';

function ListaOcorrencias({ itens, nomes }: { itens: Ocorrencia[]; nomes: Map<string, string> }) {
  return (
    <ul className="m-0 pl-0 list-none flex flex-col gap-1.5">
      {itens.map((o, i) => (
        <li key={`${o.codigo}-${i}`} className="flex gap-2 items-start text-[14px]">
          <span className="mt-2 size-1.5 rounded-full bg-current flex-none" aria-hidden />
          <span>
            {o.mensagem}
            {o.centroId && nomes.get(o.centroId) && (
              <>
                {' '}
                <Link to={`/centros-trabalho/${o.centroId}`} className="font-semibold">Abrir {nomes.get(o.centroId)}</Link>
              </>
            )}
            {o.colaboradorId && (
              <>
                {' '}
                <Link to={`/colaboradores/${o.colaboradorId}`} className="font-semibold">Ver o cadastro</Link>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Variacao({ v }: { v: string }) {
  const x = toNum(v);
  if (Math.abs(x) < 0.0005) return <Pill tom="neutral" icone={Minus}>igual</Pill>;
  return x > 0 ? <Pill tom={x > 0.05 ? 'bad' : 'warn'} icone={ArrowUpRight}>+{pct(x)}</Pill> : <Pill tom="ok" icone={ArrowDownRight}>{pct(x)}</Pill>;
}

function CentroCard({ c }: { c: ResultadoCentro }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Card as="article" className="p-5 flex flex-col gap-4 anim-subir" aria-labelledby={`c-${c.id}`}>
      <div className="flex items-start gap-3">
        <span className="chip-ico text-white" style={{ background: corTipoCentro[c.tipo] ?? '#5B6B7F' }}>
          <span className="font-display font-bold text-[14px]">{c.nome.slice(0, 2).toUpperCase()}</span>
        </span>
        <div className="flex-1 min-w-0">
          <h3 id={`c-${c.id}`} className="m-0 font-sans text-headline truncate">
            <Link to={`/centros-trabalho/${c.id}`} className="text-ink-1 no-underline hover:underline">{c.nome}</Link>
          </h3>
          <span className="text-caption text-ink-3">{TIPO_CENTRO[c.tipo]} · {horas(c.horasReais, 0)} reais no mês</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[13px] text-ink-2">Custo-hora cheio</span>
          <span className="mono text-[34px] font-bold tracking-[-.03em] leading-none">{brl(c.cheioHora)}<span className="text-[15px] text-ink-3 font-medium">/h</span></span>
        </div>
        <dl className="m-0 grid grid-cols-3 gap-3 text-right">
          {[
            ['Específico', c.especificoHora],
            ['Rateio', c.rateioHora],
            ['Marginal', c.marginalHora]
          ].map(([l, v]) => (
            <div key={l} className="flex flex-col">
              <dt className="text-caption text-ink-3">{l}</dt>
              <dd className="m-0 mono text-[14px] font-semibold">{num(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <CompositionBar itens={fatias(c.composicaoHora as unknown as Record<string, string>, COR_CENTRO)} unidade="R$/h" rotulo={`Composição do custo-hora de ${c.nome}`} />
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="self-start inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-text">
        <ChevronDown className={`size-4 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
        Como chegamos nesse valor
      </button>
      {aberto && (
        <div className="rounded-field bg-surface-2 p-3">
          <ExplainTree raiz={c.explicacao} />
        </div>
      )}
    </Card>
  );
}

export default function TabelaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useTabela(id);
  const { usuario } = useAuth();
  const gestor = podeLiberarMargem(usuario?.papel);
  const t = q.data;
  useTitulo(t ? `Tabela ${t.competencia} · v${t.versao}` : 'Tabela de Custos');
  const [publicar, setPublicar] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [bloqueiosApi, setBloqueiosApi] = useState<Ocorrencia[] | null>(null);

  const inval = [['tabelas-custos'], ['painel'], ['centros-trabalho']];
  const recalcular = useAcao(() => api<Detalhe>(`/tabelas-custos/${id}/recalcular`, { method: 'POST' }), {
    invalida: inval,
    sucesso: 'Recalculado com os cadastros de agora. Confira os números abaixo.'
  });
  const pub = useAcao(() => api<Detalhe>(`/tabelas-custos/${id}/publicar`, { method: 'POST' }), {
    invalida: inval,
    sucesso: 'Publicada! A partir de agora, todo orçamento novo usa estes valores.',
    onSuccess: () => setPublicar(false)
  });
  const del = useAcao(() => api(`/tabelas-custos/${id}`, { method: 'DELETE' }), {
    invalida: [['tabelas-custos']],
    sucesso: 'Rascunho descartado.',
    onSuccess: () => navigate('/tabelas-custos', { replace: true })
  });
  const novo = useAcao((c: string) => api<Detalhe>('/tabelas-custos', { method: 'POST', body: { competencia: c } }), {
    invalida: [['tabelas-custos']],
    sucesso: 'Rascunho criado com os cadastros de hoje.',
    onSuccess: (r) => r?.id && navigate(`/tabelas-custos/${r.id}`)
  });

  if (q.isLoading) return <Card><Carregando /></Card>;
  if (q.isError || !t) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;

  const r = t.resultado;
  const nomes = new Map(r.centros.map((c) => [c.id, c.nome]));
  const cheioMedio = t.resumo?.cheioMedio ?? (r.centros.length ? String(r.centros.reduce((a, c) => a + toNum(c.cheioHora), 0) / r.centros.length) : '0');
  const rascunho = t.status === 'RASCUNHO';
  const texto =
    t.status === 'RASCUNHO'
      ? 'Rascunho: fica tranquilo, os orçamentos seguem com a tabela vigente até você publicar esta.'
      : t.status === 'VIGENTE'
        ? t.desatualizada
          ? 'Algum cadastro mudou depois da publicação. Os orçamentos seguem com estes números até você publicar um rascunho novo.'
          : 'É esta tabela que os orçamentos novos usam agora.'
        : 'Versão encerrada, guardada para consulta. Orçamentos antigos continuam apontando para ela.';

  const tentarPublicar = () =>
    pub.mutate(undefined, {
      onError: (e) => {
        if (e instanceof ApiError && e.codigo === 'BLOQUEIOS') setBloqueiosApi((e.detalhes as Ocorrencia[]) ?? []);
      }
    });

  return (
    <>
      <HeroBand
        ilustracao="engrenagens"
        sobretitulo={<span className="inline-flex flex-wrap items-center gap-2">Tabela de Custos · versão {t.versao} <StatusTabelaPill status={t.status} desatualizada={t.desatualizada} /></span>}
        titulo={competenciaLonga(t.competencia).replace(/^./, (s) => s.toUpperCase())}
        texto={texto}
        acoes={
          rascunho ? (
            <>
              <Button variante="vidro" icone={Trash2} onClick={() => setExcluir(true)}>Descartar</Button>
              <Button variante="vidro" icone={RefreshCw} carregando={recalcular.isPending} onClick={() => recalcular.mutate(undefined)}>Recalcular</Button>
              {gestor ? (
                <Button variante="primario" icone={Rocket} onClick={() => { setBloqueiosApi(null); setPublicar(true); }}>Publicar</Button>
              ) : (
                <span className="glass-dark rounded-full px-4 h-11 inline-flex items-center text-[13.5px]">Publicar é com a gestão</span>
              )}
            </>
          ) : t.status === 'VIGENTE' && t.desatualizada ? (
            <Button variante="primario" icone={RefreshCw} carregando={novo.isPending} onClick={() => novo.mutate(t.competencia)}>Criar rascunho atualizado</Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Custo-hora médio" valor={brl(cheioMedio)} sub={`${r.centros.length} centros de trabalho`} />
          <HeroKpi rotulo="Custo fixo do mês" valor={brl(r.custoFixoTotal)} sub={<Link to="/custo-fixo" className="text-[#FFC08F]">ver lançamentos</Link>} />
          <HeroKpi rotulo="Horas reais" valor={horas(r.horasReaisTotais, 0)} sub="expediente × eficiência" />
          <HeroKpi rotulo="Rateio" valor={<span className="text-[24px]">{CRITERIO[r.criterioRateio]}</span>} sub={t.publicadaEm ? `publicada em ${data(t.publicadaEm)}` : `criada em ${data(t.criadaEm)}`} />
        </div>
      </HeroBand>

      {r.bloqueios.length > 0 && (
        <Aviso tom="bad" faixa titulo={`Antes de publicar, ${r.bloqueios.length === 1 ? 'uma coisa precisa' : `${r.bloqueios.length} coisas precisam`} de ajuste`}>
          <ListaOcorrencias itens={r.bloqueios} nomes={nomes} />
        </Aviso>
      )}
      {r.avisos.length > 0 && (
        <Aviso tom="warn" titulo="Vale conferir">
          <ListaOcorrencias itens={r.avisos} nomes={nomes} />
        </Aviso>
      )}

      {t.comparativo && t.comparativo.length > 0 && (
        <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-comp">
          <CardHeader id="h-comp" titulo="O que muda em relação à vigente anterior" sub="Custo-hora cheio, máquina por máquina" />
          <DataTable
            rotulo="Comparativo por centro"
            chave={(c) => c.centroId}
            linhas={t.comparativo}
            colunas={[
              { chave: 'n', titulo: 'Centro', principal: true, render: (c) => <span className="font-medium">{c.nome}</span> },
              { chave: 'a', titulo: 'Antes', alinhar: 'right', mono: true, render: (c) => <span className="text-ink-3">{brl(c.anterior)}</span> },
              { chave: 'b', titulo: 'Agora', alinhar: 'right', mono: true, render: (c) => <strong>{brl(c.atual)}</strong> },
              { chave: 'v', titulo: 'Variação', alinhar: 'right', render: (c) => <Variacao v={c.variacao} /> }
            ]}
          />
        </Card>
      )}

      <section aria-label="Centros de trabalho" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-[18px]">
        {r.centros.map((c) => <CentroCard key={c.id} c={c} />)}
      </section>

      <Modal
        aberto={publicar}
        onFechar={() => setPublicar(false)}
        faixa
        titulo={`Publicar a tabela de ${competenciaLonga(t.competencia)}?`}
        rodape={
          <>
            <Button onClick={() => setPublicar(false)}>Ainda não</Button>
            <Button variante="primario" icone={Rocket} carregando={pub.isPending} onClick={tentarPublicar} disabled={r.bloqueios.length > 0}>
              Publicar agora
            </Button>
          </>
        }
      >
        <p className="m-0 text-ink-2">A partir de agora, todo orçamento novo usa estes valores. Orçamentos aprovados continuam com a versão que usaram; a vigente atual passa a ser encerrada.</p>
        {t.comparativo && t.comparativo.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col divide-y divide-border rounded-field border border-border">
            {t.comparativo.map((c) => (
              <li key={c.centroId} className="flex items-center justify-between gap-3 px-3 py-2 text-[14px]">
                <span className="truncate">{c.nome}</span>
                <span className="flex items-center gap-2 mono">
                  {brl(c.anterior)} → <strong>{brl(c.atual)}</strong> <Variacao v={c.variacao} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {(bloqueiosApi ?? (r.bloqueios.length ? r.bloqueios : null)) && (
          <div role="alert" className="rounded-field bg-bad-soft p-3 flex flex-col gap-2">
            <strong className="flex items-center gap-2 text-bad"><XCircle className="size-[18px]" aria-hidden /> Ainda não dá para publicar</strong>
            <ListaOcorrencias itens={bloqueiosApi ?? r.bloqueios} nomes={nomes} />
          </div>
        )}
      </Modal>

      <Modal
        aberto={excluir}
        onFechar={() => setExcluir(false)}
        titulo="Descartar este rascunho?"
        rodape={
          <>
            <Button onClick={() => setExcluir(false)}>Manter</Button>
            <Button variante="perigo" icone={Trash2} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Descartar rascunho</Button>
          </>
        }
      >
        <p className="m-0 text-ink-2 flex gap-2"><TriangleAlert className="size-5 text-warn flex-none" aria-hidden />O rascunho some, mas os cadastros continuam como estão. Dá para criar outro a qualquer momento.</p>
      </Modal>
    </>
  );
}
