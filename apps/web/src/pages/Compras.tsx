import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Gauge, Plus, Scale, Send, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Cotacao, Fornecedor, Item, Lista, Pedido, Requisicao, StatusPedido, StatusRequisicao } from '../lib/types';
import { brl, competenciaAtual, data, num, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { DataTable, FiltroChips } from '../components/DataTable';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill, type Tom } from '../components/Pill';
import { Modal } from '../components/Modal';
import { DecimalInput, TextArea } from '../components/Field';
import { Abas, useAba } from '../components/Abas';
import { Estrelas } from '../components/Estrelas';
import { GlassPanel } from '../components/GlassPanel';
import { ItemPicker, useItens } from '../components/ItemPicker';
import { useTitulo } from '../layout/titulo';

const contar = (x: unknown) => (Array.isArray(x) ? x.length : typeof x === 'number' ? x : 0);

const ABAS = ['requisicoes', 'cotacoes', 'pedidos'] as const;
type Aba = (typeof ABAS)[number];

const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);

const STATUS_REQ: Record<StatusRequisicao, [string, Tom]> = {
  ABERTA: ['Aberta', 'warn'],
  EM_COTACAO: ['Em cotação', 'info'],
  ATENDIDA: ['Atendida', 'ok'],
  CANCELADA: ['Cancelada', 'neutral']
};
const STATUS_PED: Record<StatusPedido, [string, Tom]> = {
  AGUARDANDO_APROVACAO: ['Aguardando aprovação', 'warn'],
  APROVADO: ['Aprovado', 'info'],
  PARCIAL: ['Parcial', 'run'],
  RECEBIDO: ['Recebido', 'ok'],
  CANCELADO: ['Cancelado', 'bad']
};
const ORIGEM: Record<Requisicao['origem'], [string, Tom]> = { OS: ['OS', 'primary'], PONTO_PEDIDO: ['Ponto de pedido', 'steel'], MANUAL: ['Manual', 'neutral'] };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default function Compras() {
  useTitulo('Compras');
  const [aba, setAba] = useAba<Aba>('requisicoes', ABAS);
  const reqs = useQuery({ queryKey: ['compras', 'requisicoes'], queryFn: () => api<Requisicao[] | Lista<Requisicao>>('/compras/requisicoes') });
  const peds = useQuery({ queryKey: ['compras', 'pedidos'], queryFn: () => api<Pedido[] | Lista<Pedido>>('/compras/pedidos') });
  const requisicoes = comoLista(reqs.data);
  const pedidos = comoLista(peds.data);
  const abertas = requisicoes.filter((r) => r.status === 'ABERTA').length;
  const aguardando = pedidos.filter((p) => p.status === 'AGUARDANDO_APROVACAO').length;
  const caminho = pedidos.filter((p) => p.status === 'APROVADO' || p.status === 'PARCIAL').length;
  const mes = competenciaAtual();
  const compradoMes = pedidos.filter((p) => p.status !== 'CANCELADO' && (p.criadoEm ?? '').startsWith(mes)).reduce((a, p) => a + toNum(p.total), 0);

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        sobretitulo="Suprimentos"
        titulo="Compras"
        texto="Da falta de material ao pedido aprovado, sem correria: junte as requisições, cote com quem entrega bem e receba conferindo nota e certificado."
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Requisições abertas" valor={reqs.isLoading ? '…' : abertas} sub="esperando cotação" />
          <HeroKpi rotulo="Esperando aprovação" valor={peds.isLoading ? '…' : aguardando} sub="pedidos acima do limite" />
          <HeroKpi rotulo="A caminho" valor={peds.isLoading ? '…' : caminho} sub="aprovados ou parciais" />
          <HeroKpi rotulo="Comprado no mês" valor={<span className="text-[clamp(22px,2.4vw,30px)]">{brl(compradoMes)}</span>} sub="sem os cancelados" />
        </div>
      </HeroBand>
      <Abas<Aba>
        rotulo="Etapas de compra"
        valor={aba}
        onChange={setAba}
        abas={[
          { valor: 'requisicoes', rotulo: 'Requisições', n: abertas },
          { valor: 'cotacoes', rotulo: 'Cotações' },
          { valor: 'pedidos', rotulo: 'Pedidos', n: aguardando }
        ]}
      />
      {aba === 'requisicoes' && <AbaRequisicoes q={reqs} itens={requisicoes} />}
      {aba === 'cotacoes' && <AbaCotacoes irParaRequisicoes={() => setAba('requisicoes')} />}
      {aba === 'pedidos' && <AbaPedidos q={peds} itens={pedidos} />}
    </>
  );
}

