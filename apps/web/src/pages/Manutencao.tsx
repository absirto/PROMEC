import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCheck, Plus, Siren } from 'lucide-react';
import { api } from '../lib/api';
import { brl, competenciaAtual, horas, pct, toNum } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useAcao, useCentros } from '../lib/queries';
import { useTitulo } from '../layout/titulo';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Segmented, Select } from '../components/Field';
import { Busca, FiltroChips } from '../components/DataTable';
import { Abas, useAba } from '../components/Abas';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import {
  centrosParados, estaAberta, hojeISO, STATUS_ORDEM, TIPO_ORDEM, type LinhaProposta, type Ordem, type Plano, type Proposta, type RespostaAceite, type StatusOrdem, type TipoOrdem
} from '../features/manutencao/manutencao';
import { useIndicadores, useOrdens, usePlanos } from '../features/manutencao/queries';
import { IndicadorCentroCard, ListaOrdens, PlanoCard } from '../features/manutencao/Blocos';
import { OrdemSheet } from '../features/manutencao/OrdemSheet';
import { PlanoForm } from '../features/manutencao/PlanoForm';
import { NovaOrdem } from '../features/manutencao/NovaOrdem';
import { RegistrarQuebra } from '../features/manutencao/Quebra';

const ABAS = ['planos', 'ordens', 'indicadores', 'proposta'] as const;
type Aba = (typeof ABAS)[number];

/** Lê e grava parâmetros da URL sem empilhar histórico. */
function useParam() {
  const [sp, setSp] = useSearchParams();
  const ref = useRef({ sp, setSp });
  ref.current = { sp, setSp };
  const set = useCallback((mudancas: Record<string, string | null | undefined>) => {
    const n = new URLSearchParams(ref.current.sp);
    for (const [k, v] of Object.entries(mudancas)) (v ? n.set(k, v) : n.delete(k));
    ref.current.setSp(n, { replace: true });
  }, []);
  return [sp, set] as const;
}

