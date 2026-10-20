import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, FileText, Play, Plus, Trash2, TriangleAlert, Wrench, XCircle } from 'lucide-react';
import { api, ApiError, msgErro } from '../../lib/api';
import type { Item } from '../../lib/types';
import { brl, data, horas, num, toNum } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { useColaboradores } from '../../lib/queries';
import { useToast } from '../../components/Toast';
import { Button, IconButton } from '../../components/Button';
import { NumberField, Segmented, SelectField, TextArea, TextField } from '../../components/Field';
import { ItemPicker } from '../../components/ItemPicker';
import { Modal } from '../../components/Modal';
import { Pill } from '../../components/Pill';
import { Carregando, ErroEstado } from '../../components/EmptyState';
import {
  checklistInicial, estaAberta, mensagemConflito, ORIGEM_ORDEM, rotuloStatusOrdem, TIPO_CUSTO, TIPO_ORDEM, tomStatusOrdem,
  type CustoOrdem, type ItemChecklist, type Ordem, type Plano, type TipoCusto
} from './manutencao';
import { INVAL_MANUTENCAO, useFornecedores, useOrdem } from './queries';

const dataHora = (iso?: string | null) => {
  if (!iso) return '—';
  if (iso.length <= 10) return data(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return data(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function StatusOrdemPill({ status }: { status: string }) {
  const I = status === 'CONCLUIDA' ? CheckCircle2 : status === 'CANCELADA' ? Ban : status === 'EM_EXECUCAO' ? Wrench : undefined;
  return <Pill tom={tomStatusOrdem(status)} icone={I}>{rotuloStatusOrdem(status)}</Pill>;
}

/** Mutação da ordem com o toast na voz dos conflitos de manutenção. */
function useAcaoOrdem<V>(fn: (v: V) => Promise<Ordem>, sucesso: string | ((r: Ordem) => string), depois?: (r: Ordem) => void) {
  const qc = useQueryClient();
  const toast = useToast();
  const [erro, setErro] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setErro(null),
    onSuccess: (r) => {
      INVAL_MANUTENCAO.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      qc.invalidateQueries({ queryKey: ['estoque'] });
      qc.invalidateQueries({ queryKey: ['itens'] });
      qc.invalidateQueries({ queryKey: ['financeiro'] });
      qc.invalidateQueries({ queryKey: ['ordens-servico'] });
      toast(typeof sucesso === 'function' ? sucesso(r) : sucesso, 'ok');
      depois?.(r);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? mensagemConflito(e.codigo, e.message) : msgErro(e);
      setErro(msg);
      toast(msg, 'bad');
    }
  });
  return { ...m, erro, limparErro: () => setErro(null) };
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col min-w-0">
      <dt className="text-caption text-ink-3">{rotulo}</dt>
      <dd className="m-0 text-[14px] break-words">{children}</dd>
    </div>
  );
}

/** Ficha da ordem de manutenção: execução, custos, conclusão com checklist e cancelamento. */
export function OrdemSheet({ id, planos, onFechar }: { id: string; planos?: Plano[]; onFechar: () => void }) {
  const q = useOrdem(id);
  const o = q.data;
  const pode = useAuth().pode('manutencao.gerenciar');
  const [modo, setModo] = useState<'detalhe' | 'concluir' | 'cancelar'>('detalhe');

  return (
    <Modal aberto onFechar={onFechar} largura={780} faixa={o?.tipo === 'CORRETIVA' && o.status === 'EM_EXECUCAO'}
      titulo={o ? <span className="flex flex-wrap items-center gap-2"><span className="mono">{o.numero}</span><StatusOrdemPill status={o.status} /></span> : 'Ordem de manutenção'}>
      {q.isLoading ? <Carregando linhas={4} rotulo="Carregando a ordem" /> : q.isError || !o ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : modo === 'concluir' ? (
        <Concluir o={o} plano={planos?.find((p) => p.id === o.planoId)} onVoltar={() => setModo('detalhe')} />
      ) : modo === 'cancelar' ? (
        <Cancelar o={o} onVoltar={() => setModo('detalhe')} />
      ) : (
        <Detalhe o={o} pode={pode} onConcluir={() => setModo('concluir')} onCancelar={() => setModo('cancelar')} />
      )}
    </Modal>
  );
}