type Q = { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };

function itemDaReq(it: Requisicao['itens'][number], mapa: Map<string, Item>) {
  const cad = mapa.get(it.itemId);
  return {
    descricao: it.descricao ?? it.item?.descricao ?? cad?.descricao ?? 'Item',
    unidade: it.unidade ?? it.item?.unidade ?? cad?.unidadeCompra ?? ''
  };
}

type FiltroReq = 'todas' | StatusRequisicao;

function AbaRequisicoes({ q, itens }: { q: Q; itens: Requisicao[] }) {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<FiltroReq>('ABERTA');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [forn, setForn] = useState<Set<string>>(new Set());
  const [nova, setNova] = useState(false);
  const cad = useItens();
  const mapa = useMemo(() => new Map((cad.data ?? []).map((i) => [i.id, i])), [cad.data]);
  const fq = useQuery({ queryKey: ['fornecedores'], queryFn: () => api<Fornecedor[] | Lista<Fornecedor>>('/fornecedores') });
  const fornecedores = comoLista(fq.data)
    .filter((f) => f.status !== 'INATIVO')
    .sort((a, b) => toNum(b.avaliacao) - toNum(a.avaliacao));

  const gerar = useAcao(() => api<unknown>('/compras/requisicoes/gerar-ponto-pedido', { method: 'POST' }), {
    invalida: [['compras']],
    sucesso: (r) => {
      const x = r as { criadas?: number; total?: number; itens?: unknown[] } | unknown[] | null;
      const n = Array.isArray(x) ? x.length : x?.criadas ?? x?.itens?.length ?? x?.total;
      if (n === undefined) return 'Conferimos o ponto de pedido. As requisições novas já estão na lista.';
      if (n === 0) return 'Nada novo abaixo do mínimo: os itens em falta já têm requisição aberta.';
      return `${plural(n, 'requisição criada', 'requisições criadas')} pelo ponto de pedido. Marque e cote quando quiser.`;
    }
  });
  const cotar = useAcao(
    (b: { requisicaoIds: string[]; fornecedorIds: string[] }) => api<Cotacao>('/compras/cotacoes', { method: 'POST', body: b }),
    {
      invalida: [['compras']],
      sucesso: 'Cotação aberta. Lance os preços conforme os fornecedores responderem.',
      onSuccess: (r) => (r?.id ? navigate(`/compras/cotacoes/${r.id}`) : undefined)
    }
  );

  const contagem = (s: StatusRequisicao) => itens.filter((r) => r.status === s).length;
  const visiveis = filtro === 'todas' ? itens : itens.filter((r) => r.status === filtro);
  const alternar = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  const selAbertas = [...sel].filter((id) => itens.some((r) => r.id === id && r.status === 'ABERTA'));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
      <Card className="p-4 sm:p-5 flex flex-col gap-4 min-w-0">
        <CardHeader
          titulo="Requisições"
          sub="Nascem da OS, do ponto de pedido do estoque ou de alguém da equipe."
          acao={
            <div className="flex flex-wrap gap-2">
              <Button tamanho="sm" icone={Gauge} carregando={gerar.isPending} onClick={() => gerar.mutate(undefined)}>Gerar pelo ponto de pedido</Button>
              <Button tamanho="sm" icone={Plus} onClick={() => setNova(true)}>Nova requisição</Button>
            </div>
          }
        />
        <FiltroChips<FiltroReq>
          rotulo="Filtrar requisições por situação"
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            ...(Object.keys(STATUS_REQ) as StatusRequisicao[]).map((s) => ({ valor: s as FiltroReq, rotulo: STATUS_REQ[s][0], n: contagem(s) })),
            { valor: 'todas', rotulo: 'Todas', n: itens.length }
          ]}
        />
        {q.isLoading ? (
          <Carregando rotulo="Carregando requisições" />
        ) : q.isError ? (
          <ErroEstado erro={q.error} tentar={() => q.refetch()} />
        ) : visiveis.length === 0 ? (
          <EmptyState
            titulo={filtro === 'ABERTA' ? 'Nenhuma requisição aberta' : 'Nada por aqui'}
            texto="Quando faltar material numa OS ou um item cair abaixo do mínimo, a requisição aparece aqui. Dá para conferir o estoque agora pelo ponto de pedido."
          />
        ) : (
          <DataTable<Requisicao>
            rotulo="Requisições"
            linhas={visiveis}
            chave={(r) => r.id}
            colunas={[
              {
                chave: 'x',
                titulo: 'Cotar',
                render: (r) => (
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--pm-primary)]"
                    checked={sel.has(r.id)}
                    disabled={r.status !== 'ABERTA'}
                    onChange={() => setSel((s) => alternar(s, r.id))}
                    aria-label={`Incluir ${r.numero ?? 'requisição'} na cotação`}
                  />
                )
              },
              {
                chave: 'r',
                titulo: 'Requisição',
                principal: true,
                render: (r) => (
                  <span className="flex flex-col min-w-0">
                    <span className="mono text-caption text-ink-3">{r.numero ?? r.id.slice(0, 8)} · {data(r.criadaEm ?? r.criadoEm ?? r.data)}</span>
                    <span className="flex flex-col">
                      {r.itens.map((it, i) => {
                        const d = itemDaReq(it, mapa);
                        return (
                          <span key={`${it.itemId}-${i}`} className="font-semibold text-ink-1">
                            {d.descricao} <span className="mono font-normal text-ink-2">· {num(it.quantidade, toNum(it.quantidade) % 1 ? 2 : 0)} {d.unidade}</span>
                          </span>
                        );
                      })}
                    </span>
                    {r.observacao && <span className="text-caption text-ink-2">{r.observacao}</span>}
                  </span>
                )
              },
              {
                chave: 'o',
                titulo: 'Veio de',
                render: (r) =>
                  r.origem === 'OS' && r.os ? (
                    <Link to={`/ordens-servico/${r.os.id}`} className="no-underline"><Pill tom="primary">{r.os.numero}</Pill></Link>
                  ) : (
                    <Pill tom={ORIGEM[r.origem]?.[1] ?? 'neutral'}>{ORIGEM[r.origem]?.[0] ?? r.origem}</Pill>
                  )
              },
              { chave: 's', titulo: 'Situação', render: (r) => <Pill tom={STATUS_REQ[r.status]?.[1] ?? 'neutral'}>{STATUS_REQ[r.status]?.[0] ?? r.status}</Pill> }
            ]}
          />
        )}
      </Card>

      <GlassPanel placa="aco" className="lg:sticky lg:top-24" aria-label="Montar cotação">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-sans text-headline">Montar cotação</h2>
          <p className="m-0 text-[14px] text-ink-2">
            {selAbertas.length
              ? `${plural(selAbertas.length, 'requisição marcada', 'requisições marcadas')}. Agora escolha quem vai cotar.`
              : 'Marque as requisições abertas na lista e escolha os fornecedores. Três cotações costumam bastar.'}
          </p>
        </div>
        {fq.isLoading ? (
          <Carregando linhas={3} rotulo="Carregando fornecedores" />
        ) : fq.isError ? (
          <ErroEstado erro={fq.error} tentar={() => fq.refetch()} />
        ) : fornecedores.length === 0 ? (
          <p className="m-0 text-[14px] text-ink-2">Ainda não há fornecedores cadastrados. Cadastre pelo menos um para poder cotar.</p>
        ) : (
          <div role="group" aria-label="Fornecedores para cotar" className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {fornecedores.map((f) => {
              const on = forn.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForn((s) => alternar(s, f.id))}
                  className={`text-left rounded-field border-2 px-3 py-2.5 flex flex-col gap-1 bg-surface-1 transition duration-micro ${on ? 'border-primary shadow-[0_0_0_4px_var(--pm-primary-soft)]' : 'border-border hover:border-border-strong'}`}
                >
                  <span className="font-semibold">{f.fantasia || f.nome}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
                    <Estrelas valor={f.avaliacao} tamanho={13} />
                    <span>entrega em ~{f.prazoMedioDias} dias</span>
                    {f.condicaoPagamento && <span>{f.condicaoPagamento}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <Button
          variante="primario"
          icone={Scale}
          disabled={!selAbertas.length || !forn.size}
          carregando={cotar.isPending}
          onClick={() => cotar.mutate({ requisicaoIds: selAbertas, fornecedorIds: [...forn] })}
        >
          {forn.size ? `Cotar com ${plural(forn.size, 'fornecedor', 'fornecedores')}` : 'Cotar selecionadas'}
        </Button>
      </GlassPanel>

      <NovaRequisicao aberto={nova} onFechar={() => setNova(false)} />
    </div>
  );
}

type Linha = { itemId: string; quantidade: string };

function NovaRequisicao({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [linhas, setLinhas] = useState<Linha[]>([{ itemId: '', quantidade: '' }]);
  const [obs, setObs] = useState('');
  const [tentou, setTentou] = useState(false);
  const cad = useItens();
  const fechar = () => {
    setLinhas([{ itemId: '', quantidade: '' }]);
    setObs('');
    setTentou(false);
    onFechar();
  };
  const criar = useAcao((b: { itens: Linha[]; observacao: string }) => api('/compras/requisicoes', { method: 'POST', body: b }), {
    invalida: [['compras']],
    sucesso: 'Requisição registrada. Ela já aparece entre as abertas para cotar.',
    onSuccess: fechar
  });
  const validas = linhas.filter((l) => l.itemId && toNum(l.quantidade) > 0);
  const enviar = () => {
    setTentou(true);
    if (!validas.length || validas.length !== linhas.filter((l) => l.itemId || l.quantidade).length) return;
    criar.mutate({ itens: validas, observacao: obs.trim() });
  };
  const set = (i: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  return (
    <Modal
      aberto={aberto}
      onFechar={fechar}
      titulo="Nova requisição"
      largura={640}
      rodape={
        <>
          <Button variante="terciario" onClick={fechar}>Voltar</Button>
          <Button variante="secundario" icone={Send} carregando={criar.isPending} onClick={enviar}>Registrar requisição</Button>
        </>
      }
    >
      <p className="m-0 text-ink-2 text-[14px]">Diga o que falta e quanto. Quem cuida das compras junta com as outras requisições na próxima cotação.</p>
      {linhas.map((l, i) => {
        const it = cad.data?.find((x) => x.id === l.itemId);
        const ruim = tentou && (l.itemId || l.quantidade || i === 0) && !(l.itemId && toNum(l.quantidade) > 0);
        return (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-field bg-surface-2 p-3">
            <div className="flex flex-col gap-1.5 flex-[1_1_260px] min-w-0">
              <span className="text-[13.5px] font-medium text-ink-2">Item {i + 1}</span>
              <ItemPicker value={l.itemId} onChange={(id) => set(i, { itemId: id })} rotulo={`Item ${i + 1}`} invalido={!!ruim && !l.itemId} />
            </div>
            <label className="flex flex-col gap-1.5 flex-[0_1_150px] min-w-[120px]">
              <span className="text-[13.5px] font-medium text-ink-2">Quantidade</span>
              <span className="campo" data-erro={!!ruim && !(toNum(l.quantidade) > 0)}>
                <DecimalInput value={l.quantidade} onChange={(v) => set(i, { quantidade: v })} className="text-right" aria-label={`Quantidade do item ${i + 1}`} />
                {it && <span className="un">{it.unidadeCompra}</span>}
              </span>
            </label>
            {linhas.length > 1 && <IconButton icone={Trash2} rotulo={`Tirar o item ${i + 1}`} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} />}
          </div>
        );
      })}
      {tentou && !validas.length && <span role="alert" className="text-caption text-bad font-medium">Escolha pelo menos um item e a quantidade que falta.</span>}
      <Button variante="terciario" tamanho="sm" icone={Plus} className="self-start" onClick={() => setLinhas((ls) => [...ls, { itemId: '', quantidade: '' }])}>Mais um item</Button>
      <TextArea label="Observação" value={obs} onChange={setObs} hint="Para que é, até quando precisa, alguma preferência de marca." rows={2} />
    </Modal>
  );
}

function AbaCotacoes({ irParaRequisicoes }: { irParaRequisicoes: () => void }) {
  const q = useQuery({ queryKey: ['compras', 'cotacoes'], queryFn: () => api<Cotacao[] | Lista<Cotacao>>('/compras/cotacoes'), retry: false });
  const semRota = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 405);
  const itens = comoLista(q.data);
  if (q.isLoading) return <Card><Carregando rotulo="Carregando cotações" /></Card>;
  if (semRota || (q.isSuccess && itens.length === 0))
    return (
      <Card>
        <EmptyState
          ilustracao="prancheta"
          titulo={semRota ? 'Cotações nascem das requisições' : 'Nenhuma cotação em andamento'}
          texto="Marque as requisições abertas, escolha os fornecedores e toque em Cotar. Cada cotação ganha uma página com o comparativo de preço, prazo e avaliação."
          acao={<Button icone={ClipboardList} onClick={irParaRequisicoes}>Ver requisições</Button>}
        />
      </Card>
    );
  if (q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4">
      <CardHeader titulo="Cotações" sub="Abra uma cotação para lançar as respostas e escolher o fornecedor." />
      <DataTable<Cotacao>
        rotulo="Cotações"
        linhas={itens}
        chave={(c) => c.id}
        href={(c) => `/compras/cotacoes/${c.id}`}
        rotuloLinha={(c) => c.numero ?? 'cotação'}
        colunas={[
          {
            chave: 'c',
            titulo: 'Cotação',
            principal: true,
            render: (c) => (
              <span className="flex flex-col min-w-0">
                <span className="mono text-caption text-ink-3">{c.numero ?? c.id.slice(0, 8)} · {data(c.criadaEm ?? (c as { criadoEm?: string }).criadoEm)}</span>
                <Link to={`/compras/cotacoes/${c.id}`} className="font-semibold text-ink-1 no-underline hover:underline">
                  {(Array.isArray(c.itens) ? c.itens.map((i) => i.descricao).join(', ') : '') || 'Cotação de compra'}
                </Link>
              </span>
            )
          },
          { chave: 'r', titulo: 'Respostas', mono: true, alinhar: 'right', render: (c) => `${contar(c.respostas)} de ${contar(c.fornecedores)}` },
          {
            chave: 's',
            titulo: 'Situação',
            render: (c) =>
              c.pedidoId || c.escolhido ? (
                <Pill tom="ok">Pedido gerado</Pill>
              ) : contar(c.respostas) > 0 && contar(c.respostas) >= contar(c.fornecedores) ? (
                <Pill tom="warn">Pronta para decidir</Pill>
              ) : (
                <Pill tom="info">Esperando respostas</Pill>
              )
          }
        ]}
      />
    </Card>
  );
}

type FiltroPed = 'todos' | StatusPedido;

function AbaPedidos({ q, itens }: { q: Q; itens: Pedido[] }) {
  const [filtro, setFiltro] = useState<FiltroPed>('todos');
  const visiveis = filtro === 'todos' ? itens : itens.filter((p) => p.status === filtro);
  const status = (Object.keys(STATUS_PED) as StatusPedido[]).filter((s) => itens.some((p) => p.status === s));
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4">
      <CardHeader titulo="Pedidos" sub="Acima do limite de aprovação, o pedido espera o gestor. Os demais já nascem aprovados." />
      {itens.length > 0 && (
        <FiltroChips<FiltroPed>
          rotulo="Filtrar pedidos por situação"
          valor={filtro}
          onChange={setFiltro}
          opcoes={[{ valor: 'todos', rotulo: 'Todos', n: itens.length }, ...status.map((s) => ({ valor: s as FiltroPed, rotulo: STATUS_PED[s][0], n: itens.filter((p) => p.status === s).length }))]}
        />
      )}
      {q.isLoading ? (
        <Carregando rotulo="Carregando pedidos" />
      ) : q.isError ? (
        <ErroEstado erro={q.error} tentar={() => q.refetch()} />
      ) : visiveis.length === 0 ? (
        <EmptyState titulo="Nenhum pedido ainda" texto="O pedido nasce quando você escolhe o fornecedor numa cotação. Depois é só aprovar, se precisar, e receber." />
      ) : (
        <DataTable<Pedido>
          rotulo="Pedidos de compra"
          linhas={visiveis}
          chave={(p) => p.id}
          href={(p) => `/compras/pedidos/${p.id}`}
          rotuloLinha={(p) => p.numero}
          colunas={[
            {
              chave: 'p',
              titulo: 'Pedido',
              principal: true,
              render: (p) => (
                <span className="flex flex-col min-w-0">
                  <span className={`mono text-caption text-ink-3 ${p.status === 'CANCELADO' ? 'line-through' : ''}`}>{p.numero} · {data(p.criadoEm)}</span>
                  <Link to={`/compras/pedidos/${p.id}`} className={`font-semibold text-ink-1 no-underline hover:underline ${p.status === 'CANCELADO' ? 'line-through text-ink-3' : ''}`}>
                    {p.fornecedor?.nome ?? 'Fornecedor'}
                  </Link>
                  <span className="text-caption text-ink-2">{plural(contar(p.itens), 'item', 'itens')}</span>
                </span>
              )
            },
            { chave: 't', titulo: 'Total', alinhar: 'right', mono: true, render: (p) => <strong className={p.status === 'CANCELADO' ? 'line-through text-ink-3' : ''}>{brl(p.total)}</strong> },
            { chave: 'v', titulo: 'Previsão', mono: true, render: (p) => <span className={p.atrasado ? 'text-bad font-semibold' : ''}>{data(p.previsaoEntrega ?? p.previsao)}</span> },
            { chave: 's', titulo: 'Situação', render: (p) => <Pill tom={STATUS_PED[p.status]?.[1] ?? 'neutral'}>{STATUS_PED[p.status]?.[0] ?? p.status}</Pill> }
          ]}
        />
      )}
      {aguardandoAviso(itens)}
    </Card>
  );
}

function aguardandoAviso(itens: Pedido[]) {
  const n = itens.filter((p) => p.status === 'AGUARDANDO_APROVACAO').length;
  if (!n) return null;
  return <Aviso tom="info">{plural(n, 'pedido espera', 'pedidos esperam')} a aprovação do gestor. Enquanto isso, o fornecedor não separa o material.</Aviso>;
}
