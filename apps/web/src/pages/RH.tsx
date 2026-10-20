import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, Gauge, Recycle, RefreshCw, ShieldPlus, Wrench } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useColaboradores } from '../lib/queries';
import { competenciaAtual, competenciaLonga, data, mesNome, num, pct, toNum } from '../lib/format';
import { useTitulo } from '../layout/titulo';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Segmented } from '../components/Field';
import { Pill } from '../components/Pill';
import { Abas, useAba } from '../components/Abas';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import {
  DIAS_SEMANA, ESTADO_CELULA, TIPO_AUSENCIA, ausentesEm, contarHabilitacoes, diasDoMes, dm, estadoCelula, celulaComPior, faixaNoMes, fraseCentro, fraseDisponibilidade, h, hojeISO, periodo, tomProdutividade, ultimoDia,
  type Ausencia, type CelulaMatriz, type Habilitacao, type ProdCentro, type ProdColaborador
} from '../features/rh/rh';
import { useAusencias, useDisponibilidade, useHabilitacoes, useMatriz, useProdutividade } from '../features/rh/queries';
import {
  AusenciaModal, BarrasMeses, CelulaModal, HabilitacaoModal, LegendaAusencias, LegendaMatriz, SituacaoHabPill, TipoAusenciaPill, type AusenciaInicial
} from '../features/rh/componentes';

const ABAS = ['ausencias', 'habilitacoes', 'disponibilidade', 'produtividade'] as const;
type Aba = (typeof ABAS)[number];

const kpi = (q: { isLoading: boolean; isError: boolean }, v: () => ReactNode) => (q.isLoading ? '…' : q.isError ? '—' : v());

export default function RH() {
  useTitulo('RH operacional');
  const [aba, setAba] = useAba<Aba>('ausencias', ABAS);
  const hoje = hojeISO();
  const mes = competenciaAtual();
  const ausHoje = useAusencias({ de: hoje, ate: hoje });
  const venc = useHabilitacoes(30);
  const disp = useDisponibilidade(mes);
  const nHoje = ausentesEm(ausHoje.data?.itens ?? [], hoje);
  const cont = contarHabilitacoes(venc.data?.itens ?? []);
  const reais = (disp.data?.centros ?? []).reduce((s, c) => s + toNum(c.horasDisponiveisReais), 0);
  const cadastro = (disp.data?.centros ?? []).reduce((s, c) => s + toNum(c.horasExpedienteCadastro), 0);
  const nomesHoje = [...new Set((ausHoje.data?.itens ?? []).map((a) => a.colaborador?.nome.split(' ')[0]).filter(Boolean))];

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <HeroBand
        ilustracao="engrenagens"
        sobretitulo="RH operacional"
        titulo="Quem está na fábrica"
        texto="Férias, habilitações e horas reais de cada pessoa. O que acontece aqui muda a capacidade do planejamento e o custo-hora dos centros."
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          <HeroKpi rotulo="Ausentes hoje" valor={kpi(ausHoje, () => nHoje)} sub={nHoje ? nomesHoje.slice(0, 3).join(', ') + (nomesHoje.length > 3 ? '…' : '') : 'equipe completa'} />
          <HeroKpi rotulo="Habilitações" valor={kpi(venc, () => cont.vencendo + cont.vencidas)} sub={venc.data ? `${cont.vencendo} vencendo em 30 dias · ${cont.vencidas} ${cont.vencidas === 1 ? 'vencida' : 'vencidas'}` : 'vencendo ou vencidas'} />
          <HeroKpi
            rotulo={`Horas reais em ${mesNome(mes)}`}
            valor={kpi(disp, () => h(reais))}
            sub={disp.data ? `cadastro ${h(cadastro)}${Math.abs(reais - cadastro) >= 0.05 ? ` (${reais < cadastro ? '−' : '+'}${h(Math.abs(reais - cadastro))})` : ''}` : 'soma dos centros'}
          />
        </div>
      </HeroBand>

      <Abas
        rotulo="Seções do RH"
        valor={aba}
        onChange={setAba}
        abas={[
          { valor: 'ausencias', rotulo: 'Ausências', n: nHoje },
          { valor: 'habilitacoes', rotulo: 'Habilitações', n: cont.vencendo + cont.vencidas },
          { valor: 'disponibilidade', rotulo: 'Disponibilidade' },
          { valor: 'produtividade', rotulo: 'Produtividade' }
        ]}
      />

      <div role="tabpanel" className="min-w-0">
        {aba === 'ausencias' && <AbaAusencias />}
        {aba === 'habilitacoes' && <AbaHabilitacoes />}
        {aba === 'disponibilidade' && <AbaDisponibilidade />}
        {aba === 'produtividade' && <AbaProdutividade />}
      </div>
    </div>
  );
}