function Detalhe({ o, pode, onConcluir, onCancelar }: { o: Ordem; pode: boolean; onConcluir: () => void; onCancelar: () => void }) {
  const aberta = estaAberta(o);
  const iniciar = useAcaoOrdem(() => api<Ordem>(`/manutencao/ordens/${o.id}/iniciar`, { method: 'POST' }), `${o.numero} em execução. Bom trabalho.`);
  const remover = useAcaoOrdem((custoId: string) => api<Ordem>(`/manutencao/ordens/${o.id}/custos/${custoId}`, { method: 'DELETE' }), 'Custo removido. Peça voltou ao estoque e título cancelado, quando havia.');
  const [confirmarRemover, setConfirmarRemover] = useState<CustoOrdem | null>(null);
  const checklist = checklistInicial(o.checklist);
  const afetadas = Array.isArray(o.osAfetadas) ? o.osAfetadas : [];

  return (
    <>
      <p className="m-0 text-[16px] font-medium">{o.descricao}</p>
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-field bg-surface-2">
        <Linha rotulo="Centro">{o.centroNome ? <Link to={`/centros-trabalho/${o.centroId}`}>{o.centroNome}</Link> : '—'}</Linha>
        <Linha rotulo="Tipo">{TIPO_ORDEM[o.tipo] ?? o.tipo} <span className="text-ink-3">· {ORIGEM_ORDEM[o.origem] ?? o.origem}</span></Linha>
        <Linha rotulo="Execução">{o.execucao === 'EXTERNA' ? `Externa${o.fornecedorNome ? ` · ${o.fornecedorNome}` : ''}` : 'Interna'}</Linha>
        <Linha rotulo="Prevista"><span className="mono">{data(o.prevista)}</span>{o.bloqueiaAgenda && <span className="block text-caption text-ink-3">bloqueia a agenda</span>}</Linha>
        <Linha rotulo="Início"><span className="mono">{dataHora(o.inicio)}</span></Linha>
        <Linha rotulo="Fim"><span className="mono">{dataHora(o.fim)}</span></Linha>
        <Linha rotulo="Horas parado"><span className="mono">{o.horasParado != null ? horas(o.horasParado, 1) : '—'}</span></Linha>
        <Linha rotulo="Custo total"><strong className="mono">{brl(o.custoTotal)}</strong></Linha>
      </dl>

      {afetadas.length > 0 && (
        <div className="flex flex-col gap-1.5 p-3 rounded-field bg-warn-soft">
          <span className="text-[14px] font-semibold flex items-center gap-2"><TriangleAlert className="size-4 text-warn" aria-hidden /> OS pausadas por esta quebra</span>
          <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
            {afetadas.map((a) => <li key={a.id}><Link to={`/ordens-servico/${a.id}`} className="mono font-medium">{a.numero}</Link></li>)}
          </ul>
          <span className="text-caption text-ink-2">Retome cada OS na ficha dela quando o centro voltar a produzir.</span>
        </div>
      )}

      {o.status === 'CANCELADA' && o.motivoCancelamento && <p className="m-0 p-3 rounded-field bg-surface-2 text-[14px]"><strong>Motivo do cancelamento:</strong> {o.motivoCancelamento}</p>}
      {o.status === 'CONCLUIDA' && (checklist.length > 0 || o.observacao) && (
        <section aria-label="Conclusão" className="flex flex-col gap-2">
          <h3 className="m-0 text-[16px] font-semibold">Como foi concluída</h3>
          {checklist.length > 0 && (
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-[14px]">
                  {c.ok ? <CheckCircle2 className="size-4 text-ok" aria-label="feito" /> : <XCircle className="size-4 text-bad" aria-label="não feito" />} {c.item}
                </li>
              ))}
            </ul>
          )}
          {o.observacao && <p className="m-0 text-[14px] text-ink-2">{o.observacao}</p>}
        </section>
      )}

      <section aria-labelledby={`custos-${o.id}`} className="flex flex-col gap-2">
        <h3 id={`custos-${o.id}`} className="m-0 text-[16px] font-semibold">Custos</h3>
        <p className="m-0 text-caption text-ink-3">Tudo entra como custo direto do centro, no componente manutenção.</p>
        {o.custos.length === 0 ? (
          <p className="m-0 text-[14px] text-ink-2">Nenhum custo lançado ainda.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {o.custos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-t border-border first:border-t-0">
                <span className="flex-[1_1_220px] min-w-0 flex flex-col">
                  <span className="text-caption text-ink-3">{TIPO_CUSTO[c.tipo] ?? c.tipo}{c.data && <span className="mono"> · {data(c.data)}</span>}</span>
                  <span className="text-[14px] break-words">
                    {c.descricao ?? '—'}
                    {c.quantidade && <span className="mono text-ink-2"> · {num(c.quantidade, 2)} {(c as { unidade?: string }).unidade ?? ''}</span>}
                    {c.horas && <span className="mono text-ink-2"> · {horas(c.horas, 1)}</span>}
                  </span>
                  {c.tituloId && (
                    <Link to={`/financeiro/pagar?titulo=${c.tituloId}`} className="text-caption inline-flex items-center gap-1 self-start"><FileText className="size-3.5" aria-hidden />Ver o título a pagar</Link>
                  )}
                </span>
                <span className="mono font-semibold">{brl(c.valor)}</span>
                {pode && o.status !== 'CANCELADA' && (
                  <IconButton icone={Trash2} rotulo={`Remover ${c.descricao ?? 'custo'}`} onClick={() => setConfirmarRemover(c)} />
                )}
              </li>
            ))}
          </ul>
        )}
        {confirmarRemover && (
          <div role="alertdialog" aria-label="Confirmar remoção do custo" className="flex flex-col gap-2 p-3 rounded-field bg-bad-soft">
            <span className="text-[14px]">
              Remover <strong>{confirmarRemover.descricao}</strong> ({brl(confirmarRemover.valor)})?
              {confirmarRemover.tipo === 'PECA' && ' A peça volta ao estoque.'}
              {confirmarRemover.tituloId && ' O título a pagar é cancelado.'}
            </span>
            {remover.erro && <span role="alert" className="text-[13.5px] font-medium text-bad">{remover.erro}</span>}
            <div className="flex flex-wrap gap-2">
              <Button tamanho="sm" onClick={() => { setConfirmarRemover(null); remover.limparErro(); }}>Manter</Button>
              <Button tamanho="sm" variante="perigo" icone={Trash2} carregando={remover.isPending} onClick={() => remover.mutate(confirmarRemover.id, { onSuccess: () => setConfirmarRemover(null) })}>Remover custo</Button>
            </div>
          </div>
        )}
        {pode && o.status !== 'CANCELADA' && <NovoCusto o={o} />}
      </section>

      {pode && aberta && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
          {o.status === 'ABERTA' && <Button variante="primario" icone={Play} carregando={iniciar.isPending} onClick={() => iniciar.mutate(undefined)}>Iniciar</Button>}
          <Button variante={o.status === 'EM_EXECUCAO' ? 'primario' : 'secundario'} icone={CheckCircle2} onClick={onConcluir}>Concluir</Button>
          <Button variante="perigo" icone={Ban} onClick={onCancelar} className="ml-auto">Cancelar ordem</Button>
        </div>
      )}
    </>
  );
}

