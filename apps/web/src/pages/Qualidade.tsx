import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, FileText, Hourglass, Package, Plus, Repeat, Ruler, Search, ShieldCheck, ThumbsDown, Trash2, Truck, Wrench, XCircle, type LucideIcon
} from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import type { Fornecedor, Garantia, ItemPlano, Lote, NaoConformidade, OrigemNC, OSResumo, PlanoInspecao, Segmento, TipoItemPlano } from '../lib/types';
import { data, num, toNum } from '../lib/format';
import { SEGMENTO } from '../lib/rotulos';
import { useAuth } from '../lib/auth';
import { useAcao, useCentros, useColaboradores, useParametros } from '../lib/queries';
import { nomeDe } from '../features/os/os';
import { useTitulo } from '../layout/titulo';
import { useToast } from '../components/Toast';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { DecimalInput, NumberField, Segmented, SelectField, TextArea, TextField, Toggle } from '../components/Field';
import { FiltroChips } from '../components/DataTable';
import { Pill, type Tom } from '../components/Pill';
import { Modal } from '../components/Modal';
import { Abas, useAba } from '../components/Abas';
import { BarraMedicao } from '../components/BarraMedicao';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';

type StatusNC = NaoConformidade['status'];
type Ref = { id?: string; numero?: string; nome?: string; codigo?: string } | string | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Solto = Record<string, any>;

const ORIGEM: Record<OrigemNC, string> = { MATERIAL: 'Material', PROCESSO: 'Processo', OPERADOR: 'Operador', PROJETO: 'Projeto', FORNECEDOR: 'Fornecedor' };
const STATUS_NC: Record<StatusNC, [string, Tom, LucideIcon]> = {
  ABERTA: ['Aberta', 'bad', AlertTriangle],
  EM_TRATAMENTO: ['Em tratamento', 'warn', Wrench],
  ENCERRADA: ['Encerrada', 'ok', CheckCircle2]
};
const TIPO_ITEM: Record<TipoItemPlano, string> = { DIMENSIONAL: 'Dimensional', VISUAL: 'Visual', SOLDA: 'Solda', CHECK: 'Checklist' };
const INVAL = [['qualidade'], ['painel'], ['ordens-servico']];

const lista = <T,>(x: unknown): T[] => (Array.isArray(x) ? x : Array.isArray((x as Solto | null)?.itens) ? (x as { itens: T[] }).itens : []);
const primeiraLista = (...c: unknown[]): Solto[] => (c.find(Array.isArray) as Solto[] | undefined) ?? [];
const rotuloRef = (r: Ref) => (r == null ? null : typeof r === 'string' ? r : r.numero ?? r.codigo ?? r.nome ?? null);
const casasDe = (...v: (string | null | undefined)[]) => Math.max(2, ...v.map((t) => String(t ?? '').split('.')[1]?.length ?? 0));
const opcoesOS = (l?: OSResumo[]) => (l ?? []).map((o) => ({ valor: o.id, rotulo: `${o.numero} · ${o.titulo}${o.cliente?.nome ? ` · ${o.cliente.nome}` : ''}` }));

const useOSs = (status?: string, enabled = true) =>
  useQuery({ queryKey: ['ordens-servico', 'opcoes-qualidade', status ?? ''], queryFn: () => api<unknown>('/ordens-servico', { query: { status } }).then(lista<OSResumo>), enabled });
const useFornecedores = (enabled = true) =>
  useQuery({ queryKey: ['fornecedores', 'opcoes-qualidade'], queryFn: () => api<unknown>('/fornecedores').then(lista<Fornecedor>), enabled });
const useLotes = (enabled = true) =>
  useQuery({ queryKey: ['estoque', 'lotes', 'opcoes-qualidade'], queryFn: () => api<unknown>('/estoque/lotes').then(lista<Lote>), enabled, retry: false });
const useGarantias = () => useQuery({ queryKey: ['qualidade', 'garantias'], queryFn: () => api<unknown>('/qualidade/garantias').then(lista<Garantia>) });
const emAnalise = (g: Garantia) => g.procedente == null && !['PROCEDENTE', 'IMPROCEDENTE', 'DECIDIDA', 'ENCERRADA'].includes(g.status);

const ABAS = ['ncs', 'planos', 'rastreabilidade', 'garantias'] as const;
type Aba = (typeof ABAS)[number];

export default function Qualidade() {
  useTitulo('Qualidade');
  const [aba, setAba] = useAba<Aba>('ncs', ABAS);
  const ncs = useQuery({ queryKey: ['qualidade', 'ncs', 'todas'], queryFn: () => api<unknown>('/qualidade/ncs').then(lista<NaoConformidade>) });
  const gar = useGarantias();
  const conta = (s: StatusNC) => ncs.data?.filter((n) => n.status === s).length ?? 0;
  const valor = (q: { isLoading: boolean; isError: boolean }, v: number) => (q.isLoading ? '…' : q.isError ? '—' : v);
  const garAnalise = gar.data?.filter(emAnalise).length ?? 0;

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <HeroBand
        ilustracao="paquimetro"
        sobretitulo="Qualidade e rastreabilidade"
        titulo="Nada sai sem conferir"
        texto="Trate as não-conformidades, mantenha os planos de inspeção em dia e prove ao cliente de onde veio cada material."
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <HeroKpi rotulo="NCs abertas" valor={valor(ncs, conta('ABERTA'))} sub="sem ação; travam a entrega" />
          <HeroKpi rotulo="Em tratamento" valor={valor(ncs, conta('EM_TRATAMENTO'))} sub="ação registrada, falta encerrar" />
          <HeroKpi rotulo="Garantias em análise" valor={valor(gar, garAnalise)} sub="esperando decisão" />
        </div>
      </HeroBand>

      <Abas
        rotulo="Seções da qualidade"
        valor={aba}
        onChange={setAba}
        abas={[
          { valor: 'ncs', rotulo: 'Não-conformidades', n: conta('ABERTA') },
          { valor: 'planos', rotulo: 'Planos de inspeção' },
          { valor: 'rastreabilidade', rotulo: 'Rastreabilidade' },
          { valor: 'garantias', rotulo: 'Garantias', n: garAnalise }
        ]}
      />

      <div role="tabpanel" className="min-w-0">
        {aba === 'ncs' && <AbaNCs todas={ncs.data} />}
        {aba === 'planos' && <AbaPlanos />}
        {aba === 'rastreabilidade' && <AbaRastreio />}
        {aba === 'garantias' && <AbaGarantias />}
      </div>
    </div>
  );
}

/* ---------- Não-conformidades ---------- */