/* ---------- Ausências ---------- */

function AbaAusencias() {
  const podeGerir = useAuth().pode('rh.gerenciar');
  const [comp, setComp] = useState(competenciaAtual());
  const de = `${comp}-01`;
  const ate = ultimoDia(comp);
  const q = useAusencias({ de, ate });
  const colabs = useColaboradores();
  const [modal, setModal] = useState<{ ausencia?: Ausencia; inicial?: AusenciaInicial } | null>(null);
  const dias = useMemo(() => diasDoMes(comp), [comp]);
  const hoje = hojeISO();
  const pessoas = useMemo(() => (colabs.data?.itens ?? []).filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao })), [colabs.data]);
  const itens = q.data?.itens ?? [];
  const porPessoa = (id: string) => itens.filter((a) => a.colaboradorId === id);
  const N = dias.length;
  const colunas = `repeat(${N}, minmax(26px, 1fr))`;
  const semAusencia = pessoas.filter((p) => porPessoa(p.id).length === 0);

  return (
    <Card className="overflow-hidden anim-subir" aria-label="Ausências do mês">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3 border-b border-border">
        <CardHeader
          titulo="Ausências e escala"
          sub="Férias, afastamentos, treinamentos, faltas e folgas. Nos dias fora, a capacidade dos centros cai na mesma proporção."
          acao={podeGerir && <Button variante="primario" icone={CalendarPlus} onClick={() => setModal({ inicial: { inicio: comp === competenciaAtual() ? hoje : de } })}>Nova ausência</Button>}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CompetenciaPicker valor={comp} onChange={setComp} />
          <LegendaAusencias />
        </div>
      </div>
      {q.isLoading || colabs.isLoading ? (
        <Carregando rotulo="Carregando ausências" />
      ) : q.isError || colabs.isError ? (
        <ErroEstado erro={q.error ?? colabs.error} tentar={() => { q.refetch(); colabs.refetch(); }} />
      ) : pessoas.length === 0 ? (
        <EmptyState titulo="Ninguém cadastrado ainda" texto="Cadastre os funcionários para registrar férias, folgas e treinamentos." acao={<Button to="/colaboradores/novo" variante="primario">Cadastrar funcionário</Button>} />
      ) : (
        <>
          {itens.length === 0 && <p className="m-0 px-5 pt-4 text-[14px] text-ink-2">Ninguém fora em {competenciaLonga(comp)}. Toda a equipe conta na capacidade.</p>}
          {/* Grade do mês (tablet e desktop) */}
          <div className="hidden md:block relative overflow-x-auto p-4">
            <div className="grid text-[12px]" style={{ gridTemplateColumns: `minmax(150px, 190px) ${colunas}`, minWidth: 190 + N * 26 }} role="group" aria-label={`Calendário de ausências de ${competenciaLonga(comp)}`}>
              <div className="contents" aria-hidden>
                <span className="sticky left-0 z-20 bg-surface-1 px-2 py-1.5 text-ink-3 font-semibold">Pessoa</span>
                {dias.map((d) => (
                  <span
                    key={d.data}
                    className={`text-center py-1 flex flex-col leading-tight ${d.fimDeSemana ? 'bg-surface-3 text-ink-3' : 'text-ink-2'} ${d.data === hoje ? 'text-primary-text font-bold' : ''}`}
                  >
                    <span aria-hidden>{DIAS_SEMANA[d.semana]!.curto}</span>
                    <span className="mono" aria-hidden>{d.dia}</span>
                  </span>
                ))}
              </div>
              {pessoas.map((p) => (
                <div key={p.id} className="contents">
                  <Link to={`/colaboradores/${p.id}`} className="sticky left-0 z-20 bg-surface-1 border-t border-border px-2 h-11 flex items-center text-[13.5px] font-medium text-ink-1 no-underline truncate hover:underline">
                    <span className="truncate">{p.nome}</span>
                  </Link>
                  <div className="relative grid border-t border-border h-11" style={{ gridColumn: '2 / -1', gridTemplateColumns: colunas }}>
                    {dias.map((d) => (
                      <span
                        key={d.data}
                        aria-hidden
                        title={podeGerir ? `Registrar ausência de ${p.nome.split(' ')[0]} em ${dm(d.data)}` : undefined}
                        onClick={podeGerir ? () => setModal({ inicial: { colaboradorId: p.id, inicio: d.data, fim: d.data } }) : undefined}
                        className={`border-l border-border ${d.fimDeSemana ? 'bg-surface-3' : ''} ${d.data === hoje ? 'bg-primary-soft' : ''} ${podeGerir ? 'cursor-pointer hover:bg-surface-2' : ''}`}
                        style={{ gridRow: 1, gridColumn: d.dia }}
                      />
                    ))}
                    {porPessoa(p.id).map((a) => {
                      const fx = faixaNoMes(a, comp);
                      if (!fx) return null;
                      const t = TIPO_AUSENCIA[a.tipo];
                      const texto = `${p.nome.split(' ')[0]} ${t?.estado ?? 'ausente'} ${periodo(a)}${a.observacao ? ` · ${a.observacao}` : ''}`;
                      const cls = `relative z-10 my-1.5 mx-px min-w-0 px-1.5 flex items-center border-l-4 ${t?.barra ?? 'bg-surface-3 border-neutral'} ${fx.continuaAntes ? 'rounded-l-none' : 'rounded-l-[6px]'} ${fx.continuaDepois ? 'rounded-r-none' : 'rounded-r-[6px]'} text-[11.5px] font-semibold text-ink-1 overflow-hidden whitespace-nowrap text-left`;
                      const estilo = { gridRow: 1, gridColumn: `${fx.coluna} / span ${fx.dias}` };
                      return podeGerir ? (
                        <button key={a.id} type="button" className={`${cls} hover:shadow-1`} style={estilo} title={texto} aria-label={`Editar: ${texto}`} onClick={() => setModal({ ausencia: a })}>
                          <span className="truncate">{fx.dias >= 3 ? t?.rotulo : ''}</span>
                        </button>
                      ) : (
                        <span key={a.id} className={cls} style={estilo} title={texto} role="note" aria-label={texto}>
                          <span className="truncate" aria-hidden>{fx.dias >= 3 ? t?.rotulo : ''}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Lista por pessoa (celular) */}
          <ul className="md:hidden m-0 p-0 list-none">
            {pessoas.filter((p) => porPessoa(p.id).length > 0).map((p) => (
              <li key={p.id} className="px-5 py-3 border-t border-border flex flex-col gap-2">
                <Link to={`/colaboradores/${p.id}`} className="font-semibold text-ink-1 no-underline">{p.nome}</Link>
                <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                  {porPessoa(p.id).map((a) => (
                    <li key={a.id}>
                      <button type="button" disabled={!podeGerir} onClick={() => setModal({ ausencia: a })} className={`w-full flex flex-wrap items-center gap-2 p-2.5 rounded-[12px] border-l-4 text-left ${TIPO_AUSENCIA[a.tipo]?.barra ?? ''} disabled:cursor-default`} aria-label={`${TIPO_AUSENCIA[a.tipo]?.rotulo} de ${data(a.inicio)} a ${data(a.fim)}${podeGerir ? ', editar' : ''}`}>
                        <span className="font-medium">{TIPO_AUSENCIA[a.tipo]?.rotulo ?? a.tipo}</span>
                        <span className="mono text-[13px] text-ink-2">{periodo(a)}</span>
                        {a.observacao && <span className="basis-full text-caption text-ink-2 break-words">{a.observacao}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {semAusencia.length > 0 && itens.length > 0 && (
              <li className="px-5 py-3 border-t border-border text-caption text-ink-3">Sem ausência no mês: {semAusencia.map((p) => p.nome.split(' ')[0]).join(', ')}.</li>
            )}
          </ul>
        </>
      )}
      {modal && <AusenciaModal ausencia={modal.ausencia} inicial={modal.inicial} colaboradores={pessoas} onFechar={() => setModal(null)} />}
    </Card>
  );
}

/* ---------- Habilitações ---------- */

type ModalHab = { tipo: 'celula'; colaboradorId: string; centroId: string } | { tipo: 'nova'; colaboradorId?: string; centroId?: string } | { tipo: 'renovar' | 'editar'; hab: Habilitacao };

function AbaHabilitacoes() {
  const podeGerir = useAuth().pode('rh.gerenciar');
  const [sp] = useSearchParams();
  const janela = Math.max(0, Math.min(365, Number(sp.get('vencendo')) || 30));
  const matriz = useMatriz();
  const todas = useHabilitacoes();
  const vencendo = useHabilitacoes(janela);
  const [modal, setModal] = useState<ModalHab | null>(null);
  const colaboradores = matriz.data?.colaboradores ?? [];
  const centros = matriz.data?.centros ?? [];
  const celula = (colaboradorId: string, centroId: string): CelulaMatriz | null =>
    celulaComPior(matriz.data?.celulas.find((c) => c.colaboradorId === colaboradorId && c.centroId === centroId) ?? null, todas.data?.itens ?? [], { colaboradorId, centroId });
  const atencao = (matriz.data?.celulas ?? []).filter((c) => estadoCelula(c).atencao && estadoCelula(c).estado !== 'vencendo').length;
  const nome = (id: string, lista: { id: string; nome: string }[]) => lista.find((x) => x.id === id)?.nome ?? '';
  const fecharVoltandoACelula = () => setModal((m) => (m && 'hab' in m ? { tipo: 'celula', colaboradorId: m.hab.colaboradorId, centroId: m.hab.centroId } : m && m.tipo === 'nova' && m.colaboradorId && m.centroId ? { tipo: 'celula', colaboradorId: m.colaboradorId, centroId: m.centroId } : null));

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden anim-subir" aria-label="Matriz de habilitações">
        <div className="px-5 pt-5 pb-4 flex flex-col gap-3 border-b border-border">
          <CardHeader
            titulo="Quem pode trabalhar onde"
            sub="Cada célula cruza a pessoa com o centro. O número é a alocação. Sem habilitação válida, a alocação, a agenda e o apontamento recusam."
            acao={podeGerir && <Button variante="primario" icone={ShieldPlus} onClick={() => setModal({ tipo: 'nova' })}>Nova habilitação</Button>}
          />
          <LegendaMatriz />
          {atencao > 0 && <Aviso tom="bad" titulo={`${atencao} ${atencao === 1 ? 'alocação precisa' : 'alocações precisam'} de atenção`}>Tem gente alocada com habilitação vencida ou sem habilitação. Clique na célula com borda vermelha para resolver.</Aviso>}
        </div>
        {matriz.isLoading ? (
          <Carregando rotulo="Carregando matriz" />
        ) : matriz.isError ? (
          <ErroEstado erro={matriz.error} tentar={() => matriz.refetch()} />
        ) : !colaboradores.length || !centros.length ? (
          <EmptyState titulo="Matriz vazia" texto="Cadastre colaboradores e centros de trabalho para montar a matriz de habilitações." />
        ) : (
          <div className="relative overflow-x-auto p-4">
            <table className="border-separate border-spacing-1 text-[13px]">
              <caption className="sr-only">Habilitação e alocação de cada colaborador em cada centro</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-surface-1 text-left text-ink-3 font-semibold px-2 min-w-[140px]">Pessoa</th>
                  {centros.map((c) => (
                    <th key={c.id} scope="col" className="px-1 text-center font-semibold text-ink-2 min-w-[76px] max-w-[110px]" title={c.nome}>
                      <span className="mono block text-[12px]">{c.codigo}</span>
                      <span className="block truncate text-[11.5px] font-normal text-ink-3 max-w-[110px]">{c.nome}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colaboradores.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="sticky left-0 z-10 bg-surface-1 text-left font-medium px-2 max-w-[180px]">
                      <span className="block truncate">{p.nome}</span>
                      {p.funcao && <span className="block truncate text-caption font-normal text-ink-3">{p.funcao}</span>}
                    </th>
                    {centros.map((ct) => {
                      const c = celula(p.id, ct.id);
                      const { estado, alocado, atencao: at } = estadoCelula(c);
                      const e = ESTADO_CELULA[estado];
                      const rot = `${p.nome} no ${ct.nome}: ${e.rotulo}${alocado ? `, alocado ${pct(c?.alocacao, 0)}` : ''}${c?.habilitacao ? `, validade ${data(c.habilitacao.validade)}` : ''}`;
                      const conteudo = alocado ? <span className="mono font-semibold">{pct(c?.alocacao, 0)}</span> : c?.habilitacao ? <span aria-hidden>{c.habilitacao.situacao === 'ok' ? '✓' : c.habilitacao.situacao === 'vencendo' ? '!' : '×'}</span> : <span aria-hidden>·</span>;
                      const cls = `w-full h-10 rounded-[10px] border ${at && estado !== 'vencendo' ? 'border-2' : ''} ${e.classe} grid place-items-center`;
                      return (
                        <td key={ct.id} className="p-0">
                          {c || podeGerir ? (
                            <button type="button" className={`${cls} hover:shadow-1 transition`} title={rot} aria-label={rot} onClick={() => setModal({ tipo: 'celula', colaboradorId: p.id, centroId: ct.id })}>{conteudo}</button>
                          ) : (
                            <span className={cls} title={rot}><span className="sr-only">{rot}</span>{conteudo}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden anim-subir" aria-label="Habilitações vencendo">
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <CardHeader titulo={`Vencendo nos próximos ${janela} dias`} sub="Inclui as que já venceram. Renove antes para não travar a agenda nem o apontamento." />
        </div>
        {vencendo.isLoading ? (
          <Carregando linhas={3} rotulo="Carregando habilitações" />
        ) : vencendo.isError ? (
          <ErroEstado erro={vencendo.error} tentar={() => vencendo.refetch()} />
        ) : !vencendo.data?.itens.length ? (
          <p className="m-0 p-8 text-center text-ink-2">Tudo em dia. Nenhuma habilitação vence nos próximos {janela} dias.</p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {vencendo.data.itens.map((hb) => (
              <li key={hb.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-t border-border first:border-t-0">
                <span className="flex-[1_1_220px] min-w-0 flex flex-col">
                  <span className="font-medium break-words">{hb.colaborador?.nome ?? 'Colaborador'} · {hb.descricao}</span>
                  <span className="text-caption text-ink-3">{hb.centroNome ?? 'Centro'} · {hb.situacao === 'vencida' ? 'venceu em' : 'vence em'} <span className="mono">{data(hb.validade)}</span></span>
                </span>
                <SituacaoHabPill situacao={hb.situacao} />
                {podeGerir && <Button tamanho="sm" icone={RefreshCw} onClick={() => setModal({ tipo: 'renovar', hab: hb })}>Renovar</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal?.tipo === 'celula' && (
        <CelulaModal
          celula={celula(modal.colaboradorId, modal.centroId)}
          colaborador={{ id: modal.colaboradorId, nome: nome(modal.colaboradorId, colaboradores) }}
          centro={{ id: modal.centroId, nome: nome(modal.centroId, centros) }}
          habilitacoes={(todas.data?.itens ?? []).filter((x) => x.colaboradorId === modal.colaboradorId && x.centroId === modal.centroId)}
          carregando={todas.isLoading}
          podeGerir={podeGerir}
          onFechar={() => setModal(null)}
          onNova={() => setModal({ tipo: 'nova', colaboradorId: modal.colaboradorId, centroId: modal.centroId })}
          onRenovar={(hb) => setModal({ tipo: 'renovar', hab: hb })}
          onEditar={(hb) => setModal({ tipo: 'editar', hab: hb })}
        />
      )}
      {modal && modal.tipo !== 'celula' && (
        <HabilitacaoModal
          habilitacao={'hab' in modal ? modal.hab : null}
          renovar={modal.tipo === 'renovar'}
          colaboradorId={modal.tipo === 'nova' ? modal.colaboradorId : undefined}
          centroId={modal.tipo === 'nova' ? modal.centroId : undefined}
          colaboradores={colaboradores}
          centros={centros}
          onFechar={fecharVoltandoACelula}
        />
      )}
    </div>
  );
}

/* ---------- Disponibilidade ---------- */

function AbaDisponibilidade() {
  const [sp, setSp] = useSearchParams();
  const daUrl = sp.get('competencia');
  const comp = daUrl && /^\d{4}-\d{2}$/.test(daUrl) ? daUrl : competenciaAtual();
  const setComp = (c: string) => { const n = new URLSearchParams(sp); n.set('competencia', c); setSp(n, { replace: true }); };
  const q = useDisponibilidade(comp);
  const linha = 'flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-border first:border-t-0';
  const Num = ({ rotulo, valor }: { rotulo: string; valor: ReactNode }) => (
    <span className="flex flex-col items-end min-w-[64px]">
      <span className="mono text-[14px] font-semibold">{valor}</span>
      <span className="text-[11.5px] text-ink-3">{rotulo}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-5 anim-subir">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompetenciaPicker valor={comp} onChange={setComp} />
        <span className="text-[13.5px] text-ink-2">Horas = jornada × dias úteis trabalhados ÷ dias úteis do mês, já sem os feriados.</span>
      </div>
      {q.isLoading ? (
        <Card><Carregando rotulo="Carregando disponibilidade" /></Card>
      ) : q.isError ? (
        <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>
      ) : (
        <>
          <Card className="overflow-hidden" aria-label="Disponibilidade por pessoa">
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <CardHeader titulo="Por pessoa" sub={`Horas que cada um tem para produzir em ${competenciaLonga(comp)}.`} />
            </div>
            {!q.data?.colaboradores.length ? (
              <p className="m-0 p-8 text-center text-ink-2">Nenhum colaborador ativo.</p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {q.data.colaboradores.map((c) => (
                  <li key={c.colaborador.id} className={linha}>
                    <span className="flex-[1_1_240px] min-w-0 flex flex-col">
                      <Link to={`/colaboradores/${c.colaborador.id}`} className="font-medium text-ink-1 no-underline hover:underline truncate">{c.colaborador.nome}</Link>
                      <span className={`text-[13px] ${c.diasAusente ? 'text-ink-1' : 'text-ink-3'}`}>{fraseDisponibilidade({ nome: c.colaborador.nome, jornada: c.jornada, diasUteis: c.diasUteis, diasAusente: c.diasAusente, horasDisponiveis: c.horasDisponiveis })}</span>
                      {c.ausencias.length > 0 && (
                        <span className="flex flex-wrap gap-1.5 mt-1">{c.ausencias.map((a) => <span key={a.id} className="inline-flex items-center gap-1"><TipoAusenciaPill tipo={a.tipo} /><span className="mono text-caption text-ink-3">{periodo(a)}</span></span>)}</span>
                      )}
                    </span>
                    <span className="flex gap-3 flex-wrap">
                      <Num rotulo="jornada" valor={h(c.jornada)} />
                      <Num rotulo="dias úteis" valor={c.diasUteis} />
                      <Num rotulo="ausente" valor={c.diasAusente ? <span className="text-warn">{c.diasAusente}</span> : 0} />
                      <Num rotulo="disponível" valor={<span className="text-primary-text">{h(c.horasDisponiveis)}</span>} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="overflow-hidden" aria-label="Disponibilidade por centro">
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <CardHeader titulo="Por centro de trabalho" sub="Horas reais = soma das horas dos operadores × alocação. Centro sem operador usa o cadastro." />
            </div>
            {!q.data?.centros.length ? (
              <p className="m-0 p-8 text-center text-ink-2">Nenhum centro ativo.</p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {q.data.centros.map((c) => {
                  const dif = toNum(c.horasDisponiveisReais) - toNum(c.horasExpedienteCadastro);
                  return (
                    <li key={c.centroId} className={linha}>
                      <span className="flex-[1_1_240px] min-w-0 flex flex-col">
                        <Link to={`/centros-trabalho/${c.centroId}`} className="font-medium text-ink-1 no-underline hover:underline truncate">{c.nome}</Link>
                        <span className="text-[13px] text-ink-2">{fraseCentro({ nome: c.nome, cadastro: c.horasExpedienteCadastro, reais: c.horasDisponiveisReais })}</span>
                      </span>
                      <span className="flex gap-3 items-center flex-wrap">
                        <Num rotulo="cadastro" valor={h(c.horasExpedienteCadastro)} />
                        <Num rotulo="real" valor={h(c.horasDisponiveisReais)} />
                        <Pill tom={Math.abs(dif) < 0.05 ? 'ok' : dif < 0 ? 'warn' : 'info'}>{Math.abs(dif) < 0.05 ? 'igual' : `${dif < 0 ? '−' : '+'}${h(Math.abs(dif))}`}</Pill>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- Produtividade ---------- */

function AbaProdutividade() {
  const [meses, setMeses] = useState<'3' | '6'>('3');
  const q = useProdutividade(Number(meses));
  const recal = (q.data?.centros ?? []).filter((c) => c.recalibrar);
  return (
    <div className="flex flex-col gap-5 anim-subir">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented<'3' | '6'> label="Período" value={meses} onChange={setMeses} tamanho="sm" opcoes={[{ valor: '3', rotulo: 'Últimos 3 meses' }, { valor: '6', rotulo: 'Últimos 6 meses' }]} />
        <span className="text-[13.5px] text-ink-2 max-w-[520px]">Produtividade = horas apontadas ÷ horas disponíveis. A linha tracejada é a eficiência usada na Tabela de Custos.</span>
      </div>
      {q.isLoading ? (
        <Card><Carregando rotulo="Carregando produtividade" /></Card>
      ) : q.isError ? (
        <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>
      ) : (
        <>
          {recal.length > 0 && (
            <Aviso tom="warn" titulo={`Hora de recalibrar ${recal.length === 1 ? recal[0]!.centro.nome : `${recal.length} centros`}`}>
              A produtividade ficou abaixo da eficiência da Tabela de Custos por 2 meses seguidos. O custo-hora está otimista: revise a eficiência no cadastro do centro e gere uma nova versão da tabela.
            </Aviso>
          )}
          <Card className="overflow-hidden" aria-label="Produtividade por centro">
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <CardHeader titulo="Por centro de trabalho" sub={rotuloPeriodo(q.data?.competencias)} />
            </div>
            {!q.data?.centros.length ? <p className="m-0 p-8 text-center text-ink-2">Nenhum centro ativo.</p> : (
              <ul className="m-0 p-0 list-none">{q.data.centros.map((c) => <LinhaProd key={c.centro.id} item={c} nome={c.centro.nome} link={`/centros-trabalho/${c.centro.id}`} eficiencia={c.eficienciaTabela} />)}</ul>
            )}
          </Card>
          <Card className="overflow-hidden" aria-label="Produtividade por pessoa">
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <CardHeader titulo="Por pessoa" sub="Comparada à eficiência do centro onde a pessoa passa mais tempo." />
            </div>
            {!q.data?.colaboradores.length ? <p className="m-0 p-8 text-center text-ink-2">Nenhum colaborador ativo.</p> : (
              <ul className="m-0 p-0 list-none">{q.data.colaboradores.map((c) => <LinhaProd key={c.colaborador.id} item={c} nome={c.colaborador.nome} link={`/colaboradores/${c.colaborador.id}`} />)}</ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

const rotuloPeriodo = (cs?: string[]) => (cs?.length ? `De ${competenciaLonga(cs[0])} a ${competenciaLonga(cs[cs.length - 1])}` : undefined);

function LinhaProd({ item, nome, link, eficiencia }: { item: ProdCentro | ProdColaborador; nome: string; link: string; eficiencia?: string }) {
  const ultimo = item.meses[item.meses.length - 1];
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-t border-border first:border-t-0">
      <span className="flex-[1_1_200px] min-w-0 flex flex-col">
        <Link to={link} className="font-medium text-ink-1 no-underline hover:underline truncate">{nome}</Link>
        <span className="text-caption text-ink-3">
          {ultimo ? `${num(ultimo.horasApontadas, 1)} h apontadas de ${num(ultimo.horasDisponiveis, 1)} h no último mês` : 'Sem dados'}
          {eficiencia && ` · tabela ${pct(eficiencia, 0)}`}
        </span>
      </span>
      <BarrasMeses meses={item.meses} eficiencia={eficiencia} rotulo={`Produtividade de ${nome} por mês`} />
      <span className="flex flex-col items-end min-w-[64px]">
        <span className="mono text-[18px] font-bold"><Pill tom={tomProdutividade(item.atual, eficiencia)} icone={Gauge}>{pct(item.atual, 0)}</Pill></span>
        <span className="text-[11.5px] text-ink-3">atual</span>
      </span>
      <span className="flex flex-wrap gap-2">
        <Pill tom={item.refugo ? 'bad' : 'neutral'} icone={Recycle} titulo="Peças refugadas no período">{item.refugo} refugo</Pill>
        <Pill tom={toNum(item.retrabalhoHoras) ? 'warn' : 'neutral'} icone={Wrench} titulo="Horas em operações de retrabalho">{h(item.retrabalhoHoras)} retrabalho</Pill>
        {item.recalibrar && <Pill tom="warn" icone={AlertTriangle} titulo="Abaixo da eficiência da Tabela de Custos por 2 meses seguidos: revise a eficiência do centro.">Recalibrar</Pill>}
      </span>
    </li>
  );
}