function NovoCusto({ o }: { o: Ordem }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoCusto>('PECA');
  const [f, setF] = useState({ itemId: '', quantidade: '1', colaboradorId: '', horas: '', fornecedorId: o.fornecedorId ?? '', valor: '', vencimento: '', descricao: '' });
  const [item, setItem] = useState<Item | undefined>();
  const [tentou, setTentou] = useState(false);
  const colabs = useColaboradores();
  const forn = useFornecedores(aberto && tipo === 'TERCEIRO');
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const disponivel = item ? toNum(item.saldo?.disponivel) : null;
  const erro =
    tipo === 'PECA' ? (!f.itemId ? 'Escolha a peça.' : toNum(f.quantidade) <= 0 ? 'Informe a quantidade.' : disponivel !== null && toNum(f.quantidade) > disponivel ? `Só há ${num(disponivel, 2)} ${item?.unidadeConsumo ?? ''} disponível.` : null)
      : tipo === 'MAO_DE_OBRA' ? (!f.colaboradorId ? 'Escolha quem trabalhou.' : toNum(f.horas) <= 0 ? 'Informe as horas.' : null)
        : toNum(f.valor) <= 0 ? 'Informe o valor do serviço.' : null;
  const incluir = useAcaoOrdem(
    () => {
      const d = f.descricao.trim() || undefined;
      const body =
        tipo === 'PECA' ? { tipo, itemId: f.itemId, quantidade: f.quantidade, descricao: d }
          : tipo === 'MAO_DE_OBRA' ? { tipo, colaboradorId: f.colaboradorId, horas: f.horas, descricao: d }
            : { tipo, fornecedorId: f.fornecedorId || undefined, valor: f.valor, vencimento: f.vencimento || undefined, descricao: d };
      return api<Ordem>(`/manutencao/ordens/${o.id}/custos`, { method: 'POST', body });
    },
    tipo === 'PECA' ? 'Peça baixada do estoque pelo custo médio.' : tipo === 'MAO_DE_OBRA' ? 'Mão de obra lançada pelo custo-hora do colaborador.' : f.fornecedorId ? 'Serviço lançado e título a pagar criado.' : 'Serviço lançado.',
    () => { setF({ ...f, itemId: '', quantidade: '1', colaboradorId: '', horas: '', valor: '', vencimento: '', descricao: '' }); setItem(undefined); setTentou(false); setAberto(false); }
  );
  if (!aberto) return <Button tamanho="sm" icone={Plus} className="self-start" onClick={() => setAberto(true)}>Lançar custo</Button>;
  const colab = colabs.data?.itens.find((c) => c.id === f.colaboradorId);

  return (
    <form className="flex flex-col gap-3 p-3 rounded-field border border-border bg-surface-2" onSubmit={(e) => { e.preventDefault(); setTentou(true); if (!erro) incluir.mutate(undefined); }} noValidate>
      <Segmented<TipoCusto> label="Tipo de custo" tamanho="sm" value={tipo} onChange={(v) => { setTipo(v); setTentou(false); }} opcoes={(Object.keys(TIPO_CUSTO) as TipoCusto[]).map((t) => ({ valor: t, rotulo: TIPO_CUSTO[t] }))} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tipo === 'PECA' && (
          <>
            <div className="sm:col-span-2 flex flex-col gap-1.5 min-w-0">
              <span className="text-[13.5px] font-medium text-ink-2" id={`peca-${o.id}`}>Peça do estoque</span>
              <ItemPicker value={f.itemId} onChange={(id, it) => { setF({ ...f, itemId: id }); setItem(it); }} rotulo="Peça do estoque" invalido={tentou && !f.itemId} />
              <span className="text-caption text-ink-3">Mostra o disponível e o custo médio. A baixa sai do local com saldo.</span>
            </div>
            <NumberField label="Quantidade" sufixo={item?.unidadeConsumo} value={f.quantidade} onChange={set('quantidade')} hint={item ? `Custo ${brl(toNum(item.custoMedio) * toNum(f.quantidade))}` : undefined} />
          </>
        )}
        {tipo === 'MAO_DE_OBRA' && (
          <>
            <SelectField className="sm:col-span-2" label="Colaborador" value={f.colaboradorId} onChange={set('colaboradorId')} vazio={colabs.isLoading ? 'Carregando…' : 'Escolha quem trabalhou'}
              opcoes={(colabs.data?.itens ?? []).filter((c) => c.ativo).map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${c.funcao}` }))}
              hint={colab?.custoHora ? `Custo-hora ${brl(colab.custoHora)}` : 'Valor pelo custo-hora do colaborador no mês.'} />
            <NumberField label="Horas" sufixo="h" value={f.horas} onChange={set('horas')} hint={colab?.custoHora && toNum(f.horas) > 0 ? `≈ ${brl(toNum(colab.custoHora) * toNum(f.horas))}` : undefined} />
          </>
        )}
        {tipo === 'TERCEIRO' && (
          <>
            <SelectField label="Fornecedor" value={f.fornecedorId} onChange={set('fornecedorId')} vazio={forn.isLoading ? 'Carregando…' : 'Sem fornecedor'}
              opcoes={(forn.data ?? []).map((x) => ({ valor: x.id, rotulo: x.fantasia || x.nome }))} hint="Com fornecedor, gera o título a pagar." />
            <NumberField label="Valor" prefixo="R$" value={f.valor} onChange={set('valor')} />
            <TextField label="Vencimento" type="date" value={f.vencimento} onChange={set('vencimento')} hint="Vazio usa a condição do fornecedor." />
          </>
        )}
        <TextField className="sm:col-span-3" label="Descrição (opcional)" value={f.descricao} onChange={set('descricao')} placeholder={tipo === 'TERCEIRO' ? 'Retífica do spindle' : ''} />
      </div>
      {tentou && erro && <span role="alert" className="text-[13.5px] font-medium text-bad">{erro}</span>}
      {incluir.erro && <span role="alert" className="text-[13.5px] font-medium text-bad">{incluir.erro}</span>}
      <div className="flex flex-wrap gap-2">
        <Button tamanho="sm" onClick={() => setAberto(false)}>Fechar</Button>
        <Button tamanho="sm" type="submit" variante="primario" icone={Plus} carregando={incluir.isPending}>Lançar</Button>
      </div>
    </form>
  );
}

function Concluir({ o, plano, onVoltar }: { o: Ordem; plano?: Plano; onVoltar: () => void }) {
  const [itens, setItens] = useState<ItemChecklist[]>(() => checklistInicial(o.checklist, plano?.checklist ?? []));
  const [observacao, setObservacao] = useState(o.observacao ?? '');
  const [horasParado, setHorasParado] = useState(o.horasParado ?? '');
  const pendentes = itens.filter((i) => !i.ok).length;
  const concluir = useAcaoOrdem(
    () => api<Ordem>(`/manutencao/ordens/${o.id}/concluir`, { method: 'POST', body: { checklist: itens, observacao: observacao.trim() || undefined, horasParado: horasParado === '' ? undefined : horasParado } }),
    o.planoId ? `${o.numero} concluída. O contador do plano voltou a zero.` : `${o.numero} concluída.${o.paradaId ? ' A parada do centro foi fechada.' : ''}`,
    onVoltar
  );
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); concluir.mutate(undefined); }}>
      <h3 className="m-0 text-[18px] font-semibold">Concluir {o.numero}</h3>
      {itens.length > 0 ? (
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-1.5">
          <legend className="text-[13.5px] font-medium text-ink-2 mb-1.5">Checklist</legend>
          {itens.map((it, i) => (
            <label key={i} className="flex items-center gap-3 p-2.5 rounded-field bg-surface-2 border border-border cursor-pointer">
              <input type="checkbox" className="size-5 accent-[var(--pm-ok)]" checked={it.ok} onChange={(e) => setItens(itens.map((x, j) => (j === i ? { ...x, ok: e.target.checked } : x)))} />
              <span className={`text-[14px] ${it.ok ? 'text-ink-2' : ''}`}>{it.item}</span>
            </label>
          ))}
          {pendentes > 0 && <span className="text-caption text-warn font-medium">{pendentes} item(ns) sem marcar. Dá para concluir assim; fica registrado o que não foi feito.</span>}
        </fieldset>
      ) : <p className="m-0 text-[14px] text-ink-2">Esta ordem não tem checklist.</p>}
      <TextArea label="Observação" value={observacao} onChange={setObservacao} hint="O que foi feito, peça trocada, o que acompanhar." />
      <div className="max-w-[240px]">
        <NumberField label="Horas parado" sufixo="h" value={horasParado} onChange={setHorasParado}
          hint={o.tipo === 'CORRETIVA' ? 'Vazio calcula do início da quebra até agora.' : 'Quanto o centro ficou sem produzir.'} />
      </div>
      {concluir.erro && <span role="alert" className="text-[13.5px] font-medium text-bad">{concluir.erro}</span>}
      <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-border">
        <Button onClick={onVoltar}>Voltar</Button>
        <Button type="submit" variante="primario" icone={CheckCircle2} carregando={concluir.isPending}>Concluir ordem</Button>
      </div>
    </form>
  );
}

function Cancelar({ o, onVoltar }: { o: Ordem; onVoltar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const comCustos = o.custos.some((c) => c.tipo === 'PECA' || c.tituloId);
  const cancelar = useAcaoOrdem(() => api<Ordem>(`/manutencao/ordens/${o.id}/cancelar`, { method: 'POST', body: { motivo: motivo.trim() } }), `${o.numero} cancelada.`, onVoltar);
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setTentou(true); if (motivo.trim()) cancelar.mutate(undefined); }}>
      <h3 className="m-0 text-[18px] font-semibold">Cancelar {o.numero}?</h3>
      {comCustos && (
        <p className="m-0 p-3 rounded-field bg-warn-soft text-[14px]">Esta ordem tem peça baixada ou serviço de terceiro. Remova esses custos antes: a peça volta ao estoque e o título é cancelado.</p>
      )}
      <TextArea label="Motivo" value={motivo} onChange={setMotivo} hint={tentou && !motivo.trim() ? 'Conte por que a ordem não vai mais acontecer.' : 'Fica no histórico da ordem.'} />
      {o.paradaId && <p className="m-0 text-caption text-ink-3">A parada programada do centro é desfeita.</p>}
      {cancelar.erro && <span role="alert" className="text-[13.5px] font-medium text-bad">{cancelar.erro}</span>}
      <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-border">
        <Button onClick={onVoltar}>Voltar</Button>
        <Button type="submit" variante="perigo" icone={Ban} carregando={cancelar.isPending}>Cancelar ordem</Button>
      </div>
    </form>
  );
}

