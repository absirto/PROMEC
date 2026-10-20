import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ClipboardCheck, Plus, Wallet } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ConsumoCentro, Item, LinhaABC, Lista, LocalEstoque, Lote, Movimento, OSResumo, SaldoLocal } from '../lib/types';
import { brl, competenciaAtual, data, num, pct, toNum } from '../lib/format';
import { useAcao, useCentros } from '../lib/queries';
import { HeroBand } from '../components/HeroBand';
import { Card, CardHeader, Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DecimalInput, NumberField, Select, SelectField, TextArea } from '../components/Field';
import { Busca, DataTable, FiltroChips } from '../components/DataTable';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { Abas, useAba } from '../components/Abas';
import { ItemPicker, useItens } from '../components/ItemPicker';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { SituacaoPill } from './ItensLista';
import { useTitulo } from '../layout/titulo';

const ABAS = ['saldos', 'movimentos', 'lotes', 'abc', 'consumo', 'inventario'] as const;
type Aba = (typeof ABAS)[number];
const lista = <T,>(x: T[] | Lista<T> | undefined | null): T[] => (Array.isArray(x) ? x : x?.itens ?? []);
const nome = (x: string | { nome: string } | null | undefined) => (x == null ? '—' : typeof x === 'string' ? x : x.nome);
const useLocais = () => useQuery({ queryKey: ['estoque', 'locais'], queryFn: () => api<LocalEstoque[] | Lista<LocalEstoque>>('/estoque/locais'), select: lista, staleTime: 5 * 60_000 });

const TIPOS_MOV = {
  SAIDA_CENTRO: 'Saída para centro', AJUSTE: 'Ajuste', TRANSFERENCIA: 'Transferência', PERDA: 'Perda', DEVOLUCAO: 'Devolução de OS', ENTRADA_AVULSA: 'Entrada avulsa'
} as const;
type TipoMov = keyof typeof TIPOS_MOV;
const ROTULO_MOV: Record<string, string> = { ...TIPOS_MOV, ENTRADA: 'Recebimento', ENTRADA_RECEBIMENTO: 'Recebimento', SAIDA_OS: 'Consumo em OS', ESTORNO: 'Estorno', ESTORNO_OS: 'Estorno de consumo', INVENTARIO: 'Inventário' };