function StatusNCPill({ status }: { status: StatusNC }) {
  const [l, t, I] = STATUS_NC[status] ?? [status, 'neutral', Hourglass];
  return <Pill tom={t} icone={I}>{l}</Pill>;
}

function AbaNCs({ todas }: { todas?: NaoConformidade[] }) {
  const [status, setStatus] = useState<'TODAS' | StatusNC>('TODAS');
  const [origem, setOrigem] = useState<'TODAS' | OrigemNC>('TODAS');
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<NaoConformidade | null>(null);
  const q = useQuery({
    queryKey: ['qualidade', 'ncs', status, origem],
    queryFn: () => api<unknown>('/qualidade/ncs', { query: { status: status === 'TODAS' ? undefined : status, origem: origem === 'TODAS' ? undefined : origem } }).then(lista<NaoConformidade>)
  });
  const filtrando = status !== 'TODAS' || origem !== 'TODAS';
  const conta = (s: StatusNC) => todas?.filter((n) => n.status === s).length;

  return (
    <Card className="overflow-hidden anim-subir" aria-label="Não-conformidades">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3 border-b border-border">
        <CardHeader
          titulo="Não-conformidades"
          sub="NC aberta ligada a uma OS trava a entrega até alguém registrar a ação corretiva."
          acao={<Button variante="primario" icone={Plus} onClick={() => setNova(true)}>Nova NC</Button>}
        />
        <FiltroChips
          rotulo="Filtrar por situação"
          valor={status}
          onChange={setStatus}
          opcoes={[
            { valor: 'TODAS', rotulo: 'Todas', n: todas?.length },
            ...(Object.keys(STATUS_NC) as StatusNC[]).map((s) => ({ valor: s, rotulo: STATUS_NC[s][0], n: conta(s) }))
          ]}
        />
        <FiltroChips
          rotulo="Filtrar por origem"
          valor={origem}
          onChange={setOrigem}
          opcoes={[{ valor: 'TODAS' as const, rotulo: 'Qualquer origem' }, ...(Object.keys(ORIGEM) as OrigemNC[]).map((o) => ({ valor: o, rotulo: ORIGEM[o] }))]}
        />
      </div>
      {q.isLoading ? (
        <Carregando rotulo="Carregando não-conformidades" />
      ) : q.isError ? (
        <ErroEstado erro={q.error} tentar={() => q.refetch()} />
      ) : !q.data?.length ? (
        filtrando ? (
          <p className="m-0 p-10 text-center text-ink-2">Nenhuma NC com esse filtro. Limpe os filtros para ver todas.</p>
        ) : (
          <EmptyState
            ilustracao="paquimetro"
            titulo="Nenhuma não-conformidade"
            texto="Quando uma peça reprovar na inspeção, a NC abre sozinha. Para registrar um problema de material, operador ou projeto, use Nova NC."
          />
        )
      ) : (
        <ul className="m-0 p-0 list-none">
          {q.data.map((nc) => {
            const ligacoes = [nc.centro?.nome, nc.fornecedor?.nome, nc.lote?.codigo && `lote ${nc.lote.codigo}`, nc.responsavel?.nome && `resp. ${nc.responsavel.nome}`].filter(Boolean);
            return (
              <li key={nc.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => setAberta(nc)}
                  aria-label={`Abrir não-conformidade ${nc.numero ?? ''}: ${nc.descricao}`}
                  className="flex-[1_1_240px] min-w-0 text-left flex flex-col gap-0.5 rounded-control -mx-2 px-2 py-1 hover:bg-surface-2"
                >
                  <span className="text-caption text-ink-3">
                    {nc.numero && <span className="mono">{nc.numero} · </span>}
                    {ORIGEM[nc.origem] ?? nc.origem}
                    {(nc.criadaEm ?? (nc as { criadoEm?: string }).criadoEm) && <span className="mono"> · {data((nc.criadaEm ?? (nc as { criadoEm?: string }).criadoEm))}</span>}
                  </span>
                  <span className="font-medium break-words">{nc.descricao}</span>
                  {ligacoes.length > 0 && <span className="text-caption text-ink-3">{ligacoes.join(' · ')}</span>}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {nc.os && <Link to={`/ordens-servico/${nc.os.id}`} className="mono text-[13.5px] font-medium">{nc.os.numero}</Link>}
                  {nc.prazo && nc.status !== 'ENCERRADA' && <span className="text-caption text-ink-3">prazo <span className="mono">{data(nc.prazo)}</span></span>}
                  {nc.recorrencia && <Pill tom="primary" icone={Repeat} titulo="3 ou mais NCs em 90 dias no mesmo centro, operador ou fornecedor">Recorrente</Pill>}
                  <StatusNCPill status={nc.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {nova && <NovaNC onFechar={() => setNova(false)} />}
      {aberta && <DetalheNC nc={aberta} onFechar={() => setAberta(null)} />}
    </Card>
  );
}

function NovaNC({ onFechar }: { onFechar: () => void }) {
  const [f, setF] = useState({ origem: 'PROCESSO' as OrigemNC, descricao: '', osId: '', centroId: '', fornecedorId: '', loteId: '', colaboradorId: '' });
  const [erro, setErro] = useState<string | null>(null);
  const oss = useOSs();
  const centros = useCentros();
  const forn = useFornecedores();
  const lotes = useLotes();
  const colab = useColaboradores();
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const opcional = (v: string) => v || undefined;
  const criar = useAcao(
    () =>
      api('/qualidade/ncs', {
        method: 'POST',
        body: { origem: f.origem, descricao: f.descricao.trim(), osId: opcional(f.osId), centroId: opcional(f.centroId), fornecedorId: opcional(f.fornecedorId), loteId: opcional(f.loteId), colaboradorId: opcional(f.colaboradorId) }
      }),
    { invalida: INVAL, sucesso: 'NC registrada. Agora defina causa, ação e responsável para destravar a OS.', onSuccess: onFechar }
  );
  const enviar = (e?: FormEvent) => {
    e?.preventDefault();
    if (f.descricao.trim().length < 5) return setErro('Conte o que aconteceu em uma frase. Quem tratar a NC vai começar por aqui.');
    setErro(null);
    criar.mutate(undefined);
  };
  const material = f.origem === 'MATERIAL' || f.origem === 'FORNECEDOR';

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Nova não-conformidade"
      largura={620}
      rodape={
        <>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variante="primario" icone={Plus} carregando={criar.isPending} onClick={() => enviar()}>Registrar NC</Button>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <Segmented label="Origem" value={f.origem} onChange={set('origem')} tamanho="sm" opcoes={(Object.keys(ORIGEM) as OrigemNC[]).map((o) => ({ valor: o, rotulo: ORIGEM[o] }))} />
        <TextArea label="O que aconteceu" value={f.descricao} onChange={set('descricao')} hint={erro ?? 'Ex.: furo Ø20 saiu com 20,035 mm; três peças do lote.'} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField label="OS ligada" value={f.osId} onChange={set('osId')} vazio={oss.isLoading ? 'Carregando…' : 'Nenhuma'} opcoes={opcoesOS(oss.data)} hint="Com OS ligada e sem ação, a entrega fica travada." />
          <SelectField label="Centro" value={f.centroId} onChange={set('centroId')} vazio="Nenhum" opcoes={(centros.data?.itens ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          {(material || f.fornecedorId) && (
            <SelectField label="Fornecedor" value={f.fornecedorId} onChange={set('fornecedorId')} vazio="Nenhum" opcoes={(forn.data ?? []).map((x) => ({ valor: x.id, rotulo: x.fantasia || x.nome }))} hint="NC de material com lote baixa a nota do fornecedor." />
          )}
          {(material || f.loteId) && lotes.data && lotes.data.length > 0 && (
            <SelectField label="Lote" value={f.loteId} onChange={set('loteId')} vazio="Nenhum" opcoes={lotes.data.map((l) => ({ valor: l.id, rotulo: `${l.codigo}${nomeDe(l.fornecedor) ? ` · ${nomeDe(l.fornecedor)}` : ''}` }))} />
          )}
          {(f.origem === 'OPERADOR' || f.colaboradorId) && (
            <SelectField label="Operador" value={f.colaboradorId} onChange={set('colaboradorId')} vazio="Nenhum" opcoes={(colab.data?.itens ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function DetalheNC({ nc, onFechar }: { nc: NaoConformidade; onFechar: () => void }) {
  const encerrada = nc.status === 'ENCERRADA';
  const [f, setF] = useState({ causa: nc.causa ?? '', acaoCorretiva: nc.acaoCorretiva ?? '', responsavelId: nc.responsavelId ?? nc.responsavel?.id ?? '', prazo: (nc.prazo ?? '').slice(0, 10) });
  const [erro, setErro] = useState<string | null>(null);
  const [perguntar, setPerguntar] = useState(false);
  const { usuario } = useAuth();
  const responsaveis = [...new Map([...(usuario ? [[usuario.id, usuario.nome]] : []), ...(nc.responsavel ? [[nc.responsavel.id, nc.responsavel.nome]] : [])] as [string, string][]).entries()].map(([valor, rotulo]) => ({ valor, rotulo }));
  const salvar = useAcao(
    () => api(`/qualidade/ncs/${nc.id}`, { method: 'PATCH', body: { causa: f.causa.trim(), acaoCorretiva: f.acaoCorretiva.trim(), responsavelId: f.responsavelId || null, prazo: f.prazo || null } }),
    { invalida: INVAL, sucesso: 'Tratamento registrado. A NC está em tratamento e a OS pode ser entregue.', onSuccess: onFechar }
  );
  const encerrar = useAcao((eficaz: boolean) => api(`/qualidade/ncs/${nc.id}/encerrar`, { method: 'POST', body: { eficaz } }), {
    invalida: INVAL,
    sucesso: (_r, eficaz) => (eficaz ? 'NC encerrada. A causa foi tratada e fica no histórico.' : 'NC encerrada como ineficaz. Se o problema voltar, abra uma nova com o que aprendeu.'),
    onSuccess: onFechar
  });
  const gravar = () => {
    if (!f.causa.trim() || !f.acaoCorretiva.trim()) return setErro('Preencha a causa e a ação corretiva. Sem elas a NC continua aberta e a entrega travada.');
    setErro(null);
    salvar.mutate(undefined);
  };
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const linha = (rotulo: string, v: ReactNode) => (
    <div className="flex flex-col min-w-0">
      <dt className="text-caption text-ink-3">{rotulo}</dt>
      <dd className="m-0 break-words">{v ?? '—'}</dd>
    </div>
  );

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura={640}
      faixa={nc.status === 'ABERTA'}
      titulo={<span className="flex flex-wrap items-center gap-2">NC {nc.numero && <span className="mono">{nc.numero}</span>} <StatusNCPill status={nc.status} /></span>}
      rodape={
        encerrada ? (
          <Button onClick={onFechar}>Fechar</Button>
        ) : perguntar ? (
          <>
            <Button onClick={() => setPerguntar(false)}>Voltar</Button>
            <Button variante="perigo" icone={XCircle} carregando={encerrar.isPending && encerrar.variables === false} onClick={() => encerrar.mutate(false)}>Não resolveu</Button>
            <Button variante="primario" icone={CheckCircle2} carregando={encerrar.isPending && encerrar.variables === true} onClick={() => encerrar.mutate(true)}>Sim, foi eficaz</Button>
          </>
        ) : (
          <>
            <Button icone={ShieldCheck} disabled={nc.status !== 'EM_TRATAMENTO'} onClick={() => setPerguntar(true)} title={nc.status !== 'EM_TRATAMENTO' ? 'Salve a ação corretiva antes de encerrar' : undefined}>Encerrar NC</Button>
            <Button variante="primario" icone={ClipboardCheck} carregando={salvar.isPending} onClick={gravar}>Salvar tratamento</Button>
          </>
        )
      }
    >
      <p className="m-0 text-[15px]">{nc.descricao}</p>
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[14px]">
        {linha('Origem', ORIGEM[nc.origem] ?? nc.origem)}
        {linha('OS', nc.os ? <Link to={`/ordens-servico/${nc.os.id}`} className="mono">{nc.os.numero}</Link> : null)}
        {linha('Centro', nc.centro?.nome)}
        {nc.fornecedor && linha('Fornecedor', nc.fornecedor.nome)}
        {nc.lote && linha('Lote', <span className="mono">{nc.lote.codigo}</span>)}
        {nc.colaborador && linha('Operador', nc.colaborador.nome)}
        {linha('Aberta em', <span className="mono">{data((nc.criadaEm ?? (nc as { criadoEm?: string }).criadoEm))}</span>)}
        {encerrada && linha('Encerrada em', <span className="mono">{data(nc.encerradaEm)}</span>)}
        {encerrada && linha('Ação eficaz', nc.eficaz == null ? null : nc.eficaz ? 'Sim' : 'Não')}
      </dl>
      {nc.recorrencia && (
        <Aviso tom="warn" titulo="Problema recorrente">
          Já são 3 ou mais NCs em 90 dias no mesmo centro, operador ou fornecedor. Vale olhar a causa raiz, não só esta peça.
        </Aviso>
      )}
      {perguntar ? (
        <Aviso tom="info" titulo="A ação foi eficaz?">
          Confira se o problema parou de acontecer depois da ação: “{nc.acaoCorretiva}”. Encerrar não tem volta.
        </Aviso>
      ) : encerrada ? (
        <dl className="m-0 flex flex-col gap-3 text-[14px]">
          {linha('Causa', nc.causa)}
          {linha('Ação corretiva', nc.acaoCorretiva)}
          {linha('Responsável', nc.responsavel?.nome)}
          {linha('Prazo', <span className="mono">{data(nc.prazo)}</span>)}
        </dl>
      ) : (
        <>
          <TextArea label="Causa" value={f.causa} onChange={set('causa')} hint="Por que aconteceu? Ex.: alargador gasto, sem troca no prazo." />
          <TextArea label="Ação corretiva" value={f.acaoCorretiva} onChange={set('acaoCorretiva')} hint="O que muda para não repetir. Registrar a ação libera a entrega da OS." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="Responsável" value={f.responsavelId} onChange={set('responsavelId')} vazio="Escolha quem cuida" opcoes={responsaveis} hint="Quem responde pela ação no sistema (usuário)." />
            <TextField label="Prazo" type="date" value={f.prazo} onChange={set('prazo')} mono />
          </div>
          {erro && <Aviso tom="bad">{erro}</Aviso>}
          {nc.status === 'ABERTA' && <p className="m-0 text-caption text-ink-3">Para encerrar, primeiro salve a ação corretiva; depois volte aqui e confirme se ela funcionou.</p>}
        </>
      )}
    </Modal>
  );
}

/* ---------- Planos de inspeção ---------- */

type ItemEd = ItemPlano & { k: string };
let seq = 0;
const novaChave = () => `i${++seq}`;
const itemVazio = (tipo: TipoItemPlano = 'DIMENSIONAL'): ItemEd => ({ k: novaChave(), descricao: '', tipo, nominal: '', tolInferior: '0', tolSuperior: '0', unidade: 'mm', instrumento: '' });

function AbaPlanos() {
  const q = useQuery({ queryKey: ['qualidade', 'planos'], queryFn: () => api<unknown>('/qualidade/planos').then(lista<PlanoInspecao>) });
  const [editando, setEditando] = useState<string | 'novo' | null>(null);

  return (
    <Card className="overflow-hidden anim-subir" aria-label="Planos de inspeção">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <CardHeader
          titulo="Planos de inspeção"
          sub="O plano ativo do segmento vai para cada OS nova. Editar gera uma nova versão; as OS antigas ficam com a versão que usaram."
          acao={<Button variante="primario" icone={Plus} onClick={() => setEditando('novo')}>Novo plano</Button>}
        />
      </div>
      {q.isLoading ? (
        <Carregando rotulo="Carregando planos" />
      ) : q.isError ? (
        <ErroEstado erro={q.error} tentar={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState ilustracao="paquimetro" titulo="Nenhum plano ainda" texto="Monte o primeiro plano com as cotas e tolerâncias que o inspetor confere. Ele passa a valer para as OS do segmento." />
      ) : (
        <ul className="m-0 p-4 list-none grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
          {q.data.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setEditando(p.id)} aria-label={`Editar plano ${p.nome}`}
                className={`w-full h-full text-left rounded-card border border-border bg-surface-1 p-4 flex flex-col gap-2 hover:shadow-1 transition ${p.ativo ? '' : 'opacity-70'}`}>
                <span className="flex items-start justify-between gap-2">
                  <strong className="text-[16px] leading-snug">{p.nome}</strong>
                  <Pill tom="steel"><span className="mono">v{p.versao}</span></Pill>
                </span>
                <span className="text-[13.5px] text-ink-2">{SEGMENTO[p.segmento] ?? p.segmento} · <span className="mono">{p.itens?.length ?? 0}</span> {p.itens?.length === 1 ? 'item' : 'itens'}</span>
                <span className="flex flex-wrap gap-1.5">
                  {p.exigeInspecao ? <Pill tom="info" icone={Ruler}>Exige inspeção</Pill> : <Pill>Inspeção opcional</Pill>}
                  {p.ativo ? <Pill tom="ok" icone={CheckCircle2}>Ativo</Pill> : <Pill>Inativo</Pill>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editando && <EditorPlano id={editando === 'novo' ? null : editando} inicial={q.data?.find((p) => p.id === editando)} onFechar={() => setEditando(null)} />}
    </Card>
  );
}

function EditorPlano({ id, inicial, onFechar }: { id: string | null; inicial?: PlanoInspecao; onFechar: () => void }) {
  const q = useQuery({ queryKey: ['qualidade', 'planos', id], queryFn: () => api<PlanoInspecao>(`/qualidade/planos/${id}`), enabled: !!id, initialData: inicial });
  if (id && q.isError) return <Modal aberto onFechar={onFechar} titulo="Plano de inspeção"><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Modal>;
  if (id && !q.data) return <Modal aberto onFechar={onFechar} titulo="Plano de inspeção"><Carregando linhas={4} /></Modal>;
  return <FormPlano plano={id ? q.data : undefined} onFechar={onFechar} />;
}

function FormPlano({ plano, onFechar }: { plano?: PlanoInspecao; onFechar: () => void }) {
  const [f, setF] = useState(() => ({
    nome: plano?.nome ?? '',
    segmento: plano?.segmento ?? ('USINAGEM' as Segmento),
    exigeInspecao: plano?.exigeInspecao ?? true,
    ativo: plano?.ativo ?? true,
    itens: plano?.itens?.length ? plano.itens.map((i) => ({ ...i, k: novaChave() })) : [itemVazio()]
  }));
  const [erro, setErro] = useState<string | null>(null);
  const setItem = (k: string, it: ItemEd) => setF((x) => ({ ...x, itens: x.itens.map((i) => (i.k === k ? it : i)) }));
  const mover = (i: number, d: -1 | 1) =>
    setF((x) => {
      const l = [...x.itens];
      const [m] = l.splice(i, 1);
      l.splice(i + d, 0, m!);
      return { ...x, itens: l };
    });
  const salvar = useAcao(
    () => {
      const body = {
        nome: f.nome.trim(), segmento: f.segmento, exigeInspecao: f.exigeInspecao, ativo: f.ativo,
        itens: f.itens.map(({ descricao, tipo, nominal, tolInferior, tolSuperior, unidade, instrumento }) =>
          tipo === 'DIMENSIONAL'
            ? { descricao: descricao.trim(), tipo, nominal, tolInferior: tolInferior || '0', tolSuperior: tolSuperior || '0', unidade: unidade?.trim() || 'mm', instrumento: instrumento?.trim() || null }
            : { descricao: descricao.trim(), tipo, instrumento: instrumento?.trim() || null })
      };
      return plano ? api(`/qualidade/planos/${plano.id}`, { method: 'PATCH', body }) : api('/qualidade/planos', { method: 'POST', body });
    },
    { invalida: [['qualidade', 'planos']], sucesso: plano ? `Plano salvo como versão ${plano.versao + 1}. As próximas OS já usam esta.` : 'Plano criado. As próximas OS do segmento já saem com ele.', onSuccess: onFechar }
  );
  const enviar = () => {
    if (!f.nome.trim()) return setErro('Dê um nome ao plano, como “Dimensional — bucha H7”.');
    if (!f.itens.length) return setErro('Inclua pelo menos um item para o inspetor conferir.');
    const i = f.itens.findIndex((it) => !it.descricao.trim() || (it.tipo === 'DIMENSIONAL' && (it.nominal ?? '') === ''));
    if (i >= 0) return setErro(`O item ${i + 1} precisa de descrição${f.itens[i]!.tipo === 'DIMENSIONAL' ? ' e da medida nominal' : ''}.`);
    if (f.itens.some((it) => it.tipo === 'DIMENSIONAL' && toNum(it.tolInferior) > toNum(it.tolSuperior))) return setErro('Há item com tolerância inferior acima da superior. Confira os sinais.');
    setErro(null);
    salvar.mutate(undefined);
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura={820}
      titulo={plano ? <span className="flex flex-wrap items-center gap-2">{plano.nome} <Pill tom="steel"><span className="mono">v{plano.versao}</span></Pill></span> : 'Novo plano de inspeção'}
      rodape={
        <>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variante="primario" icone={ClipboardCheck} carregando={salvar.isPending} onClick={enviar}>{plano ? `Salvar como v${plano.versao + 1}` : 'Criar plano'}</Button>
        </>
      }
    >
      {plano && <Aviso tom="info">Salvar cria a versão {plano.versao + 1}. As OS que já usaram a v{plano.versao} continuam com ela; as novas pegam a nova versão.</Aviso>}
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        <TextField label="Nome" value={f.nome} onChange={(v) => setF({ ...f, nome: v })} required placeholder="Dimensional — bucha H7" />
        <SelectField label="Segmento" value={f.segmento} onChange={(v) => setF({ ...f, segmento: v as Segmento })} opcoes={(Object.keys(SEGMENTO) as Segmento[]).map((s) => ({ valor: s, rotulo: SEGMENTO[s] }))} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Toggle label="Exige inspeção" descricao="A OS só conclui com inspeção aprovada." value={f.exigeInspecao} onChange={(v) => setF({ ...f, exigeInspecao: v })} />
        <Toggle label="Ativo" descricao="Plano usado nas OS novas do segmento." value={f.ativo} onChange={(v) => setF({ ...f, ativo: v })} />
      </div>
      <h3 className="m-0 mt-2 text-[17px] font-semibold">Itens a conferir</h3>
      <ol className="m-0 p-0 list-none flex flex-col gap-3">
        {f.itens.map((it, i) => (
          <EditorItem
            key={it.k}
            n={i + 1}
            item={it}
            onChange={(x) => setItem(it.k, x)}
            onSubir={i > 0 ? () => mover(i, -1) : undefined}
            onDescer={i < f.itens.length - 1 ? () => mover(i, 1) : undefined}
            onRemover={() => setF((x) => ({ ...x, itens: x.itens.filter((y) => y.k !== it.k) }))}
          />
        ))}
      </ol>
      <Button icone={Plus} onClick={() => setF((x) => ({ ...x, itens: [...x.itens, itemVazio(x.segmento === 'USINAGEM' ? 'DIMENSIONAL' : 'CHECK')] }))} className="self-start">
        Adicionar item
      </Button>
      {erro && <Aviso tom="bad">{erro}</Aviso>}
    </Modal>
  );
}

function EditorItem({ n, item, onChange, onSubir, onDescer, onRemover }: { n: number; item: ItemEd; onChange: (i: ItemEd) => void; onSubir?: () => void; onDescer?: () => void; onRemover: () => void }) {
  const set = (k: keyof ItemPlano) => (v: string) => onChange({ ...item, [k]: v });
  const dim = item.tipo === 'DIMENSIONAL';
  return (
    <li className="rounded-field border border-border bg-surface-2 p-3 flex flex-col gap-3" aria-label={`Item ${n}`}>
      <div className="flex flex-wrap items-end gap-2">
        <span className="mono size-8 grid place-items-center rounded-full bg-surface-3 text-[13px] font-semibold self-center" aria-hidden>{n}</span>
        <TextField label="Descrição" value={item.descricao} onChange={set('descricao')} placeholder={dim ? 'Furo Ø20 H7' : 'Acabamento sem rebarba'} className="flex-[3_1_200px]" />
        <SelectField label="Tipo" value={item.tipo} onChange={(v) => onChange({ ...item, tipo: v as TipoItemPlano })} opcoes={(Object.keys(TIPO_ITEM) as TipoItemPlano[]).map((t) => ({ valor: t, rotulo: TIPO_ITEM[t] }))} className="flex-[1_1_130px]" />
        <div className="flex">
          <IconButton icone={ArrowUp} rotulo={`Subir item ${n}`} onClick={onSubir} disabled={!onSubir} className="disabled:opacity-30" />
          <IconButton icone={ArrowDown} rotulo={`Descer item ${n}`} onClick={onDescer} disabled={!onDescer} className="disabled:opacity-30" />
          <IconButton icone={Trash2} rotulo={`Remover item ${n}`} onClick={onRemover} className="hover:text-bad" />
        </div>
      </div>
      {dim ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <NumberField label="Nominal" value={item.nominal} onChange={set('nominal')} required />
            <NumberField label="Tol. inferior" value={item.tolInferior} onChange={set('tolInferior')} hint="ex.: 0 ou -0,02" />
            <NumberField label="Tol. superior" value={item.tolSuperior} onChange={set('tolSuperior')} hint="ex.: 0,021" />
            <TextField label="Unidade" value={item.unidade ?? ''} onChange={set('unidade')} />
            <TextField label="Instrumento" value={item.instrumento ?? ''} onChange={set('instrumento')} placeholder="Súbito 18–35" className="col-span-2 sm:col-span-1" />
          </div>
          <FaixaPreview item={item} />
        </>
      ) : (
        <TextField label="Instrumento ou método (opcional)" value={item.instrumento ?? ''} onChange={set('instrumento')} placeholder={item.tipo === 'SOLDA' ? 'Líquido penetrante' : 'Visual'} />
      )}
    </li>
  );
}

function FaixaPreview({ item }: { item: ItemPlano }) {
  const [teste, setTeste] = useState('');
  const un = item.unidade?.trim() || 'mm';
  if ((item.nominal ?? '') === '') return <p className="m-0 text-caption text-ink-3">Informe o nominal para ver a faixa aceita e testar uma medida.</p>;
  const casas = casasDe(item.nominal, item.tolInferior, item.tolSuperior);
  const min = toNum(item.nominal) + toNum(item.tolInferior), max = toNum(item.nominal) + toNum(item.tolSuperior);
  if (min > max) return <p className="m-0 text-caption text-bad font-medium">A tolerância inferior ficou acima da superior. Confira os sinais.</p>;
  return (
    <div className="rounded-field bg-surface-1 border border-border p-3 flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex flex-col">
        <span className="text-caption text-ink-3">Faixa aceita</span>
        <strong className="mono text-[15px]">{num(min, casas)} a {num(max, casas)} {un}</strong>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink-3">Medida de teste</span>
        <span className="campo w-[150px]">
          <DecimalInput value={teste} onChange={setTeste} className="text-right" placeholder={num(item.nominal, casas)} aria-label={`Medida de teste para ${item.descricao || 'o item'}`} />
          <span className="un">{un}</span>
        </span>
      </label>
      <div className="flex-[1_1_200px] min-w-0">
        <BarraMedicao nominal={String(item.nominal)} tolInferior={item.tolInferior || '0'} tolSuperior={item.tolSuperior || '0'} medido={teste} unidade={un} />
      </div>
    </div>
  );
}

/* ---------- Rastreabilidade ---------- */

function AbaRastreio() {
  const [sp] = useSearchParams();
  const inicial = sp.get('lote') ? 'lote' : sp.get('os') ? 'os' : 'lote';
  const [modo, setModo] = useState<'lote' | 'os'>(inicial);
  const [texto, setTexto] = useState('');
  const [alvo, setAlvo] = useState<string | null>(sp.get('lote') ?? sp.get('os'));
  const lotes = useLotes(modo === 'lote');
  const oss = useOSs(undefined, modo === 'os');
  const q = useQuery({
    queryKey: ['qualidade', 'rastreabilidade', modo, alvo],
    queryFn: () => api<Solto>('/qualidade/rastreabilidade', { query: modo === 'lote' ? { loteId: alvo } : { osId: alvo } }),
    enabled: !!alvo,
    retry: false
  });

  const resolver = (t: string) => {
    const s = t.trim().toLowerCase();
    if (!s) return null;
    if (modo === 'lote') return lotes.data?.find((l) => l.id === t.trim() || l.codigo.toLowerCase() === s)?.id ?? t.trim();
    return oss.data?.find((o) => o.id === t.trim() || o.numero.toLowerCase() === s)?.id ?? t.trim();
  };
  const rastrear = (e?: FormEvent) => {
    e?.preventDefault();
    setAlvo(resolver(texto));
  };
  const opcoes = modo === 'lote'
    ? (lotes.data ?? []).map((l) => ({ valor: l.codigo, rotulo: `${l.codigo}${nomeDe(l.fornecedor) ? ` · ${nomeDe(l.fornecedor)}` : ''}${l.certificado?.corrida ? ` · corrida ${l.certificado.corrida}` : ''}` }))
    : (oss.data ?? []).map((o) => ({ valor: o.numero, rotulo: `${o.numero} · ${o.titulo}${o.cliente?.nome ? ` · ${o.cliente.nome}` : ''}` }));

  return (
    <Card className="overflow-hidden anim-subir" aria-label="Rastreabilidade">
      <div className="px-5 pt-5 pb-4 border-b border-border flex flex-col gap-3">
        <CardHeader titulo="Rastreabilidade" sub="Do lote de material até a peça entregue, ou da OS de volta à corrida do aço. É o que o cliente pede quando quer provar a origem." />
        <Segmented label="Rastrear a partir de" value={modo} onChange={(m) => { setModo(m); setTexto(''); setAlvo(null); }} tamanho="sm" opcoes={[{ valor: 'lote', rotulo: 'Lote de material' }, { valor: 'os', rotulo: 'Ordem de serviço' }]} />
        <form onSubmit={rastrear} className="flex flex-wrap items-end gap-3">
          {opcoes.length > 0 && (
            <SelectField label={modo === 'lote' ? 'Escolha o lote' : 'Escolha a OS'} value={opcoes.some((o) => o.valor === texto) ? texto : ''} onChange={(v) => { setTexto(v); setAlvo(resolver(v)); }} vazio="Selecione…" opcoes={opcoes} className="flex-[2_1_240px]" />
          )}
          <TextField label={opcoes.length ? 'ou digite' : modo === 'lote' ? 'Código ou id do lote' : 'Número ou id da OS'} value={texto} onChange={setTexto} mono placeholder={modo === 'lote' ? 'LT-0001' : 'OS-41'} className="flex-[1_1_160px]" />
          <Button type="submit" variante="primario" icone={Search} disabled={!texto.trim()}>Rastrear</Button>
        </form>
      </div>
      <div className="p-5">
        {!alvo ? (
          <p className="m-0 text-ink-2">Escolha {modo === 'lote' ? 'um lote' : 'uma OS'} para ver a cadeia completa.</p>
        ) : q.isLoading ? (
          <Carregando linhas={4} rotulo="Montando a cadeia" />
        ) : q.isError ? (
          q.error instanceof ApiError && q.error.status === 404 ? (
            <Aviso tom="warn" titulo="Não achamos esse registro">Confira o {modo === 'lote' ? 'código do lote' : 'número da OS'} ou escolha na lista.</Aviso>
          ) : (
            <ErroEstado erro={q.error} tentar={() => q.refetch()} />
          )
        ) : modo === 'lote' ? (
          <CadeiaLote r={q.data ?? {}} />
        ) : (
          <CadeiaOS r={q.data ?? {}} />
        )}
      </div>
    </Card>
  );
}

function Passo({ icone: I, titulo, ultimo, children }: { icone: LucideIcon; titulo: ReactNode; ultimo?: boolean; children?: ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!ultimo && <span className="absolute left-5 top-11 bottom-0 w-0.5 -ml-px bg-border-strong" aria-hidden />}
      <span className="size-10 rounded-full bg-steel-soft text-steel grid place-items-center flex-none"><I className="size-5" strokeWidth={1.75} aria-hidden /></span>
      <div className="flex-1 min-w-0 pt-1.5 flex flex-col gap-1">
        <strong className="text-[15px]">{titulo}</strong>
        <div className="text-[14px] text-ink-2 flex flex-col gap-1 break-words">{children}</div>
      </div>
    </li>
  );
}

const Certificado = ({ c }: { c?: Solto | null }) =>
  c ? (
    <span>
      Certificado <span className="mono">{c.numero ?? '—'}</span>
      {c.corrida && <> · corrida <span className="mono">{c.corrida}</span></>}
      {c.norma && <> · {c.norma}</>}
    </span>
  ) : (
    <span className="text-warn font-medium">Sem certificado anexado</span>
  );

function CadeiaLote({ r }: { r: Solto }) {
  const lote: Solto = r.lote ?? r;
  const cert = r.certificado ?? lote.certificado;
  const forn = r.fornecedor ?? lote.fornecedor;
  const rec: Solto | null = r.recebimento ?? null;
  const ordens = primeiraLista(r.ordens, r.ordensServico, r.os, r.consumos);
  const item = rotuloRef(lote.item) ?? lote.itemDescricao ?? lote.descricao;
  return (
    <ol className="m-0 p-0 list-none" aria-label="Cadeia do lote">
      <Passo icone={Truck} titulo={`Fornecedor: ${rotuloRef(forn) ?? 'não informado'}`}>
        {rec ? (
          <span>
            Recebido em <span className="mono">{data(rec.data ?? rec.criadoEm)}</span>
            {rec.notaFiscal && <> · NF <span className="mono">{rec.notaFiscal}</span></>}
            {rotuloRef(rec.pedido) && <> · pedido <span className="mono">{rotuloRef(rec.pedido)}</span></>}
          </span>
        ) : (
          <span>Recebimento sem registro de nota.</span>
        )}
      </Passo>
      <Passo icone={Package} titulo={<>Lote <span className="mono">{lote.codigo ?? lote.id}</span></>}>
        {item && <span>{item}</span>}
        <span>
          Entrada <span className="mono">{num(lote.quantidadeInicial)}</span> · saldo <span className="mono">{num(lote.saldo)}</span>
          {lote.data && <> · <span className="mono">{data(lote.data)}</span></>}
        </span>
        <Certificado c={cert} />
      </Passo>
      <Passo icone={Wrench} titulo={`Consumido em ${ordens.length} ${ordens.length === 1 ? 'OS' : 'OSs'}`} ultimo>
        {ordens.length === 0 ? (
          <span>Nenhuma OS consumiu este lote ainda.</span>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2 mt-1">
            {ordens.map((o, i) => {
              const os: Solto = o.os ?? o;
              const entrega = o.entrega ?? os.entrega ?? os.entregueEm ?? os.dataEntrega;
              return (
                <li key={os.id ?? i} className="rounded-field border border-border bg-surface-2 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {os.id ? <Link to={`/ordens-servico/${os.id}`} className="mono font-medium">{os.numero ?? 'OS'}</Link> : <span className="mono">{os.numero}</span>}
                  <span className="flex-1 min-w-[140px] text-ink-1">{os.titulo}{rotuloRef(o.cliente ?? os.cliente) && <span className="text-ink-2"> · {rotuloRef(o.cliente ?? os.cliente)}</span>}</span>
                  {o.quantidade && <span className="mono text-caption">{num(o.quantidade)}</span>}
                  <span className="text-caption">{entrega ? <>entregue <span className="mono">{data(typeof entrega === 'string' ? entrega : entrega.data)}</span></> : 'ainda não entregue'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Passo>
    </ol>
  );
}

function CadeiaOS({ r }: { r: Solto }) {
  const os: Solto = r.os ?? r.ordem ?? {};
  const lotes = primeiraLista(r.lotes, r.consumos, r.itens);
  const entrega = r.entrega ?? os.entrega ?? os.entregueEm ?? os.dataEntrega;
  return (
    <ol className="m-0 p-0 list-none" aria-label="Lotes consumidos pela OS">
      <Passo icone={Wrench} titulo={<>{os.id ? <Link to={`/ordens-servico/${os.id}`} className="mono">{os.numero ?? 'OS'}</Link> : <span className="mono">{os.numero ?? 'OS'}</span>} {os.titulo}</>} ultimo={!lotes.length}>
        <span>
          {rotuloRef(r.cliente ?? os.cliente) ?? 'Cliente não informado'}
          {' · '}
          {entrega ? <>entregue <span className="mono">{data(typeof entrega === 'string' ? entrega : entrega.data)}</span></> : 'ainda não entregue'}
        </span>
        {os.id && <Link to={`/ordens-servico/${os.id}/laudo`} className="inline-flex items-center gap-1 text-[13.5px] font-medium"><FileText className="size-4" aria-hidden /> Ver laudo de inspeção</Link>}
        {!lotes.length && <span>Esta OS não consumiu material rastreável.</span>}
      </Passo>
      {lotes.map((l, i) => {
        const lote: Solto = l.lote ?? l;
        return (
          <Passo key={lote.id ?? i} icone={Package} ultimo={i === lotes.length - 1} titulo={<>Lote <span className="mono">{lote.codigo ?? lote.id}</span></>}>
            {(rotuloRef(l.item) ?? l.descricao) && <span>{rotuloRef(l.item) ?? l.descricao}{l.quantidade && <> · <span className="mono">{num(l.quantidade)}</span>{l.unidade ? ` ${l.unidade}` : ''}</>}</span>}
            <span>Fornecedor: {rotuloRef(l.fornecedor ?? lote.fornecedor) ?? 'não informado'}</span>
            <Certificado c={l.certificado ?? lote.certificado} />
          </Passo>
        );
      })}
    </ol>
  );
}

/* ---------- Garantias ---------- */

function GarantiaPill({ g }: { g: Garantia }) {
  if (emAnalise(g)) return <Pill tom="warn" icone={Hourglass}>Em análise</Pill>;
  if (g.procedente || g.status === 'PROCEDENTE') return <Pill tom="info" icone={Wrench}>Procedente</Pill>;
  return <Pill icone={ThumbsDown}>Improcedente</Pill>;
}

function AbaGarantias() {
  const q = useGarantias();
  const [nova, setNova] = useState(false);
  const [decidir, setDecidir] = useState<Garantia | null>(null);
  return (
    <Card className="overflow-hidden anim-subir" aria-label="Garantias">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <CardHeader
          titulo="Garantias"
          sub="Retorno de cliente sobre OS entregue. Se for procedente, abrimos uma OS de garantia sem cobrança e o custo vai para a não-qualidade."
          acao={<Button variante="primario" icone={Plus} onClick={() => setNova(true)}>Registrar garantia</Button>}
        />
      </div>
      {q.isLoading ? (
        <Carregando rotulo="Carregando garantias" />
      ) : q.isError ? (
        <ErroEstado erro={q.error} tentar={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState ilustracao="prancheta" titulo="Nenhuma garantia registrada" texto="Bom sinal. Quando um cliente voltar com problema numa OS entregue, registre aqui para analisar a causa." />
      ) : (
        <ul className="m-0 p-0 list-none">
          {q.data.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-t border-border first:border-t-0">
              <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">
                  <Link to={`/ordens-servico/${g.os.id}`} className="mono font-medium">{g.os.numero}</Link>
                  {g.os.titulo && <> · {g.os.titulo}</>}
                  {rotuloRef(g.os.cliente) && <> · {rotuloRef(g.os.cliente)}</>}
                  {g.criadaEm && <span className="mono"> · {data(g.criadaEm)}</span>}
                </span>
                <span className="break-words">{g.relato}</span>
                {g.analise && <span className="text-caption text-ink-2">Análise: {g.analise}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {g.osGarantia && <Link to={`/ordens-servico/${g.osGarantia.id}`} className="text-[13.5px] font-medium">OS de garantia <span className="mono">{g.osGarantia.numero}</span></Link>}
                <GarantiaPill g={g} />
                {emAnalise(g) && <Button tamanho="sm" onClick={() => setDecidir(g)} aria-label={`Decidir garantia da ${g.os.numero}`}>Decidir</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {nova && <NovaGarantia onFechar={() => setNova(false)} />}
      {decidir && <DecidirGarantia g={decidir} onFechar={() => setDecidir(null)} />}
    </Card>
  );
}

function NovaGarantia({ onFechar }: { onFechar: () => void }) {
  const [f, setF] = useState({ osId: '', relato: '' });
  const [erro, setErro] = useState<string | null>(null);
  const oss = useOSs('ENTREGUE');
  const params = useParametros();
  const dias = (params.data as { garantiaDias?: number } | undefined)?.garantiaDias ?? 90;
  const qc = useQueryClient();
  const toast = useToast();
  const criar = useMutation({
    mutationFn: () => api('/qualidade/garantias', { method: 'POST', body: { osId: f.osId, relato: f.relato.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qualidade'] });
      qc.invalidateQueries({ queryKey: ['painel'] });
      toast('Garantia registrada. Analise a causa e decida se é procedente.', 'ok');
      onFechar();
    },
    onError: (e) =>
      setErro(
        e instanceof ApiError && e.codigo === 'FORA_DA_GARANTIA'
          ? `Essa OS já passou dos ${dias} dias de garantia desde a entrega. Dá para atender como serviço novo, com orçamento.`
          : msgErro(e)
      )
  });
  const enviar = () => {
    if (!f.osId) return setErro('Escolha a OS entregue que voltou.');
    if (f.relato.trim().length < 5) return setErro('Conte o que o cliente relatou; é o ponto de partida da análise.');
    setErro(null);
    criar.mutate();
  };
  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Registrar garantia"
      largura={560}
      rodape={
        <>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variante="primario" icone={ShieldCheck} carregando={criar.isPending} onClick={enviar}>Registrar</Button>
        </>
      }
    >
      <SelectField
        label="OS entregue"
        value={f.osId}
        onChange={(v) => setF({ ...f, osId: v })}
        vazio={oss.isLoading ? 'Carregando…' : oss.data?.length ? 'Escolha a OS' : 'Nenhuma OS entregue'}
        opcoes={opcoesOS(oss.data)}
        hint={`Vale para OS entregues há até ${dias} dias.`}
      />
      <TextArea label="Relato do cliente" value={f.relato} onChange={(v) => setF({ ...f, relato: v })} hint="Ex.: bucha com folga depois de duas semanas de uso." />
      {erro && <Aviso tom="bad">{erro}</Aviso>}
    </Modal>
  );
}

function DecidirGarantia({ g, onFechar }: { g: Garantia; onFechar: () => void }) {
  const [procedente, setProcedente] = useState<boolean | null>(null);
  const [analise, setAnalise] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const navigate = useNavigate();
  const decidir = useAcao(() => api<Solto | null>(`/qualidade/garantias/${g.id}/decidir`, { method: 'POST', body: { procedente, analise: analise.trim() } }), {
    invalida: INVAL,
    sucesso: procedente ? 'Garantia procedente. Abrimos uma OS de garantia sem cobrança, já na fila.' : 'Garantia improcedente registrada com a análise.',
    onSuccess: (r) => {
      onFechar();
      const nova = r?.osGarantia?.id ?? r?.osGarantiaId ?? r?.novaOs?.id;
      if (procedente && nova) navigate(`/ordens-servico/${nova}`);
    }
  });
  const enviar = () => {
    if (procedente === null) return setErro('Escolha se a garantia é procedente ou não.');
    if (analise.trim().length < 5) return setErro('Registre a análise da causa. Ela fica no histórico e ajuda a evitar o próximo retorno.');
    setErro(null);
    decidir.mutate(undefined);
  };
  const opcao = (v: boolean, rotulo: string, texto: string, I: LucideIcon) => (
    <button type="button" aria-pressed={procedente === v} onClick={() => setProcedente(v)}
      className={`flex-[1_1_200px] text-left rounded-field border-2 p-3 flex gap-3 transition ${procedente === v ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-2 hover:border-ink-3'}`}>
      <I className="size-5 flex-none mt-0.5" aria-hidden />
      <span className="flex flex-col"><strong>{rotulo}</strong><span className="text-caption text-ink-2">{texto}</span></span>
    </button>
  );
  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={<>Decidir garantia <span className="mono">{g.os.numero}</span></>}
      largura={580}
      rodape={
        <>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variante="primario" icone={CheckCircle2} carregando={decidir.isPending} onClick={enviar}>Registrar decisão</Button>
        </>
      }
    >
      <p className="m-0 text-ink-2">Relato: “{g.relato}”</p>
      <div role="group" aria-label="A garantia é procedente?" className="flex flex-wrap gap-2">
        {opcao(true, 'Procedente', 'Defeito nosso. Abre OS de garantia sem cobrança.', Wrench)}
        {opcao(false, 'Improcedente', 'Uso indevido ou fora do escopo. Nada é aberto.', ThumbsDown)}
      </div>
      <TextArea label="Análise" value={analise} onChange={setAnalise} rows={4} hint="O que foi verificado e qual a causa provável." />
      {erro && <Aviso tom="bad">{erro}</Aviso>}
    </Modal>
  );
}