export default function Manutencao() {
  useTitulo('Manutenção');
  const [sp, setParam] = useParam();
  const [aba, setAba] = useAba<Aba>(sp.has('busca') || sp.has('status') || sp.has('ordem') ? 'ordens' : 'planos', ABAS);
  const pode = useAuth().pode('manutencao.gerenciar');
  const planos = usePlanos();
  const ordens = useOrdens();
  const ind = useIndicadores(6);
  const [quebra, setQuebra] = useState(false);
  const [novaOrdem, setNovaOrdem] = useState(false);
  const ordemId = sp.get('ordem');
  const abrirOrdem = useCallback((id: string) => setParam({ ordem: id }), [setParam]);
  const fecharOrdem = useCallback(() => setParam({ ordem: null }), [setParam]);
  const fecharQuebra = useCallback(() => setQuebra(false), []);
  const fecharNova = useCallback(() => setNovaOrdem(false), []);

  const ativos = (planos.data ?? []).filter((p) => p.ativo);
  const proximas = ativos.filter((p) => p.situacao.situacao !== 'ok');
  const vencidas = proximas.filter((p) => p.situacao.situacao === 'vencida').length;
  const abertas = (ordens.data ?? []).filter(estaAberta);
  const disp = ind.data?.centros.map((c) => toNum(c.indicadores.disponibilidade)) ?? [];
  const valor = (q: { isLoading: boolean; isError: boolean }, v: ReactNode) => (q.isLoading ? '…' : q.isError ? '—' : v);

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <HeroBand
        ilustracao="torno"
        sobretitulo="Manutenção de ativos"
        titulo="Máquina boa é máquina cuidada"
        texto="Preventivas no prazo, quebras registradas na hora e o custo real de cada centro voltando para o custo-hora."
        acoes={pode && (
          <>
            <Button variante="primario" icone={Siren} onClick={() => setQuebra(true)}>Registrar quebra</Button>
            <Button variante="vidro" icone={Plus} onClick={() => setNovaOrdem(true)}>Nova ordem</Button>
          </>
        )}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <HeroKpi rotulo="Ordens abertas" valor={valor(ordens, abertas.length)} sub={`${abertas.filter((o) => o.status === 'EM_EXECUCAO').length} em execução`} />
          <HeroKpi rotulo="Preventivas próximas" valor={valor(planos, proximas.length)} sub={vencidas ? `${vencidas} vencida(s)` : 'nenhuma vencida'} />
          <HeroKpi rotulo="Centros parados" valor={valor(ordens, centrosParados(ordens.data ?? [], hojeISO()))} sub="hoje, por manutenção" />
          <HeroKpi rotulo="Disponibilidade média" valor={valor(ind, disp.length ? pct(disp.reduce((a, b) => a + b, 0) / disp.length) : '—')} sub="últimos 6 meses" />
        </div>
      </HeroBand>

      <Abas
        rotulo="Seções da manutenção"
        valor={aba}
        onChange={setAba}
        abas={[
          { valor: 'planos', rotulo: 'Planos', n: proximas.length },
          { valor: 'ordens', rotulo: 'Ordens', n: abertas.length },
          { valor: 'indicadores', rotulo: 'Indicadores' },
          { valor: 'proposta', rotulo: 'Proposta ao Motor de Custos' }
        ]}
      />

      <div role="tabpanel" className="min-w-0">
        {aba === 'planos' && <AbaPlanos q={planos} pode={pode} onAbrirOrdem={abrirOrdem} />}
        {aba === 'ordens' && <AbaOrdens pode={pode} onAbrir={(o) => abrirOrdem(o.id)} onNova={() => setNovaOrdem(true)} />}
        {aba === 'indicadores' && <AbaIndicadores />}
        {aba === 'proposta' && <AbaProposta />}
      </div>

      {ordemId && <OrdemSheet id={ordemId} planos={planos.data} onFechar={fecharOrdem} />}
      {quebra && <RegistrarQuebra onFechar={fecharQuebra} onAbrirOrdem={(id) => { setQuebra(false); setParam({ aba: 'ordens', ordem: id }); }} />}
      {novaOrdem && <NovaOrdem planos={planos.data} onFechar={fecharNova} onCriada={(o) => setParam({ aba: 'ordens', ordem: o.id })} />}
    </div>
  );
}

/* ---------- Planos ---------- */