export default function Estoque() {
  const { pode: podeFn_ } = useAuth();
  const podeGerir = podeFn_('estoque.gerenciar');
  useTitulo('Estoque');
  const [aba, setAba] = useAba<Aba>('saldos', ABAS);
  const [novo, setNovo] = useState(false);
  const saldos = useQuery({ queryKey: ['estoque', 'saldos', 'resumo'], queryFn: () => api<{ itens: SaldoLocal[]; totais?: { valor: string; itensAbaixoMinimo: number } }>('/estoque/saldos') });
  const tot = saldos.data?.totais;
  return (
    <>
      <HeroBand
        ilustracao="cofre"
        titulo="Estoque"
        texto={!tot ? 'Saldos por local, lotes com certificado e cada movimento com a origem.' : tot.itensAbaixoMinimo ? `${tot.itensAbaixoMinimo} ${tot.itensAbaixoMinimo === 1 ? 'item está' : 'itens estão'} abaixo do mínimo. O ponto de pedido em Compras já sabe quanto pedir.` : 'Tudo acima do mínimo. Cada saída ao custo médio, cada lote com o seu certificado.'}
        acoes={<><Button variante="vidro" to="/compras">Compras</Button>{podeGerir && <Button variante="primario" icone={Plus} onClick={() => setNovo(true)}>Novo movimento</Button>}</>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="primary" icone={<Wallet className="size-5" aria-hidden />} valor={tot ? brl(tot.valor) : '—'} rotulo="valor em estoque" />
        <Kpi tom={tot?.itensAbaixoMinimo ? 'warn' : 'ok'} icone={<AlertTriangle className="size-5" aria-hidden />} valor={tot?.itensAbaixoMinimo ?? '—'} rotulo="itens abaixo do mínimo" />
      </div>
      <Abas<Aba> rotulo="Visões do estoque" valor={aba} onChange={setAba} abas={[
        { valor: 'saldos', rotulo: 'Saldos' }, { valor: 'movimentos', rotulo: 'Movimentos' }, { valor: 'lotes', rotulo: 'Lotes' },
        { valor: 'abc', rotulo: 'Curva ABC' }, { valor: 'consumo', rotulo: 'Consumo por centro' }, { valor: 'inventario', rotulo: 'Inventário' }
      ]} />
      {aba === 'saldos' && <Saldos />}
      {aba === 'movimentos' && <Movimentos />}
      {aba === 'lotes' && <Lotes />}
      {aba === 'abc' && <CurvaABC />}
      {aba === 'consumo' && <Consumo />}
      {aba === 'inventario' && <Inventario />}
      {novo && <NovoMovimento onFechar={() => setNovo(false)} />}
    </>
  );
}

function Saldos() {
  const locais = useLocais();
  const [localId, setLocal] = useState('');
  const [busca, setBusca] = useState('');
  const [baixo, setBaixo] = useState(false);
  const q = useQuery({ queryKey: ['estoque', 'saldos', localId, busca, baixo], queryFn: () => api<Lista<SaldoLocal> | SaldoLocal[]>('/estoque/saldos', { query: { localId, q: busca.trim(), abaixoDoMinimo: baixo ? 'true' : undefined } }), placeholderData: (p) => p });
  const linhas = lista(q.data);
  return (
    <Card className="overflow-hidden" aria-label="Saldos por local">
      <div className="px-4 py-3.5 flex flex-wrap gap-2.5 items-center border-b border-border">
        <Busca valor={busca} onChange={setBusca} placeholder="Buscar por código ou descrição" />
        <FiltroChips rotulo="Local" valor={localId} onChange={setLocal} opcoes={[{ valor: '', rotulo: 'Todos os locais' }, ...(locais.data ?? []).map((l) => ({ valor: l.id, rotulo: l.nome }))]} />
        <FiltroChips rotulo="Situação" valor={baixo ? 'b' : 't'} onChange={(v) => setBaixo(v === 'b')} opcoes={[{ valor: 't', rotulo: 'Todos' }, { valor: 'b', rotulo: 'Abaixo do mínimo' }]} />
      </div>
      {q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : linhas.length === 0 ? (
        <EmptyState ilustracao="cofre" titulo="Nada com esse filtro" texto="Troque o local ou limpe a busca. Itens sem movimento ainda não têm saldo." />
      ) : (
        <DataTable<SaldoLocal>
          rotulo="Saldos"
          linhas={linhas}
          chave={(s) => `${s.item.id}-${s.localId ?? 'sem'}`}
          href={(s) => `/itens/${s.item.id}`}
          rotuloLinha={(s) => s.item.descricao}
          colunas={[
            { chave: 'i', titulo: 'Item', principal: true, render: (s) => <span className="flex flex-col"><span className="font-semibold">{s.item.descricao}</span><span className="mono text-caption text-ink-3">{s.item.codigo} · {s.localNome ?? 'sem saldo em nenhum local'}</span></span> },
            { chave: 'f', titulo: 'Físico', alinhar: 'right', mono: true, render: (s) => num(s.fisico, 2) },
            { chave: 'r', titulo: 'Reservado', alinhar: 'right', mono: true, render: (s) => <span className="text-ink-3">{num(s.reservado, 2)}</span> },
            { chave: 'd', titulo: 'Disponível', alinhar: 'right', mono: true, render: (s) => <strong>{num(s.disponivel, 2)} <span className="text-ink-3 font-normal text-[12px]">{s.item.unidade}</span></strong> },
            { chave: 'c', titulo: 'Custo médio', alinhar: 'right', mono: true, render: (s) => brl(s.custoMedio) },
            { chave: 'v', titulo: 'Valor', alinhar: 'right', mono: true, render: (s) => brl(s.valor) },
            { chave: 's', titulo: 'Situação', render: (s) => <SituacaoPill s={s.situacao} /> }
          ]}
        />
      )}
    </Card>
  );
}

function Origem({ m }: { m: Movimento }) {
  const o = m.origem;
  if (!o) return null;
  const rot = o.numero ?? o.tipo.toLowerCase();
  if (o.tipo === 'OS' && o.id) return <Link to={`/ordens-servico/${o.id}`} className="mono">{rot}</Link>;
  if (o.tipo === 'CENTRO' && o.id) return <Link to={`/centros-trabalho/${o.id}`}>{rot}</Link>;
  return <span className="mono">{rot}</span>;
}

function Movimentos() {
  const [sp] = useSearchParams();
  const [itemId, setItem] = useState(sp.get('item') ?? '');
  const [tipo, setTipo] = useState('');
  const q = useQuery({ queryKey: ['estoque', 'movimentos', itemId, tipo], queryFn: () => api<Lista<Movimento>>('/estoque/movimentos', { query: { itemId, tipo } }), placeholderData: (p) => p });
  const movs = q.data?.itens ?? [];
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-movs">
      <CardHeader id="h-movs" titulo="Movimentos" sub="Do mais recente para o mais antigo, com de onde veio e para onde foi." />
      <div className="flex flex-wrap gap-2.5">
        <ItemPicker value={itemId} onChange={setItem} vazio="Todos os itens" className="flex-[2_1_260px]" />
        <Select aria-label="Tipo de movimento" value={tipo} onChange={setTipo} vazio="Todos os tipos" opcoes={Object.entries(ROTULO_MOV).map(([valor, rotulo]) => ({ valor, rotulo }))} className="flex-[1_1_180px]" />
      </div>
      {q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : movs.length === 0 ? (
        <p className="m-0 text-ink-2">Nenhum movimento com esse filtro.</p>
      ) : (
        <ol className="m-0 p-0 list-none relative">
          <span className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />
          {movs.map((m) => {
            const sai = toNum(m.quantidade) < 0;
            return (
              <li key={m.id} className="relative pl-9 py-2.5 flex flex-wrap gap-x-4 gap-y-1 items-baseline">
                <span className={`absolute left-0 top-3 size-6 rounded-full grid place-items-center ${sai ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'}`} aria-hidden>
                  {sai ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
                </span>
                <span className="flex-[2_1_220px] min-w-0 flex flex-col">
                  <span className={`font-medium text-[14.5px] ${m.estornado ? 'line-through text-ink-3' : ''}`}>{ROTULO_MOV[m.tipo] ?? m.tipo} · {m.item.descricao}{m.estornado ? ' (estornado)' : ''}</span>
                  <span className="text-caption text-ink-3">
                    {nome(m.local as never)}{m.lote ? ` · lote ${typeof m.lote === 'string' ? m.lote : m.lote.codigo}` : ''}{m.origem ? ' · ' : ''}<Origem m={m} />{m.observacao ? ` · ${m.observacao}` : ''}
                  </span>
                </span>
                <span className={`mono text-[14px] font-semibold ${sai ? 'text-bad' : 'text-ok'}`}>{sai ? '' : '+'}{num(m.quantidade, 2)} {m.item.unidade ?? ''}</span>
                <span className="mono text-[13px] text-ink-2 min-w-[90px] text-right">{brl(m.valor)}</span>
                <span className="mono text-caption text-ink-3 min-w-[130px] text-right">{data(m.data)} · {nome(m.usuario as never)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function Lotes() {
  const [itemId, setItem] = useState('');
  const itens = useItens();
  const q = useQuery({ queryKey: ['estoque', 'lotes', itemId], queryFn: () => api<Lote[] | Lista<Lote>>('/estoque/lotes', { query: { itemId } }) });
  const lotes = lista(q.data);
  const desc = (id: string) => itens.data?.find((i) => i.id === id)?.descricao ?? '—';
  return (
    <Card className="overflow-hidden" aria-label="Lotes">
      <div className="px-4 py-3.5 border-b border-border flex flex-wrap gap-3 items-center">
        <ItemPicker value={itemId} onChange={setItem} vazio="Todos os itens" className="flex-[1_1_280px] max-w-[520px]" />
        <span className="text-caption text-ink-3">Cada lote guarda o certificado do material. Clique para rastrear onde ele foi parar.</span>
      </div>
      {q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : lotes.length === 0 ? (
        <p className="m-0 p-6 text-ink-2">Nenhum lote ainda. Itens rastreáveis ganham lote no recebimento.</p>
      ) : (
        <DataTable<Lote>
          rotulo="Lotes"
          linhas={lotes}
          chave={(l) => l.id}
          href={(l) => `/qualidade?aba=rastreabilidade&lote=${l.id}`}
          rotuloLinha={(l) => l.codigo}
          colunas={[
            { chave: 'c', titulo: 'Lote', principal: true, render: (l) => <span className="flex flex-col"><span className="mono font-semibold">{l.codigo}</span><span className="text-caption text-ink-3">{desc(l.itemId)}</span></span> },
            { chave: 'f', titulo: 'Fornecedor', render: (l) => nome(l.fornecedor as never) },
            { chave: 'd', titulo: 'Entrada', mono: true, render: (l) => data(l.data) },
            { chave: 's', titulo: 'Saldo', alinhar: 'right', mono: true, render: (l) => `${num(l.saldo, 2)} / ${num(l.quantidadeInicial, 2)}` },
            { chave: 'k', titulo: 'Certificado', render: (l) => (l.certificado ? <span className="mono text-[13px]">{l.certificado.numero}{l.certificado.corrida ? ` · corrida ${l.certificado.corrida}` : ''}{l.certificado.norma ? ` · ${l.certificado.norma}` : ''}</span> : <Pill tom="warn">sem certificado</Pill>) }
          ]}
        />
      )}
    </Card>
  );
}

const COR_ABC = { A: 'var(--pm-primary)', B: 'var(--pm-steel)', C: 'var(--pm-chart-orcado)' };
function CurvaABC() {
  const [meses, setMeses] = useState('3');
  const q = useQuery({ queryKey: ['estoque', 'abc', meses], queryFn: () => api<LinhaABC[] | Lista<LinhaABC>>('/estoque/curva-abc', { query: { meses } }) });
  const linhas = lista(q.data);
  const max = Math.max(...linhas.map((l) => toNum(l.participacao)), 0.0001);
  const W = 640, H = 200, n = Math.max(linhas.length, 1), bw = W / n;
  const pontos = linhas.map((l, i) => `${(i + 0.5) * bw},${H - toNum(l.acumulado) * H}`).join(' ');
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-abc">
      <CardHeader id="h-abc" titulo="Curva ABC do consumo" sub="A: até 80% do valor consumido. B: até 95%. C: o resto." acao={<FiltroChips rotulo="Período" valor={meses} onChange={setMeses} opcoes={[{ valor: '3', rotulo: '3 meses' }, { valor: '6', rotulo: '6 meses' }, { valor: '12', rotulo: '12 meses' }]} />} />
      {q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : linhas.length === 0 ? <p className="m-0 text-ink-2">Sem consumo no período.</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H + 4}`} className="w-full h-auto" role="img" aria-label={`Curva ABC: ${linhas.filter((l) => l.classe === 'A').length} itens na classe A`}>
            <line x1="0" x2={W} y1={H - 0.8 * H} y2={H - 0.8 * H} stroke="var(--pm-border-strong)" strokeDasharray="4 4" />
            <line x1="0" x2={W} y1={H - 0.95 * H} y2={H - 0.95 * H} stroke="var(--pm-border-strong)" strokeDasharray="4 4" />
            {linhas.map((l, i) => {
              const h = (toNum(l.participacao) / max) * H * 0.9;
              return <rect key={l.id} x={i * bw + bw * 0.15} width={bw * 0.7} y={H - h} height={h} rx="3" fill={COR_ABC[l.classe]} />;
            })}
            <polyline points={pontos} fill="none" stroke="var(--pm-text-1)" strokeWidth="2" />
          </svg>
          <div className="flex flex-wrap gap-4 text-caption text-ink-2">
            {(['A', 'B', 'C'] as const).map((c) => <span key={c} className="inline-flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: COR_ABC[c] }} />classe {c} · {linhas.filter((l) => l.classe === c).length} itens</span>)}
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 bg-ink-1" />acumulado</span>
          </div>
          <DataTable<LinhaABC>
            rotulo="Itens da curva ABC"
            linhas={linhas}
            chave={(l) => l.id}
            colunas={[
              { chave: 'i', titulo: 'Item', principal: true, render: (l) => <span className="flex flex-col"><span className="font-medium">{l.descricao ?? l.id}</span>{l.codigo && <span className="mono text-caption text-ink-3">{l.codigo}</span>}</span> },
              { chave: 'v', titulo: 'Consumido', alinhar: 'right', mono: true, render: (l) => brl(l.valor) },
              { chave: 'p', titulo: 'Participação', alinhar: 'right', mono: true, render: (l) => pct(l.participacao) },
              { chave: 'a', titulo: 'Acumulado', alinhar: 'right', mono: true, render: (l) => pct(l.acumulado) },
              { chave: 'c', titulo: 'Classe', render: (l) => <Pill tom={l.classe === 'A' ? 'primary' : l.classe === 'B' ? 'steel' : 'neutral'}>{l.classe}</Pill> }
            ]}
          />
        </>
      )}
    </Card>
  );
}

function Consumo() {
  const [comp, setComp] = useState(competenciaAtual());
  const q = useQuery({ queryKey: ['estoque', 'consumo', comp], queryFn: () => api<ConsumoCentro[] | Lista<ConsumoCentro>>('/estoque/consumo-centros', { query: { competencia: comp } }) });
  const linhas = lista(q.data);
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-consumo">
      <CardHeader id="h-consumo" titulo="Consumo por centro" sub="Insumos que saíram do estoque contra a média cadastrada no centro, que entra no custo-hora." acao={<CompetenciaPicker valor={comp} onChange={setComp} />} />
      {q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : linhas.length === 0 ? <p className="m-0 text-ink-2">Nenhuma saída para centro neste mês.</p> : (
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {linhas.map((c) => {
            const cad = toNum(c.insumosCadastro), cons = toNum(c.consumido), max = Math.max(cad, cons, 1);
            const rel = cad > 0 ? cons / cad - 1 : cons > 0 ? 1 : 0;
            const longe = Math.abs(rel) > 0.1;
            return (
              <li key={c.centroId} className="p-3.5 rounded-field bg-surface-2 flex flex-col gap-2">
                <div className="flex flex-wrap justify-between gap-2 items-baseline">
                  <strong className="text-[15px]">{c.nome}</strong>
                  <span className="mono text-[13.5px]"><span className="text-ink-3">cadastro {brl(cad)}</span> · consumido <strong>{brl(cons)}</strong> {longe && <Pill tom={rel > 0 ? 'warn' : 'info'}>{rel > 0 ? '+' : ''}{pct(rel, 0)}</Pill>}</span>
                </div>
                <div className="flex flex-col gap-1" role="img" aria-label={`Cadastro ${brl(cad)}, consumido ${brl(cons)}`}>
                  <span className="h-2 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-chart-orcado rounded-full" style={{ width: `${(cad / max) * 100}%` }} /></span>
                  <span className="h-2 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-chart-real rounded-full" style={{ width: `${(cons / max) * 100}%` }} /></span>
                </div>
                {longe && (
                  <span className="text-[13.5px] text-ink-2">
                    O consumo real ficou {rel > 0 ? 'acima' : 'abaixo'} da média do cadastro. Vale propor {brl(cons)} como nova média de insumos.{' '}
                    <Link to={`/centros-trabalho/${c.centroId}#custos`} className="font-semibold">Abrir o centro</Link>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Inventario() {
  const locais = useLocais();
  const [localId, setLocal] = useState('');
  const [contado, setContado] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState(false);
  const q = useQuery({ queryKey: ['estoque', 'saldos', 'inventario', localId], queryFn: () => api<Lista<SaldoLocal> | SaldoLocal[]>('/estoque/saldos', { query: { localId } }), enabled: !!localId });
  const linhas = lista(q.data);
  const difs = useMemo(() => linhas.filter((s) => contado[s.item.id] !== undefined && contado[s.item.id] !== '').map((s) => {
    const d = toNum(contado[s.item.id]) - toNum(s.fisico);
    return { s, d, valor: d * toNum(s.custoMedio) };
  }).filter((x) => Math.abs(x.d) > 1e-9), [linhas, contado]);
  const enviar = useAcao(() => api('/estoque/inventarios', { method: 'POST', body: { localId, itens: linhas.filter((s) => contado[s.item.id] !== undefined && contado[s.item.id] !== '').map((s) => ({ itemId: s.item.id, contado: contado[s.item.id] })) } }), {
    invalida: [['estoque'], ['itens']],
    sucesso: `Inventário fechado. ${difs.length} ${difs.length === 1 ? 'ajuste gerado' : 'ajustes gerados'}, com registro de quem contou.`,
    onSuccess: () => { setContado({}); setConfirmar(false); }
  });
  const saldoDif = difs.reduce((a, x) => a + x.valor, 0);
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-inv">
      <CardHeader id="h-inv" titulo="Inventário" sub="Conte o que tem na prateleira. As diferenças viram ajustes, com auditoria." />
      <SelectField label="Local" value={localId} onChange={(v) => { setLocal(v); setContado({}); }} vazio="Escolha o local" opcoes={(locais.data ?? []).map((l) => ({ valor: l.id, rotulo: l.nome }))} className="max-w-[360px]" />
      {localId && (q.isLoading ? <Carregando /> : linhas.length === 0 ? <p className="m-0 text-ink-2">Nenhum item com saldo nesse local.</p> : (
        <>
          <ul className="m-0 p-0 list-none flex flex-col">
            {linhas.map((s) => {
              const c = contado[s.item.id];
              const d = c !== undefined && c !== '' ? toNum(c) - toNum(s.fisico) : null;
              return (
                <li key={s.item.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-border first:border-0">
                  <span className="flex-[2_1_220px] min-w-0 flex flex-col"><span className="font-medium">{s.item.descricao}</span><span className="mono text-caption text-ink-3">{s.item.codigo} · sistema {num(s.fisico, 2)} {s.item.unidade}</span></span>
                  <label className="campo !min-h-[40px] w-[160px]">
                    <span className="sr-only">Contado de {s.item.descricao}</span>
                    <DecimalInput value={c ?? ''} onChange={(v) => setContado({ ...contado, [s.item.id]: v })} className="text-right !h-9" placeholder="contado" />
                    <span className="un">{s.item.unidade}</span>
                  </label>
                  <span className={`mono text-[13.5px] w-[150px] text-right ${d === null ? 'text-ink-3' : Math.abs(d) < 1e-9 ? 'text-ok' : d < 0 ? 'text-bad' : 'text-info'}`}>
                    {d === null ? '—' : Math.abs(d) < 1e-9 ? 'confere' : `${d > 0 ? '+' : ''}${num(d, 2)} · ${brl(d * toNum(s.custoMedio))}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-ink-1">
            <span className="text-[14px]">{difs.length ? <>{difs.length} {difs.length === 1 ? 'diferença' : 'diferenças'} · <strong className={`mono ${saldoDif < 0 ? 'text-bad' : ''}`}>{brl(saldoDif)}</strong></> : 'Nenhuma diferença ainda.'}</span>
            <Button icone={ClipboardCheck} disabled={!Object.values(contado).some((v) => v !== '')} onClick={() => setConfirmar(true)}>Revisar e fechar</Button>
          </div>
        </>
      ))}
      <Modal aberto={confirmar} onFechar={() => setConfirmar(false)} faixa titulo="Fechar o inventário?"
        rodape={<><Button onClick={() => setConfirmar(false)}>Voltar a contar</Button><Button variante="primario" icone={ClipboardCheck} carregando={enviar.isPending} onClick={() => enviar.mutate(undefined)}>Gerar os ajustes</Button></>}>
        {difs.length === 0 ? <p className="m-0 text-ink-2">Tudo confere com o sistema. O inventário fica registrado sem ajustes.</p> : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {difs.map(({ s, d, valor }) => (
              <li key={s.item.id} className="flex justify-between gap-3 py-2 border-t border-border first:border-0 text-[14px]">
                <span>{s.item.descricao}</span>
                <span className={`mono ${d < 0 ? 'text-bad' : 'text-info'}`}>{d > 0 ? '+' : ''}{num(d, 2)} {s.item.unidade} · {brl(valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Card>
  );
}

function NovoMovimento({ onFechar }: { onFechar: () => void }) {
  const locais = useLocais();
  const centros = useCentros();
  const itens = useItens();
  const os = useQuery({ queryKey: ['ordens-servico', 'lista', 'mov'], queryFn: () => api<Lista<OSResumo>>('/ordens-servico') });
  const [m, setM] = useState({ tipo: 'SAIDA_CENTRO' as TipoMov, itemId: '', localId: '', quantidade: '', loteId: '', centroId: '', localDestinoId: '', motivo: '', osId: '', justificativa: '', observacao: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const item: Item | undefined = itens.data?.find((i) => i.id === m.itemId);
  const lotes = useQuery({ queryKey: ['estoque', 'lotes', m.itemId], queryFn: () => api<Lote[] | Lista<Lote>>('/estoque/lotes', { query: { itemId: m.itemId } }), enabled: !!item?.rastreavel, select: lista });
  const set = <K extends keyof typeof m>(k: K, v: (typeof m)[K]) => setM({ ...m, [k]: v });
  const saida = m.tipo !== 'ENTRADA_AVULSA' && m.tipo !== 'DEVOLUCAO' && m.tipo !== 'AJUSTE';
  const faltando = !m.itemId || !m.localId || !(m.tipo === 'AJUSTE' ? toNum(m.quantidade) !== 0 : toNum(m.quantidade) > 0)
    || (m.tipo === 'SAIDA_CENTRO' && !m.centroId) || (m.tipo === 'TRANSFERENCIA' && !m.localDestinoId) || (m.tipo === 'PERDA' && !m.motivo.trim())
    || (m.tipo === 'DEVOLUCAO' && !m.osId) || ((m.tipo === 'AJUSTE' || m.tipo === 'ENTRADA_AVULSA') && !m.justificativa.trim()) || (!!item?.rastreavel && !m.loteId);
  const acao = useAcao(() => api('/estoque/movimentos', {
    method: 'POST',
    body: {
      tipo: m.tipo, itemId: m.itemId, localId: m.localId, quantidade: m.quantidade, loteId: m.loteId || undefined,
      centroId: m.tipo === 'SAIDA_CENTRO' ? m.centroId : undefined, localDestinoId: m.tipo === 'TRANSFERENCIA' ? m.localDestinoId : undefined,
      motivo: m.tipo === 'PERDA' ? m.motivo : undefined, osId: m.tipo === 'DEVOLUCAO' ? m.osId : undefined,
      justificativa: m.justificativa.trim() || undefined, observacao: m.observacao.trim() || undefined
    }
  }), { invalida: [['estoque'], ['itens']], sucesso: 'Movimento registrado. O saldo já foi atualizado.', onSuccess: onFechar });
  const enviar = () => {
    setTentou(true);
    setErro(null);
    if (faltando) return;
    acao.mutate(undefined, {
      onError: (e) => setErro(e instanceof ApiError && e.codigo === 'SALDO_INSUFICIENTE' ? `Não tem tudo isso disponível${item ? ` (${num(item.saldo?.disponivel ?? 0, 2)} ${item.unidadeConsumo})` : ''}. Confira o local ou se parte está reservada para uma OS.`
        : e instanceof ApiError && e.codigo === 'LOTE_OBRIGATORIO' ? 'Esse item é rastreável: escolha de qual lote está saindo.'
        : e instanceof ApiError && e.codigo === 'ITEM_NAO_E_DE_CENTRO' ? 'Só insumo e ferramenta geral vão para centro. Matéria-prima e peça saem pela OS.' : e instanceof Error ? e.message : 'Não deu para registrar.')
    });
  };
  return (
    <Modal aberto onFechar={onFechar} largura={620} titulo="Novo movimento"
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" carregando={acao.isPending} onClick={enviar}>Registrar</Button></>}>
      <SelectField label="O que aconteceu" value={m.tipo} onChange={(v) => setM({ ...m, tipo: v as TipoMov })} opcoes={Object.entries(TIPOS_MOV).map(([valor, rotulo]) => ({ valor, rotulo }))}
        hint={{ SAIDA_CENTRO: 'Insumo ou ferramenta geral que foi para uma máquina: entra no consumo do centro.', AJUSTE: 'Correção de saldo: positivo soma, negativo tira.', TRANSFERENCIA: 'Muda de local, sem mudar o custo.', PERDA: 'Quebrou, venceu, sumiu: sai como perda.', DEVOLUCAO: 'Sobra que voltou de uma OS.', ENTRADA_AVULSA: 'Entrada sem pedido de compra.' }[m.tipo]} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-medium text-ink-2">Item</span>
        <ItemPicker value={m.itemId} onChange={(id) => setM({ ...m, itemId: id, loteId: '' })} tipos={m.tipo === 'SAIDA_CENTRO' ? ['INSUMO', 'FERRAMENTA_GERAL'] : undefined} invalido={tentou && !m.itemId} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SelectField label={m.tipo === 'TRANSFERENCIA' ? 'Sai de' : 'Local'} value={m.localId} onChange={(v) => set('localId', v)} vazio="Escolha" opcoes={(locais.data ?? []).map((l) => ({ valor: l.id, rotulo: l.nome }))} erro={tentou && !m.localId ? 'De qual local?' : null} />
        <NumberField label="Quantidade" sufixo={item?.unidadeConsumo} value={m.quantidade} onChange={(v) => set('quantidade', v)}
          hint={item ? `disponível ${num(item.saldo?.disponivel ?? 0, 2)} ${item.unidadeConsumo} · custo médio ${brl(item.custoMedio)}` : undefined}
          erro={tentou && !(toNum(m.quantidade) !== 0) ? 'Informe a quantidade.' : saida && item && toNum(m.quantidade) > toNum(item.saldo?.disponivel) ? 'Mais do que o disponível.' : null} />
        {item?.rastreavel && (
          <SelectField className="sm:col-span-2" label="Lote" value={m.loteId} onChange={(v) => set('loteId', v)} vazio="Escolha o lote" erro={tentou && !m.loteId ? 'Item rastreável: diga de qual lote.' : null}
            opcoes={(lotes.data ?? []).filter((l) => toNum(l.saldo) > 0 || m.tipo === 'AJUSTE').map((l) => ({ valor: l.id, rotulo: `${l.codigo} · saldo ${num(l.saldo, 2)}${l.certificado?.corrida ? ` · corrida ${l.certificado.corrida}` : ''}` }))} />
        )}
        {m.tipo === 'SAIDA_CENTRO' && <SelectField className="sm:col-span-2" label="Centro de trabalho" value={m.centroId} onChange={(v) => set('centroId', v)} vazio="Para qual máquina?" opcoes={(centros.data?.itens ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />}
        {m.tipo === 'TRANSFERENCIA' && <SelectField label="Vai para" value={m.localDestinoId} onChange={(v) => set('localDestinoId', v)} vazio="Escolha" opcoes={(locais.data ?? []).filter((l) => l.id !== m.localId).map((l) => ({ valor: l.id, rotulo: l.nome }))} />}
        {m.tipo === 'DEVOLUCAO' && <SelectField className="sm:col-span-2" label="OS de origem" value={m.osId} onChange={(v) => set('osId', v)} vazio="Escolha a OS" opcoes={(os.data?.itens ?? []).map((o) => ({ valor: o.id, rotulo: `${o.numero} · ${o.titulo}` }))} />}
        {m.tipo === 'PERDA' && <SelectField className="sm:col-span-2" label="Motivo" value={m.motivo} onChange={(v) => set('motivo', v)} vazio="Escolha" opcoes={['Quebra', 'Vencido', 'Avaria no manuseio', 'Extravio', 'Outro'].map((x) => ({ valor: x, rotulo: x }))} />}
      </div>
      {(m.tipo === 'AJUSTE' || m.tipo === 'ENTRADA_AVULSA') && <TextArea label="Justificativa (obrigatória)" value={m.justificativa} onChange={(v) => set('justificativa', v)} hint="Fica na auditoria com o seu nome." />}
      <TextArea label="Observação" value={m.observacao} onChange={(v) => set('observacao', v)} />
      {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
    </Modal>
  );
}
