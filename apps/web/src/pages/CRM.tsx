import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, ChevronsLeftRight, FileText, Mail, MessageCircle, Phone, Plus, Save, ThumbsDown, Truck, ClipboardList, type LucideIcon } from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import { brl, data, iniciais, num, pct, toNum } from '../lib/format';
import { useAcao, useClientes } from '../lib/queries';
import { SEGMENTO } from '../lib/rotulos';
import type { Segmento } from '../lib/types';
import { useTitulo } from '../layout/titulo';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader, Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { NumberField, Segmented, Select, SelectField, TextArea, TextField, Toggle } from '../components/Field';
import { Modal } from '../components/Modal';
import { Busca, DataTable, FiltroChips, type Coluna } from '../components/DataTable';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill, type Tom } from '../components/Pill';
import { Abas, useAba } from '../components/Abas';
import { MOTIVOS_PERDA, PerderDialog, type CorpoPerda, type MotivoPerda } from '../components/PerderDialog';
import { useToast } from '../components/Toast';
import {
  agruparAgenda, comoLista, dataProxima, diaLocal, ETAPAS, FINAIS, funilDe, moverNaLista, nomeRef, normalizarIndicadores, ROTULO_ETAPA, ROTULO_ORIGEM, ROTULO_TIPO, taxaConversao, tomNps,
  type Atividade, type Etapa, type LinhaConversao, type ListaOportunidades, type Oportunidade, type Origem, type Ref, type TipoAtividade, type Totais
} from '../features/crm/funil';