function AbaPlanos({ q, pode, onAbrirOrdem }: { q: ReturnType<typeof usePlanos>; pode: boolean; onAbrirOrdem: (id: string) => void }) {
  const [editar, setEditar] = useState<Plano | null | 'novo'>(null);
  const fechar = useCallback(() => setEditar(null), []);
  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; centroId: string; planos: Plano[] }>();
    for (const p of q.data ?? []) {
      const g = m.get(p.centroId) ?? { nome: p.centroNome ?? 'Centro', centroId: p.centroId, planos: [] };
      g.planos.push(p);
      m.set(p.centroId, g);
    }
    const peso = (p: Plano) => (!p.ativo ? 3 : p.situacao.situacao === 'vencida' ? 0 : p.situacao.situacao === 'proxima' ? 1 : 2);
    return [...m.values()].map((g) => ({ ...g, planos: g.planos.sort((a, b) => peso(a) - peso(b)) })).sort((a, b) => Math.min(...a.planos.map(peso)) - Math.min(...b.planos.map(peso)) || a.nome.localeCompare(b.nome));
  }, [q.data]);

  return (
    <Card className="p-5 flex flex-col gap-4 anim-subir" aria-labelledby="h-planos">
      <CardHeader id="h-planos" titulo="Planos preventivos" sub="Por horas de uso (apontadas nas OS) ou por calendário. A ordem abre sozinha quando o plano fica próximo."
        acao={pode && <Button variante="primario" icone={Plus} onClick={() => setEditar('novo')}>Novo plano</Button>} />
      {q.isLoading ? <Carregando rotulo="Carregando planos" /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : !grupos.length ? (
        <EmptyState ilustracao="engrenagens" titulo="Nenhum plano preventivo" texto="Comece pelo centro que mais para. Um plano de troca de óleo a cada 500 h já evita a maior parte das quebras."
          acao={pode && <Button variante="primario" icone={Plus} onClick={() => setEditar('novo')}>Criar o primeiro plano</Button>} />
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.map((g) => (
            <section key={g.centroId} aria-labelledby={`g-${g.centroId}`} className="flex flex-col gap-2">
              <h3 id={`g-${g.centroId}`} className="m-0 text-[16px] font-semibold flex items-center gap-2">
                <Link to={`/centros-trabalho/${g.centroId}`} className="text-ink-1 no-underline hover:underline">{g.nome}</Link>
                <span className="mono text-caption text-ink-3">{g.planos.length}</span>
              </h3>
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {g.planos.map((p) => <PlanoCard key={p.id} p={p} onEditar={pode ? () => setEditar(p) : undefined} onAbrirOrdem={onAbrirOrdem} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      {editar && <PlanoForm plano={editar === 'novo' ? null : editar} onFechar={fechar} />}
    </Card>
  );
}

/* ---------- Ordens ---------- */

function AbaOrdens({ pode, onAbrir, onNova }: { pode: boolean; onAbrir: (o: Ordem) => void; onNova: () => void }) {
  const [sp, setParam] = useParam();
  const status = (sp.get('status') ?? 'TODAS') as 'TODAS' | StatusOrdem;
  const tipo = (sp.get('tipo') ?? 'TODOS') as 'TODOS' | TipoOrdem;
  const centroId = sp.get('centroId') ?? '';
  const busca = sp.get('busca') ?? '';
  const centros = useCentros();
  const todas = useOrdens();
  const q = useOrdens({ status: status === 'TODAS' ? undefined : status, tipo: tipo === 'TODOS' ? undefined : tipo, centroId: centroId || undefined });
  const termo = busca.trim().toLowerCase();
  const linhas = (q.data ?? []).filter((o) => !termo || o.numero.toLowerCase().includes(termo) || o.descricao.toLowerCase().includes(termo) || (o.centroNome ?? '').toLowerCase().includes(termo));
  const filtrando = status !== 'TODAS' || tipo !== 'TODOS' || !!centroId || !!termo;
  const conta = (s: StatusOrdem) => todas.data?.filter((o) => o.status === s).length;

  // Link com o número exato da ordem (?busca=OM-…) abre a ficha uma vez.
  const aberta = useRef<string | null>(null);
  useEffect(() => {
    if (!termo || aberta.current === termo || !todas.data) return;
    const o = todas.data.find((x) => x.numero.toLowerCase() === termo);
    aberta.current = termo;
    if (o && !sp.get('ordem')) onAbrir(o);
  }, [termo, todas.data]);

  return (
    <Card className="overflow-hidden anim-subir" aria-labelledby="h-ordens">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3 border-b border-border">
        <CardHeader id="h-ordens" titulo="Ordens de manutenção" sub="Preventivas dos planos, corretivas das quebras e as abertas à mão. Custos entram no centro como manutenção."
          acao={pode && <Button variante="primario" icone={Plus} onClick={onNova}>Nova ordem</Button>} />
        <FiltroChips rotulo="Filtrar por situação" valor={status} onChange={(v) => setParam({ status: v === 'TODAS' ? null : v })}
          opcoes={[{ valor: 'TODAS', rotulo: 'Todas', n: todas.data?.length }, ...(Object.keys(STATUS_ORDEM) as StatusOrdem[]).map((s) => ({ valor: s, rotulo: STATUS_ORDEM[s][0], n: conta(s) }))]} />
        <div className="flex flex-wrap items-center gap-3">
          <FiltroChips rotulo="Filtrar por tipo" valor={tipo} onChange={(v) => setParam({ tipo: v === 'TODOS' ? null : v })}
            opcoes={[{ valor: 'TODOS' as const, rotulo: 'Qualquer tipo' }, ...(Object.keys(TIPO_ORDEM) as TipoOrdem[]).map((t) => ({ valor: t, rotulo: TIPO_ORDEM[t] }))]} />
          <Select aria-label="Filtrar por centro" className="flex-[1_1_200px] max-w-[280px]" value={centroId} onChange={(v) => setParam({ centroId: v || null })} vazio="Todos os centros"
            opcoes={(centros.data?.itens ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          <Busca valor={busca} onChange={(v) => setParam({ busca: v || null })} placeholder="Número, serviço ou centro" rotulo="Buscar ordem" />
        </div>
      </div>
      {q.isLoading ? <Carregando rotulo="Carregando ordens" /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : !linhas.length ? (
        filtrando ? (
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            <p className="m-0 text-ink-2">Nenhuma ordem com esse filtro.</p>
            <Button tamanho="sm" onClick={() => setParam({ status: null, tipo: null, centroId: null, busca: null })}>Limpar filtros</Button>
          </div>
        ) : (
          <EmptyState ilustracao="torno" titulo="Nenhuma ordem de manutenção" texto="As preventivas abrem sozinhas pelos planos. Quando algo quebrar, use Registrar quebra: a corretiva já nasce em execução e o centro sai do planejamento." />
        )
      ) : (
        <ListaOrdens ordens={linhas} onAbrir={onAbrir} />
      )}
    </Card>
  );
}

/* ---------- Indicadores ---------- */

function AbaIndicadores() {
  const [sp, setParam] = useParam();
  const meses = sp.get('meses') === '12' ? 12 : 6;
  const centroId = sp.get('centroId') ?? '';
  const q = useIndicadores(meses);
  const centros = useCentros();
  const mapa = new Map((centros.data?.itens ?? []).map((c) => [c.id, c]));
  const itens = (q.data?.centros ?? []).filter((c) => !centroId || c.centro.id === centroId);
  const alertas = itens.filter((c) => c.alerta).length;

  return (
    <div className="flex flex-col gap-4 anim-subir">
      <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-ind">
        <CardHeader id="h-ind" titulo="Indicadores por centro" sub="MTBF: horas produzindo entre quebras. MTTR: horas para voltar a produzir. Disponibilidade: tempo produzindo sobre produzindo mais parado." />
        <div className="flex flex-wrap items-end gap-3">
          <Segmented label="Período" tamanho="sm" value={String(meses)} onChange={(v) => setParam({ meses: v === '6' ? null : v })} opcoes={[{ valor: '6', rotulo: '6 meses' }, { valor: '12', rotulo: '12 meses' }]} />
          <Select aria-label="Filtrar por centro" className="flex-[1_1_200px] max-w-[280px]" value={centroId} onChange={(v) => setParam({ centroId: v || null })} vazio="Todos os centros"
            opcoes={(q.data?.centros ?? []).map((c) => ({ valor: c.centro.id, rotulo: c.centro.nome }))} />
        </div>
        {alertas > 0 && <Aviso tom="bad" titulo={`${alertas} centro(s) gastando mais de 30% acima da média da categoria`}>Veja abaixo a comparação entre manter e substituir.</Aviso>}
      </Card>
      {q.isLoading ? <Card><Carregando rotulo="Calculando indicadores" /></Card> : q.isError ? <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card> : !itens.length ? (
        <Card><EmptyState ilustracao="engrenagens" titulo="Sem centros para medir" texto="Os indicadores aparecem para os centros de trabalho ativos." /></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {itens.map((c) => <IndicadorCentroCard key={c.centro.id} c={c} centro={mapa.get(c.centro.id)} />)}
        </div>
      )}
    </div>
  );
}

/* ---------- Proposta ao Motor de Custos ---------- */

type Escolha = Record<string, { m: boolean; h: boolean }>;
const difere = (v: string) => Math.abs(toNum(v)) >= 0.005;

function AbaProposta() {
  const [sp, setParam] = useParam();
  const competencia = /^\d{4}-\d{2}$/.test(sp.get('competencia') ?? '') ? sp.get('competencia')! : competenciaAtual();
  const podeAceitar = useAuth().pode('custos.gerenciar');
  const q = useQuery({ queryKey: ['manutencao', 'proposta', competencia], queryFn: () => api<Proposta>('/manutencao/proposta', { query: { competencia } }), retry: false });
  const [escolha, setEscolha] = useState<Escolha>({});
  const [aceito, setAceito] = useState<RespostaAceite | null>(null);
  useEffect(() => {
    if (q.data) setEscolha(Object.fromEntries(q.data.centros.map((c) => [c.centroId, { m: difere(c.diferencaManutencao) && toNum(c.manutencaoProposta) > 0, h: difere(c.diferencaHoras) && toNum(c.horasDisponiveisReais) > 0 }])));
  }, [q.data]);
  const linhas = q.data?.centros ?? [];
  const selecionados = linhas.filter((c) => escolha[c.centroId]?.m || escolha[c.centroId]?.h);
  const aceitar = useAcao(
    () => api<RespostaAceite>('/manutencao/proposta/aceitar', {
      method: 'POST',
      body: { centros: selecionados.map((c) => ({ centroId: c.centroId, ...(escolha[c.centroId]?.m ? { manutencao: c.manutencaoProposta } : {}), ...(escolha[c.centroId]?.h ? { horasExpediente: c.horasDisponiveisReais } : {}) })) }
    }),
    { invalida: [['manutencao'], ['centros-trabalho'], ['tabelas-custos'], ['painel']], sucesso: (r) => `Cadastro de ${r.centros.length} centro(s) atualizado.`, onSuccess: (r) => setAceito(r) }
  );
  const marcar = (id: string, k: 'm' | 'h', v: boolean) => setEscolha({ ...escolha, [id]: { ...(escolha[id] ?? { m: false, h: false }), [k]: v } });
  const todasM = linhas.length > 0 && linhas.every((c) => escolha[c.centroId]?.m);
  const todasH = linhas.length > 0 && linhas.every((c) => escolha[c.centroId]?.h);
  const marcarTodas = (k: 'm' | 'h', v: boolean) => setEscolha(Object.fromEntries(linhas.map((c) => [c.centroId, { ...(escolha[c.centroId] ?? { m: false, h: false }), [k]: v }])));

  const Dif = ({ v, unidade }: { v: string; unidade: 'brl' | 'h' }) => {
    const n = toNum(v);
    if (!difere(v)) return <span className="text-ink-3">igual</span>;
    return <span className={n > 0 ? 'text-bad' : 'text-ok'}>{n > 0 ? '+' : '−'}{unidade === 'brl' ? brl(Math.abs(n)) : horas(Math.abs(n), 1)}</span>;
  };

  return (
    <Card className="overflow-hidden anim-subir" aria-labelledby="h-prop">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3 border-b border-border">
        <CardHeader id="h-prop" titulo="Proposta ao Motor de Custos"
          sub="Manutenção: média real dos últimos 6 meses. Horas: o que os operadores têm de fato no mês, já com férias e ausências."
          acao={<CompetenciaPicker valor={competencia} onChange={(c) => { setAceito(null); setParam({ competencia: c }); }} />} />
        {aceito ? (
          <Aviso tom="ok" titulo="Cadastro atualizado"
            acao={<Button to="/tabelas-custos" icone={ArrowRight}>Ir para Tabelas de Custos</Button>}>
            {aceito.tabelaDesatualizada ? 'A Tabela vigente agora está desatualizada. Gere um rascunho novo e publique para os orçamentos usarem os novos valores.' : 'Os novos valores entram no próximo rascunho da Tabela de Custos.'}
          </Aviso>
        ) : (
          <Aviso tom="warn" titulo="Aceitar muda o cadastro dos centros">A Tabela de Custos vigente fica marcada como desatualizada. Nada muda nos orçamentos até um novo rascunho ser publicado.</Aviso>
        )}
      </div>
      {q.isLoading ? <Carregando rotulo="Montando a proposta" /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : !linhas.length ? (
        <EmptyState ilustracao="engrenagens" titulo="Nada para propor" texto="A proposta aparece para os centros de trabalho ativos." />
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <table className="rt" aria-label={`Proposta de ${competencia}`}>
              <thead>
                <tr>
                  <th scope="col">Centro</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Manutenção no cadastro</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Proposta</th>
                  <th scope="col" style={{ textAlign: 'center' }}>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="size-4" checked={todasM} onChange={(e) => marcarTodas('m', e.target.checked)} disabled={!podeAceitar} aria-label="Usar a manutenção proposta em todos" />Usar</label>
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }}>Horas no cadastro</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Horas reais</th>
                  <th scope="col" style={{ textAlign: 'center' }}>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="size-4" checked={todasH} onChange={(e) => marcarTodas('h', e.target.checked)} disabled={!podeAceitar} aria-label="Usar as horas reais em todos" />Usar</label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((c: LinhaProposta) => (
                  <tr key={c.centroId}>
                    <td data-principal><Link to={`/centros-trabalho/${c.centroId}`} className="font-medium">{c.nome}</Link></td>
                    <td data-l="Manutenção no cadastro" className="mono" style={{ textAlign: 'right' }}>{brl(c.manutencaoCadastro)}</td>
                    <td data-l="Manutenção proposta" className="mono" style={{ textAlign: 'right' }}>{brl(c.manutencaoProposta)} <span className="block text-caption"><Dif v={c.diferencaManutencao} unidade="brl" /></span></td>
                    <td data-l="Usar manutenção" style={{ textAlign: 'center' }}>
                      <input type="checkbox" className="size-5" checked={!!escolha[c.centroId]?.m} disabled={!podeAceitar} onChange={(e) => marcar(c.centroId, 'm', e.target.checked)} aria-label={`Usar a manutenção proposta de ${c.nome}`} />
                    </td>
                    <td data-l="Horas no cadastro" className="mono" style={{ textAlign: 'right' }}>{horas(c.horasExpedienteCadastro, 1)}</td>
                    <td data-l="Horas reais" className="mono" style={{ textAlign: 'right' }}>{horas(c.horasDisponiveisReais, 1)} <span className="block text-caption"><Dif v={c.diferencaHoras} unidade="h" /></span></td>
                    <td data-l="Usar horas" style={{ textAlign: 'center' }}>
                      <input type="checkbox" className="size-5" checked={!!escolha[c.centroId]?.h} disabled={!podeAceitar} onChange={(e) => marcar(c.centroId, 'h', e.target.checked)} aria-label={`Usar as horas reais de ${c.nome}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-border flex flex-wrap items-center gap-3 justify-between bg-surface-2">
            <span className="text-[14px] text-ink-2">
              {podeAceitar ? (selecionados.length ? `${selecionados.length} centro(s) selecionado(s).` : 'Marque o que quer levar para o cadastro.') : 'Só quem cuida dos custos pode aceitar a proposta. Você pode conferir os números.'}
            </span>
            {podeAceitar && <Button variante="primario" icone={CheckCheck} disabled={!selecionados.length} carregando={aceitar.isPending} onClick={() => aceitar.mutate(undefined)}>Aceitar selecionadas</Button>}
          </div>
        </>
      )}
    </Card>
  );
}