type Aba = 'funil' | 'tabela' | 'agenda' | 'indicadores';
const ABAS: Aba[] = ['funil', 'tabela', 'agenda', 'indicadores'];
const TOM_ETAPA: Record<Etapa, Tom> = { LEAD: 'neutral', CONTATO: 'steel', ORCAMENTO_ENVIADO: 'info', NEGOCIACAO: 'warn', GANHO: 'ok', PERDIDO: 'bad' };
const ICONE_TIPO: Record<TipoAtividade, LucideIcon> = { LIGACAO: Phone, VISITA: Truck, MENSAGEM: MessageCircle, EMAIL: Mail, TAREFA: ClipboardList };
const opcoesEtapa = (lista: Etapa[] = ETAPAS) => lista.map((e) => ({ valor: e, rotulo: ROTULO_ETAPA[e] }));
const opcoesTipo = (Object.keys(ROTULO_TIPO) as TipoAtividade[]).map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }));
const hojeLocal = () => diaLocal(new Date().toISOString());
const quando = (diasMais = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + diasMais);
  return `${diaLocal(d.toISOString())}T09:00`;
};
const comHora = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? data(iso) : `${data(diaLocal(iso))} ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
const nomeCliente = (o: Oportunidade) => o.cliente?.nome || o.contato || 'Sem cliente';
const idResp = (o: Oportunidade) => o.responsavelId ?? (o.responsavel && typeof o.responsavel === 'object' ? o.responsavel.id : '') ?? '';
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const chaveLista = (f: { responsavelId: string; q: string }) => ['crm', 'oportunidades', f] as const;
const buscarLista = async (f: { responsavelId: string; q: string }): Promise<ListaOportunidades> => {
  const r = await api<Oportunidade[] | Partial<ListaOportunidades>>('/crm/oportunidades', { query: f });
  if (Array.isArray(r)) return { itens: r, total: r.length };
  return { itens: r.itens ?? [], total: r.total ?? r.itens?.length ?? 0, funil: r.funil };
};

export default function CRM() {
  useTitulo('Oportunidades');
  const { usuario, pode } = useAuth();
  const podeEditar = pode('crm.gerenciar');
  const [aba, setAba] = useAba<Aba>('funil', ABAS);
  const [filtro, setFiltro] = useState({ responsavelId: '', q: '' });
  const lista = useQuery({ queryKey: chaveLista(filtro), queryFn: () => buscarLista(filtro) });
  const usuariosQ = useQuery({ queryKey: ['usuarios', 'opcoes'], queryFn: () => api<Ref[] | { itens: Ref[] }>('/usuarios/opcoes'), staleTime: 5 * 60_000 });
  const responsaveis = comoLista(usuariosQ.data);
  const agendaQ = useQuery({
    queryKey: ['crm', 'atividades', 'minhas', usuario?.id],
    queryFn: () => api<Atividade[] | { itens: Atividade[] }>('/crm/atividades', { query: { responsavelId: usuario?.id, pendentes: 'true' } }),
    enabled: !!usuario?.id
  });
  const minhas = useMemo(() => comoLista(agendaQ.data).filter((a) => !a.concluida), [agendaQ.data]);
  const grupos = useMemo(() => agruparAgenda(minhas, hojeLocal()), [minhas]);

  const [ficha, setFicha] = useState<Oportunidade | 'nova' | null>(null);
  const [perdendo, setPerdendo] = useState<Oportunidade | null>(null);
  // Link direto (?oportunidade=id), vindo da ficha do cliente ou de uma notificação.
  const [sp, setSp] = useSearchParams();
  const alvo = sp.get('oportunidade');
  useEffect(() => {
    if (!alvo || !lista.data) return;
    const op = comoLista(lista.data).find((x) => x.id === alvo);
    if (op) setFicha(op);
    const n = new URLSearchParams(sp); n.delete('oportunidade'); setSp(n, { replace: true });
  }, [alvo, lista.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const qc = useQueryClient();
  const toast = useToast();
  const chave = chaveLista(filtro);

  const mover = useMutation({
    mutationFn: ({ id, etapa }: { id: string; etapa: Etapa }) => api(`/crm/oportunidades/${id}/mover`, { method: 'POST', body: { etapa } }),
    onMutate: async ({ id, etapa }) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<ListaOportunidades>(chave);
      if (antes) qc.setQueryData(chave, moverNaLista(antes, id, etapa));
      return { antes };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(chave, ctx.antes);
      toast(msgErro(e), 'bad');
    },
    onSuccess: (_r, v) => toast(v.etapa === 'GANHO' ? 'Fechou! Oportunidade ganha. Bom trabalho.' : `Movida para ${ROTULO_ETAPA[v.etapa]}.`, 'ok'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['crm'] })
  });
  const perder = useMutation({
    mutationFn: ({ id, b }: { id: string; b: CorpoPerda }) => api(`/crm/oportunidades/${id}/perder`, { method: 'POST', body: b }),
    onSuccess: () => {
      setPerdendo(null);
      setFicha(null);
      toast('Perda registrada. O motivo já entra nos indicadores.', 'ok');
      qc.invalidateQueries({ queryKey: ['crm'] });
    }
  });
  const pedirEtapa = (o: Oportunidade, etapa: Etapa) => {
    if (etapa === o.etapa) return;
    if (etapa === 'PERDIDO') { perder.reset(); setPerdendo(o); }
    else mover.mutate({ id: o.id, etapa });
  };

  const itens = lista.data?.itens ?? [];
  const totais = funilDe(lista.data);
  const abertas = ETAPAS.filter((e) => !FINAIS.includes(e));
  const valorAberto = abertas.reduce((a, e) => a + totais[e].valor, 0);
  const qtdAberta = abertas.reduce((a, e) => a + totais[e].quantidade, 0);
  const conv = taxaConversao(totais);
  const pendentesHoje = grupos.atrasadas.length + grupos.hoje.length;
  const erroPerda = perder.error instanceof ApiError && perder.error.codigo === 'PRECO_ACEITO_OBRIGATORIO'
    ? 'Com motivo preço, informe quanto o cliente aceitaria pagar.'
    : perder.error ? msgErro(perder.error) : null;

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        sobretitulo="Comercial"
        titulo="Oportunidades"
        texto={
          lista.isLoading ? 'Juntando o funil…'
            : `${plural(qtdAberta, 'negócio em aberto', 'negócios em aberto')} somando ${brl(valorAberto)}. ${grupos.atrasadas.length ? `${plural(grupos.atrasadas.length, 'retorno atrasado', 'retornos atrasados')} na sua agenda: ligue antes que esfrie.` : 'Sua agenda está em dia.'}`
        }
        acoes={podeEditar && <Button variante="primario" icone={Plus} onClick={() => setFicha('nova')}>Nova oportunidade</Button>}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <div className="sm:col-span-2 min-w-0 grid"><HeroKpi destaque rotulo="Em aberto" valor={<span className="text-[clamp(24px,2.6vw,38px)]">{brl(valorAberto)}</span>} sub={plural(qtdAberta, 'oportunidade', 'oportunidades')} /></div>
          <HeroKpi rotulo="Em negociação" valor={totais.NEGOCIACAO.quantidade} sub={brl(totais.NEGOCIACAO.valor)} />
          <HeroKpi rotulo="Ganhas" valor={totais.GANHO.quantidade} sub={conv === null ? 'sem decisões ainda' : `${pct(conv, 0)} das decididas`} />
          <HeroKpi rotulo="Retornos para hoje" valor={agendaQ.isLoading ? '…' : pendentesHoje} sub={grupos.atrasadas.length ? `${grupos.atrasadas.length} atrasados` : 'nada atrasado'} />
        </div>
      </HeroBand>

      <Abas<Aba>
        rotulo="Visões do CRM"
        valor={aba}
        onChange={setAba}
        abas={[
          { valor: 'funil', rotulo: 'Funil' },
          { valor: 'tabela', rotulo: 'Tabela', n: lista.data?.total },
          { valor: 'agenda', rotulo: 'Minha agenda', n: pendentesHoje },
          { valor: 'indicadores', rotulo: 'Indicadores' }
        ]}
      />

      {(aba === 'funil' || aba === 'tabela') && (
        <div className="flex flex-wrap items-center gap-2">
          <Busca valor={filtro.q} onChange={(q) => setFiltro({ ...filtro, q })} placeholder="Buscar por título, cliente ou contato" rotulo="Buscar oportunidades" />
          <Select aria-label="Responsável" className="w-full sm:w-[220px]" value={filtro.responsavelId} onChange={(responsavelId) => setFiltro({ ...filtro, responsavelId })} vazio="Todos os responsáveis" opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
        </div>
      )}

      {(aba === 'funil' || aba === 'tabela') && (lista.isLoading ? <Card><Carregando /></Card>
        : lista.isError ? <Card><ErroEstado erro={lista.error} tentar={() => lista.refetch()} /></Card>
        : itens.length === 0 ? (
          <Card>
            <EmptyState
              titulo={filtro.q || filtro.responsavelId ? 'Nada com esse filtro' : 'Funil vazio por enquanto'}
              texto={filtro.q || filtro.responsavelId ? 'Tente outro nome ou limpe o responsável.' : 'Cada orçamento enviado já vira oportunidade aqui. Ligações e indicações você lança à mão.'}
            />
          </Card>
        ) : aba === 'funil' ? (
          <Funil itens={itens} totais={totais} responsaveis={responsaveis} podeEditar={podeEditar} onAbrir={setFicha} onEtapa={pedirEtapa} />
        ) : (
          <Tabela itens={itens} totais={totais} responsaveis={responsaveis} onAbrir={setFicha} />
        ))}

      {aba === 'agenda' && <Agenda q={agendaQ} grupos={grupos} oportunidades={itens} podeEditar={podeEditar} />}
      {aba === 'indicadores' && <Indicadores />}

      <FichaOportunidade
        aberta={ficha !== null}
        op={ficha === 'nova' ? null : ficha}
        responsaveis={responsaveis}
        podeEditar={podeEditar}
        onFechar={() => setFicha(null)}
        onPerder={(o) => { perder.reset(); setPerdendo(o); }}
      />
      <PerderDialog
        aberto={!!perdendo}
        onFechar={() => setPerdendo(null)}
        titulo={perdendo ? `Perdemos: ${perdendo.titulo}` : 'Registrar perda'}
        precoOfertado={perdendo?.valorEstimado}
        enviando={perder.isPending}
        erro={erroPerda}
        onConfirmar={(b) => perdendo && perder.mutate({ id: perdendo.id, b })}
      />
    </>
  );
}

function Avatar({ nome }: { nome: string }) {
  if (!nome) return <span className="text-caption text-ink-3">sem dono</span>;
  return <span className="size-7 rounded-full bg-steel-soft text-steel grid place-items-center text-[11px] font-bold flex-none" title={nome} aria-label={`Responsável: ${nome}`}>{iniciais(nome)}</span>;
}

const nomeResp = (o: Oportunidade, rs: Ref[]) => nomeRef(o.responsavel) || rs.find((r) => r.id === o.responsavelId)?.nome || '';

function Funil({ itens, totais, responsaveis, podeEditar, onAbrir, onEtapa }: {
  itens: Oportunidade[]; totais: Totais; responsaveis: Ref[]; podeEditar: boolean; onAbrir: (o: Oportunidade) => void; onEtapa: (o: Oportunidade, e: Etapa) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Etapa | null>(null);
  const [visivel, setVisivel] = useState<Etapa>('LEAD');
  const [expandidas, setExpandidas] = useState<Set<Etapa>>(new Set());
  const hoje = hojeLocal();
  const soltar = (e: DragEvent, etapa: Etapa) => {
    e.preventDefault();
    const o = itens.find((x) => x.id === arrastando);
    setArrastando(null);
    setAlvo(null);
    if (o) onEtapa(o, etapa);
  };

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="md:hidden">
        <Select aria-label="Etapa do funil" value={visivel} onChange={(v) => setVisivel(v as Etapa)} opcoes={ETAPAS.map((e) => ({ valor: e, rotulo: `${ROTULO_ETAPA[e]} (${totais[e].quantidade})` }))} />
      </div>
      <div className="relative overflow-x-auto pb-2">
        <div className="flex gap-3 items-start md:min-w-max">
          {ETAPAS.map((etapa) => {
            const cards = itens.filter((o) => o.etapa === etapa);
            const final = FINAIS.includes(etapa);
            const recolhida = final && !expandidas.has(etapa);
            return (
              <section
                key={etapa}
                aria-label={`${ROTULO_ETAPA[etapa]}: ${totais[etapa].quantidade} oportunidades`}
                onDragOver={(e) => { if (arrastando) { e.preventDefault(); setAlvo(etapa); } }}
                onDragLeave={() => setAlvo((a) => (a === etapa ? null : a))}
                onDrop={(e) => soltar(e, etapa)}
                className={`${etapa === visivel ? 'flex' : 'hidden md:flex'} flex-col gap-2 w-full rounded-card bg-surface-2 p-2.5 transition ${recolhida ? 'md:w-[200px] md:flex-none' : 'md:w-[272px] md:min-w-[260px] md:flex-none'} ${alvo === etapa ? 'ring-2 ring-primary' : ''}`}
              >
                <header className="flex items-start gap-2 px-1">
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="flex items-center gap-2 font-semibold text-[14.5px]">
                      {ROTULO_ETAPA[etapa]}
                      <Pill tom={TOM_ETAPA[etapa]}><span className="mono">{totais[etapa].quantidade}</span></Pill>
                    </span>
                    <span className="mono text-[13px] text-ink-2">{brl(totais[etapa].valor)}</span>
                  </span>
                  {final && (
                    <button type="button" className="hidden md:grid size-8 place-items-center rounded-control text-ink-3 hover:bg-surface-3" aria-expanded={!recolhida}
                      aria-label={recolhida ? `Mostrar cartões de ${ROTULO_ETAPA[etapa]}` : `Recolher ${ROTULO_ETAPA[etapa]}`}
                      onClick={() => setExpandidas((s) => { const n = new Set(s); if (n.has(etapa)) n.delete(etapa); else n.add(etapa); return n; })}>
                      <ChevronsLeftRight className="size-4" aria-hidden />
                    </button>
                  )}
                </header>
                {cards.length === 0 && <p className="m-0 px-1 py-3 text-caption text-ink-3">{podeEditar ? 'Arraste um cartão para cá.' : 'Nada nesta etapa.'}</p>}
                {recolhida && cards.length > 0 && <p className="hidden md:block m-0 px-1 text-caption text-ink-3">Solte aqui para mover. Abra para ver os cartões.</p>}
                <ul className={`m-0 p-0 list-none flex flex-col gap-2 ${recolhida ? 'md:hidden' : ''}`}>
                  {cards.map((o) => {
                    const prox = dataProxima(o.proximaAtividade);
                    const atrasada = !!prox && diaLocal(prox) < hoje;
                    return (
                      <li
                        key={o.id}
                        draggable={podeEditar}
                        onDragStart={(e) => { setArrastando(o.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', o.id); }}
                        onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                        className={`card p-3 flex flex-col gap-2 ${podeEditar ? 'cursor-grab' : ''} ${arrastando === o.id ? 'opacity-50' : ''}`}
                      >
                        <button type="button" onClick={() => onAbrir(o)} className="text-left font-semibold text-ink-1 hover:underline leading-snug">{o.titulo}</button>
                        <span className="text-caption text-ink-2 truncate">{nomeCliente(o)}</span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="mono font-semibold">{brl(o.valorEstimado)}</span>
                          <Avatar nome={nomeResp(o, responsaveis)} />
                        </div>
                        {(prox || o.orcamentoId) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
                            {prox && (
                              <span className={`inline-flex items-center gap-1 ${atrasada ? 'text-bad font-semibold' : 'text-ink-2'}`} title="Próxima atividade">
                                <CalendarClock className="size-3.5" aria-hidden />
                                <span className="mono">{data(diaLocal(prox))}</span>
                                <span className="sr-only">{atrasada ? 'atrasada' : 'próxima atividade'}</span>
                              </span>
                            )}
                            {o.orcamentoId && (
                              <Link to={`/orcamentos/${o.orcamentoId}`} className="inline-flex items-center gap-1 text-steel hover:underline">
                                <FileText className="size-3.5" aria-hidden />Orçamento
                              </Link>
                            )}
                          </div>
                        )}
                        {podeEditar && (
                          <Select aria-label={`Mover ${o.titulo} para outra etapa`} className="!min-h-9 text-[13px]" value={o.etapa} onChange={(v) => onEtapa(o, v as Etapa)} opcoes={opcoesEtapa()} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tabela({ itens, totais, responsaveis, onAbrir }: { itens: Oportunidade[]; totais: Totais; responsaveis: Ref[]; onAbrir: (o: Oportunidade) => void }) {
  const [etapa, setEtapa] = useState<'todas' | Etapa>('todas');
  const visiveis = etapa === 'todas' ? itens : itens.filter((o) => o.etapa === etapa);
  const colunas: Coluna<Oportunidade>[] = [
    { chave: 'titulo', titulo: 'Oportunidade', principal: true, render: (o) => <button type="button" onClick={() => onAbrir(o)} className="text-left font-semibold hover:underline">{o.titulo}</button> },
    { chave: 'cliente', titulo: 'Cliente', render: nomeCliente },
    { chave: 'etapa', titulo: 'Etapa', render: (o) => <Pill tom={TOM_ETAPA[o.etapa]}>{ROTULO_ETAPA[o.etapa]}</Pill> },
    { chave: 'origem', titulo: 'Origem', render: (o) => (o.origem ? ROTULO_ORIGEM[o.origem] ?? o.origem : '—') },
    { chave: 'valor', titulo: 'Valor estimado', alinhar: 'right', mono: true, render: (o) => brl(o.valorEstimado) },
    { chave: 'resp', titulo: 'Responsável', render: (o) => nomeResp(o, responsaveis) || '—' },
    { chave: 'prox', titulo: 'Próxima atividade', mono: true, render: (o) => { const p = dataProxima(o.proximaAtividade); return p ? data(diaLocal(p)) : '—'; } },
    { chave: 'orc', titulo: 'Orçamento', render: (o) => (o.orcamentoId ? <Link to={`/orcamentos/${o.orcamentoId}`} className="text-steel hover:underline">Abrir</Link> : '—') }
  ];
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5">
        <FiltroChips<'todas' | Etapa> rotulo="Filtrar por etapa" valor={etapa} onChange={setEtapa}
          opcoes={[{ valor: 'todas', rotulo: 'Todas', n: itens.length }, ...ETAPAS.map((e) => ({ valor: e, rotulo: ROTULO_ETAPA[e], n: totais[e].quantidade }))]} />
      </div>
      {visiveis.length === 0 ? <p className="m-0 px-5 pb-5 text-ink-2">Nenhuma oportunidade nesta etapa.</p>
        : <DataTable rotulo="Oportunidades" colunas={colunas} linhas={visiveis} chave={(o) => o.id} />}
    </Card>
  );
}

type FormOp = { titulo: string; clienteId: string; contato: string; origem: Origem; etapa: Etapa; valorEstimado: string; responsavelId: string; observacao: string };

function FichaOportunidade({ aberta, op, responsaveis, podeEditar, onFechar, onPerder }: {
  aberta: boolean; op: Oportunidade | null; responsaveis: Ref[]; podeEditar: boolean; onFechar: () => void; onPerder: (o: Oportunidade) => void;
}) {
  const { usuario } = useAuth();
  const clientes = useClientes();
  const vazio = (): FormOp => ({
    titulo: op?.titulo ?? '', clienteId: op?.cliente?.id ?? op?.clienteId ?? '', contato: op?.contato ?? '', origem: op?.origem ?? 'INDICACAO', etapa: op?.etapa ?? 'LEAD',
    valorEstimado: op?.valorEstimado == null ? '' : String(op.valorEstimado), responsavelId: (op ? idResp(op) : usuario?.id) ?? '', observacao: op?.observacao ?? ''
  });
  const [f, setF] = useState<FormOp>(vazio);
  const [tentou, setTentou] = useState(false);
  useEffect(() => { if (aberta) { setF(vazio()); setTentou(false); } }, [aberta, op?.id]);

  const salvar = useAcao(
    async () => {
      const corpo = { titulo: f.titulo.trim(), clienteId: f.clienteId || null, contato: f.contato.trim(), origem: f.origem, valorEstimado: String(toNum(f.valorEstimado)), responsavelId: f.responsavelId || null, observacao: f.observacao.trim() || null };
      if (!op) return api('/crm/oportunidades', { method: 'POST', body: { ...corpo, etapa: f.etapa } });
      await api(`/crm/oportunidades/${op.id}`, { method: 'PATCH', body: corpo });
      if (f.etapa !== op.etapa) await api(`/crm/oportunidades/${op.id}/mover`, { method: 'POST', body: { etapa: f.etapa } });
    },
    { invalida: [['crm']], sucesso: op ? (f.etapa === 'GANHO' && op.etapa !== 'GANHO' ? 'Fechou! Oportunidade ganha.' : 'Oportunidade atualizada.') : 'Oportunidade aberta. Marque já o primeiro contato.', onSuccess: onFechar }
  );
  const faltaTitulo = !f.titulo.trim();
  const faltaCliente = !f.clienteId && !f.contato.trim();
  const etapas = op?.etapa === 'PERDIDO' ? ETAPAS : ETAPAS.filter((e) => e !== 'PERDIDO');

  return (
    <Modal aberto={aberta} onFechar={onFechar} largura={720} titulo={op ? op.titulo : 'Nova oportunidade'}
      rodape={
        <>
          {op && podeEditar && !FINAIS.includes(op.etapa) && <Button variante="perigo" icone={ThumbsDown} onClick={() => onPerder(op)} className="mr-auto">Perder</Button>}
          <Button onClick={onFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</Button>
          {podeEditar && <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={() => { setTentou(true); if (!faltaTitulo && !faltaCliente) salvar.mutate(undefined); }}>Salvar</Button>}
        </>
      }>
      <fieldset disabled={!podeEditar} className="m-0 p-0 border-0 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField className="sm:col-span-2" label="Título" required value={f.titulo} onChange={(titulo) => setF({ ...f, titulo })} placeholder="Eixo de transmissão para a prensa 2" erro={tentou && faltaTitulo ? 'Dê um nome que você reconheça no funil.' : null} />
        <SelectField label="Cliente" value={f.clienteId} onChange={(clienteId) => setF({ ...f, clienteId })} vazio="Ainda sem cadastro" opcoes={comoLista(clientes.data).map((c) => ({ valor: c.id, rotulo: c.fantasia || c.nome }))}
          hint={clientes.isLoading ? 'Carregando clientes…' : undefined} />
        <TextField label="Contato" value={f.contato} onChange={(contato) => setF({ ...f, contato })} placeholder="Nome e telefone de quem pediu" erro={tentou && faltaCliente ? 'Escolha um cliente ou anote o contato.' : null} />
        <SelectField label="Origem" value={f.origem} onChange={(v) => setF({ ...f, origem: v as Origem })} opcoes={(Object.keys(ROTULO_ORIGEM) as Origem[]).map((o) => ({ valor: o, rotulo: ROTULO_ORIGEM[o] }))} />
        <SelectField label="Etapa" value={f.etapa} onChange={(v) => setF({ ...f, etapa: v as Etapa })} opcoes={opcoesEtapa(etapas)} hint={f.etapa === 'GANHO' && op?.etapa !== 'GANHO' ? 'Ao salvar, a oportunidade conta como ganha.' : 'Para registrar perda, use o botão Perder.'} />
        <NumberField label="Valor estimado" prefixo="R$" value={f.valorEstimado} onChange={(valorEstimado) => setF({ ...f, valorEstimado })} disabled={!podeEditar} />
        <SelectField label="Responsável" value={f.responsavelId} onChange={(responsavelId) => setF({ ...f, responsavelId })} vazio="Sem responsável" opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
        <TextArea className="sm:col-span-2" label="Observação" value={f.observacao} onChange={(observacao) => setF({ ...f, observacao })} />
      </fieldset>
      {op?.orcamentoId && <Link to={`/orcamentos/${op.orcamentoId}`} className="inline-flex items-center gap-1.5 text-steel hover:underline self-start"><FileText className="size-4" aria-hidden />Ver o orçamento ligado</Link>}
      {op && <AtividadesDaOportunidade op={op} responsavelId={f.responsavelId || usuario?.id || ''} podeEditar={podeEditar} />}
    </Modal>
  );
}

function AtividadesDaOportunidade({ op, responsavelId, podeEditar }: { op: Oportunidade; responsavelId: string; podeEditar: boolean }) {
  const q = useQuery({ queryKey: ['crm', 'atividades', 'op', op.id], queryFn: () => api<Atividade[] | { itens: Atividade[] }>('/crm/atividades', { query: { clienteId: op.cliente?.id ?? op.clienteId ?? undefined } }) });
  // A API não filtra por oportunidade: filtra aqui.
  const ativs = comoLista(q.data).filter((a) => a.oportunidadeId === op.id).sort((a, b) => b.data.localeCompare(a.data));
  const [n, setN] = useState({ tipo: 'LIGACAO' as TipoAtividade, data: quando(1), assunto: '' });
  const criar = useAcao(
    () => api('/crm/atividades', { method: 'POST', body: { tipo: n.tipo, assunto: n.assunto.trim(), data: new Date(n.data).toISOString(), oportunidadeId: op.id, clienteId: op.cliente?.id ?? op.clienteId ?? undefined, orcamentoId: op.orcamentoId ?? undefined, responsavelId } }),
    { invalida: [['crm']], sucesso: 'Atividade agendada.', onSuccess: () => setN({ tipo: 'LIGACAO', data: quando(1), assunto: '' }) }
  );
  return (
    <section aria-labelledby="h-ativ-op" className="flex flex-col gap-2 pt-3 border-t border-border">
      <h3 id="h-ativ-op" className="m-0 text-[17px] font-semibold">Atividades</h3>
      {q.isLoading ? <Carregando linhas={2} rotulo="Carregando atividades" /> : q.isError ? <p className="m-0 text-bad text-[14px]">{msgErro(q.error)}</p>
        : ativs.length === 0 ? <p className="m-0 text-ink-2 text-[14px]">Nenhuma atividade ainda. Quem não é lembrado não fecha.</p> : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {ativs.map((a) => {
              const I = ICONE_TIPO[a.tipo] ?? ClipboardList;
              return (
                <li key={a.id} className="flex items-start gap-2.5 py-2 border-t border-border first:border-0">
                  <I className={`size-4 mt-0.5 flex-none ${a.concluida ? 'text-ok' : 'text-ink-3'}`} aria-label={ROTULO_TIPO[a.tipo]} />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className={a.concluida ? 'text-ink-2' : ''}>{a.assunto}</span>
                    {a.resultado && <span className="text-caption text-ink-3">{a.resultado}</span>}
                  </span>
                  <span className="mono text-[13px] text-ink-2 whitespace-nowrap">{comHora(a.data)}</span>
                  {a.concluida && <CheckCircle2 className="size-4 text-ok flex-none" aria-label="Concluída" />}
                </li>
              );
            })}
          </ul>
        )}
      {podeEditar && (
        <div className="grid grid-cols-1 sm:grid-cols-[140px_190px_1fr_auto] gap-2 items-end">
          <SelectField label="Tipo" value={n.tipo} onChange={(v) => setN({ ...n, tipo: v as TipoAtividade })} opcoes={opcoesTipo} />
          <TextField label="Quando" type="datetime-local" mono value={n.data} onChange={(v) => setN({ ...n, data: v })} />
          <TextField label="Assunto" value={n.assunto} onChange={(v) => setN({ ...n, assunto: v })} placeholder="Retornar sobre o prazo" />
          <Button icone={Plus} disabled={!n.assunto.trim() || !n.data || !responsavelId} carregando={criar.isPending} onClick={() => criar.mutate(undefined)}>Agendar</Button>
        </div>
      )}
    </section>
  );
}

type Q = { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };

function Agenda({ q, grupos, oportunidades, podeEditar }: { q: Q; grupos: ReturnType<typeof agruparAgenda>; oportunidades: Oportunidade[]; podeEditar: boolean }) {
  const [concluindo, setConcluindo] = useState<Atividade | null>(null);
  const [nova, setNova] = useState(false);
  const opPorId = new Map(oportunidades.map((o) => [o.id, o]));
  const total = grupos.atrasadas.length + grupos.hoje.length + grupos.proximos.length;
  const secoes: { chave: keyof typeof grupos; titulo: string; sub: string; tom: Tom }[] = [
    { chave: 'atrasadas', titulo: 'Atrasadas', sub: 'Cliente esperando retorno. Comece por aqui.', tom: 'bad' },
    { chave: 'hoje', titulo: 'Hoje', sub: 'O que está combinado para hoje.', tom: 'warn' },
    { chave: 'proximos', titulo: 'Próximos dias', sub: 'Já agendado, sem pressa.', tom: 'steel' }
  ];
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {podeEditar && <div className="flex justify-end"><Button icone={Plus} onClick={() => setNova(true)}>Nova atividade</Button></div>}
      {q.isLoading ? <Card><Carregando /></Card> : q.isError ? <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>
        : total === 0 ? <Card><EmptyState titulo="Agenda limpa" texto="Nenhum retorno pendente com você. Bom momento para ligar para quem não compra há tempo." /></Card>
        : secoes.filter((s) => grupos[s.chave].length).map((s) => (
          <Card key={s.chave} className="p-4 sm:p-5 flex flex-col gap-3" aria-labelledby={`h-ag-${s.chave}`}>
            <CardHeader id={`h-ag-${s.chave}`} titulo={<span className="inline-flex items-center gap-2">{s.titulo}<Pill tom={s.tom}><span className="mono">{grupos[s.chave].length}</span></Pill></span>} sub={s.sub} />
            <ul className="m-0 p-0 list-none flex flex-col">
              {grupos[s.chave].map((a) => {
                const I = ICONE_TIPO[a.tipo] ?? ClipboardList;
                const o = a.oportunidade ?? (a.oportunidadeId ? opPorId.get(a.oportunidadeId) : undefined);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 border-t border-border first:border-0">
                    <span className="size-9 rounded-control bg-surface-3 grid place-items-center flex-none"><I className="size-4 text-ink-2" aria-label={ROTULO_TIPO[a.tipo]} /></span>
                    <span className="flex-[1_1_200px] min-w-0 flex flex-col">
                      <strong className="font-semibold">{a.assunto}</strong>
                      <span className="text-caption text-ink-2 truncate">{[ROTULO_TIPO[a.tipo], o?.titulo, a.cliente?.nome].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`mono text-[13px] ${s.chave === 'atrasadas' ? 'text-bad font-semibold' : 'text-ink-2'}`}>{comHora(a.data)}</span>
                    {podeEditar && <Button tamanho="sm" icone={CheckCircle2} onClick={() => setConcluindo(a)} aria-label={`Concluir ${a.assunto}`}>Concluir</Button>}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      <ConcluirAtividade ativ={concluindo} onFechar={() => setConcluindo(null)} />
      <NovaAtividade aberta={nova} onFechar={() => setNova(false)} oportunidades={oportunidades} />
    </div>
  );
}

function ConcluirAtividade({ ativ, onFechar }: { ativ: Atividade | null; onFechar: () => void }) {
  const [f, setF] = useState({ resultado: '', proximo: true, tipo: 'LIGACAO' as TipoAtividade, data: quando(3), assunto: '' });
  const [tentou, setTentou] = useState(false);
  useEffect(() => { if (ativ) { setF({ resultado: '', proximo: true, tipo: 'LIGACAO', data: quando(3), assunto: '' }); setTentou(false); } }, [ativ]);
  const concluir = useAcao(
    () => api(`/crm/atividades/${ativ!.id}/concluir`, { method: 'POST', body: { resultado: f.resultado.trim(), proximoPasso: f.proximo ? { tipo: f.tipo, data: new Date(f.data).toISOString(), assunto: f.assunto.trim() } : undefined } }),
    { invalida: [['crm']], sucesso: f.proximo ? 'Feito. O próximo passo já está na agenda.' : 'Atividade concluída.', onSuccess: onFechar }
  );
  const invalido = !f.resultado.trim() || (f.proximo && (!f.assunto.trim() || !f.data));
  return (
    <Modal aberto={!!ativ} onFechar={onFechar} titulo="Concluir atividade"
      rodape={<><Button onClick={onFechar}>Voltar</Button><Button variante="primario" icone={CheckCircle2} carregando={concluir.isPending} onClick={() => { setTentou(true); if (!invalido) concluir.mutate(undefined); }}>Concluir</Button></>}>
      {ativ && <p className="m-0 text-ink-2 text-[14px]">{ROTULO_TIPO[ativ.tipo]}: <strong className="text-ink-1">{ativ.assunto}</strong></p>}
      <TextArea label="Como foi?" value={f.resultado} onChange={(resultado) => setF({ ...f, resultado })} hint={tentou && !f.resultado.trim() ? 'Anote o resultado, nem que seja "não atendeu".' : 'Ex.: pediu para rever o prazo de entrega.'} />
      <Toggle label="Marcar o próximo passo" descricao="Quem não tem data para voltar, esquece." value={f.proximo} onChange={(proximo) => setF({ ...f, proximo })} />
      {f.proximo && (
        <>
          <Segmented<TipoAtividade> label="Tipo" tamanho="sm" value={f.tipo} onChange={(tipo) => setF({ ...f, tipo })} opcoes={opcoesTipo} />
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
            <TextField label="Quando" type="datetime-local" mono value={f.data} onChange={(data) => setF({ ...f, data })} erro={tentou && !f.data ? 'Escolha a data.' : null} />
            <TextField label="Assunto" value={f.assunto} onChange={(assunto) => setF({ ...f, assunto })} placeholder="Confirmar o pedido" erro={tentou && f.proximo && !f.assunto.trim() ? 'Diga o que vai fazer.' : null} />
          </div>
        </>
      )}
    </Modal>
  );
}

function NovaAtividade({ aberta, onFechar, oportunidades }: { aberta: boolean; onFechar: () => void; oportunidades: Oportunidade[] }) {
  const { usuario } = useAuth();
  const clientes = useClientes();
  const inicial = () => ({ tipo: 'LIGACAO' as TipoAtividade, assunto: '', data: quando(1), oportunidadeId: '', clienteId: '', observacao: '' });
  const [f, setF] = useState(inicial);
  const [tentou, setTentou] = useState(false);
  useEffect(() => { if (aberta) { setF(inicial()); setTentou(false); } }, [aberta]);
  const op = oportunidades.find((o) => o.id === f.oportunidadeId);
  const criar = useAcao(
    () => api('/crm/atividades', { method: 'POST', body: {
      tipo: f.tipo, assunto: f.assunto.trim(), data: new Date(f.data).toISOString(), responsavelId: usuario?.id, oportunidadeId: f.oportunidadeId || undefined,
      clienteId: f.clienteId || op?.cliente?.id || op?.clienteId || undefined, orcamentoId: op?.orcamentoId ?? undefined, observacao: f.observacao.trim() || undefined
    } }),
    { invalida: [['crm']], sucesso: 'Atividade na agenda.', onSuccess: onFechar }
  );
  const invalido = !f.assunto.trim() || !f.data;
  return (
    <Modal aberto={aberta} onFechar={onFechar} titulo="Nova atividade"
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" icone={Plus} carregando={criar.isPending} onClick={() => { setTentou(true); if (!invalido) criar.mutate(undefined); }}>Agendar</Button></>}>
      <Segmented<TipoAtividade> label="Tipo" tamanho="sm" value={f.tipo} onChange={(tipo) => setF({ ...f, tipo })} opcoes={opcoesTipo} />
      <TextField label="Assunto" required value={f.assunto} onChange={(assunto) => setF({ ...f, assunto })} placeholder="Ligar para confirmar o desenho" erro={tentou && !f.assunto.trim() ? 'Diga o que vai fazer.' : null} />
      <TextField label="Quando" type="datetime-local" mono value={f.data} onChange={(data) => setF({ ...f, data })} erro={tentou && !f.data ? 'Escolha a data.' : null} />
      <SelectField label="Oportunidade" value={f.oportunidadeId} onChange={(oportunidadeId) => setF({ ...f, oportunidadeId })} vazio="Nenhuma" opcoes={oportunidades.filter((o) => !FINAIS.includes(o.etapa)).map((o) => ({ valor: o.id, rotulo: `${o.titulo} · ${nomeCliente(o)}` }))} />
      {!op && <SelectField label="Cliente" value={f.clienteId} onChange={(clienteId) => setF({ ...f, clienteId })} vazio="Nenhum" opcoes={comoLista(clientes.data).map((c) => ({ valor: c.id, rotulo: c.fantasia || c.nome }))} />}
      <TextArea label="Observação" value={f.observacao} onChange={(observacao) => setF({ ...f, observacao })} />
    </Modal>
  );
}

function Indicadores() {
  const [meses, setMeses] = useState<'3' | '6' | '12'>('6');
  const q = useQuery({ queryKey: ['crm', 'indicadores', meses], queryFn: () => api<Record<string, unknown>>('/crm/indicadores', { query: { meses } }) });
  const ind = useMemo(() => normalizarIndicadores(q.data), [q.data]);
  const maxPerda = Math.max(1, ...ind.perdas.map((p) => p.quantidade));
  const maxValor = Math.max(1, ...ind.perdas.map((p) => p.valor));
  const npsTom = ind.nps ? tomNps(ind.nps.valor) : null;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <Segmented<'3' | '6' | '12'> label="Período" tamanho="sm" value={meses} onChange={setMeses} opcoes={[{ valor: '3', rotulo: '3 meses' }, { valor: '6', rotulo: '6 meses' }, { valor: '12', rotulo: '12 meses' }]} />
      {q.isLoading ? <Card><Carregando /></Card> : q.isError ? <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card> : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <Kpi rotulo="Ciclo médio" valor={ind.cicloDias === null ? '—' : `${num(ind.cicloDias, 0)} dias`} sub="do primeiro contato à decisão" tom="steel" icone={<CalendarClock className="size-5" aria-hidden />} />
            <Kpi rotulo="Preço aceito ÷ ofertado" valor={ind.precoAceito === null ? '—' : pct(ind.precoAceito, 0)} tom={ind.precoAceito === null ? 'steel' : ind.precoAceito >= 0.9 ? 'warn' : 'bad'}
              sub={ind.precoAceito === null ? 'sem perdas por preço no período' : `faltaram ${pct(Math.max(0, 1 - ind.precoAceito), 0)} para fechar`} icone={<ThumbsDown className="size-5" aria-hidden />} />
            <Kpi rotulo="NPS" valor={ind.nps === null ? '—' : <span className={npsTom === 'ok' ? 'text-ok' : npsTom === 'warn' ? 'text-warn' : 'text-bad'}>{ind.nps.valor > 0 ? '+' : ''}{num(ind.nps.valor, 0)}</span>}
              tom={npsTom ?? 'steel'} sub={ind.nps?.respostas ? `${num(ind.nps.respostas, 0)} respostas` : 'promotores menos detratores, em %'} icone={<MessageCircle className="size-5" aria-hidden />} />
          </div>
          {ind.precoAceito !== null && (
            <p className="m-0 text-[14px] text-ink-2 max-w-[760px]">
              Nas perdas por preço, o cliente aceitaria pagar em média <strong className="mono text-ink-1">{pct(ind.precoAceito, 0)}</strong> do que ofertamos.
              {ind.precoAceito >= 0.9 ? ' Perto: um ajuste pequeno de margem ou prazo teria fechado.' : ' Longe: vale rever o custo-hora ou o método antes de baixar margem.'}
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarrasConversao titulo="Conversão por vendedor" id="h-conv-vend" linhas={ind.porVendedor} />
            <BarrasConversao titulo="Conversão por segmento" id="h-conv-seg" linhas={ind.porSegmento.map((l) => ({ ...l, rotulo: SEGMENTO[l.rotulo as Segmento] ?? l.rotulo }))} />
          </div>
          <Card className="p-4 sm:p-5 flex flex-col gap-3" aria-labelledby="h-perdas">
            <CardHeader id="h-perdas" titulo="Por que perdemos" sub="Quantidade e valor das oportunidades perdidas no período." />
            {ind.perdas.length === 0 ? <p className="m-0 text-ink-2 text-[14px]">Nenhuma perda registrada no período.</p> : (
              <ul className="m-0 p-0 list-none flex flex-col gap-3">
                {ind.perdas.map((p) => (
                  <li key={p.motivo} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr] gap-x-4 gap-y-1 items-center">
                    <span className="font-medium">{MOTIVOS_PERDA[p.motivo as MotivoPerda] ?? p.motivo}</span>
                    <Barra frac={p.quantidade / maxPerda} tom="bg-bad" rotulo={<span className="mono">{plural(p.quantidade, 'perda', 'perdas')}</span>} />
                    <Barra frac={p.valor / maxValor} tom="bg-signal" rotulo={<span className="mono">{brl(p.valor)}</span>} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Barra({ frac, tom, rotulo }: { frac: number; tom: string; rotulo: ReactNode }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="flex-1 h-2.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden><span className={`block h-full rounded-full ${tom}`} style={{ width: `${Math.min(100, Math.max(0, frac * 100))}%` }} /></span>
      <span className="text-[13px] whitespace-nowrap">{rotulo}</span>
    </span>
  );
}

function BarrasConversao({ titulo, id, linhas }: { titulo: string; id: string; linhas: LinhaConversao[] }) {
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-3 min-w-0" aria-labelledby={id}>
      <CardHeader id={id} titulo={titulo} sub="Ganhas sobre as decididas no período." />
      {linhas.length === 0 ? <p className="m-0 text-ink-2 text-[14px]">Sem decisões no período.</p> : (
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {[...linhas].sort((a, b) => b.taxa - a.taxa).map((l) => (
            <li key={l.rotulo} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium truncate">{l.rotulo}</span>
                <span className="mono text-[13px] text-ink-2 whitespace-nowrap"><strong className="text-ink-1">{pct(l.taxa, 0)}</strong>{l.total ? ` · ${l.ganhos} de ${l.total}` : ''}</span>
              </span>
              <span className="h-2.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
                <span className={`block h-full rounded-full ${l.taxa >= 0.4 ? 'bg-ok' : l.taxa >= 0.2 ? 'bg-signal' : 'bg-bad'}`} style={{ width: `${Math.min(100, l.taxa * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
