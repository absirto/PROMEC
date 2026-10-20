import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCheck, CircleDollarSign, Clock, Handshake, Plus, Undo2 } from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { CentroCusto, Cliente, ContaFin, Fornecedor, Lista, ListaTitulos, StatusTitulo, TipoTitulo, Titulo } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, data, num, toNum } from '../lib/format';
import { useAcao, useCentros, useParametros } from '../lib/queries';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { NumberField, Segmented, Select, SelectField, TextArea, TextField } from '../components/Field';
import { Busca, FiltroChips } from '../components/DataTable';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill, type Tom } from '../components/Pill';
import { Modal } from '../components/Modal';
import { HistoricoLink } from '../components/HistoricoLink';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { useToast } from '../components/Toast';
import { encargosNaData, previaBaixa, previaParcelas } from '../features/financeiro/fin';
import { useTitulo } from '../layout/titulo';

const lista = <T,>(x: T[] | Lista<T> | undefined | null): T[] => (Array.isArray(x) ? x : x?.itens ?? []);
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const STATUS: Record<StatusTitulo, [string, Tom]> = { ABERTO: ['Aberto', 'info'], PARCIAL: ['Parcial', 'warn'], PAGO: ['Pago', 'ok'], CANCELADO: ['Cancelado', 'neutral'], RENEGOCIADO: ['Renegociado', 'run'] };
const vencido = (t: Titulo) => (t as Titulo & { vencido?: boolean }).vencido ?? (t.diasAtraso > 0 && toNum(t.saldo) > 0 && (t.status === 'ABERTO' || t.status === 'PARCIAL'));
const COMPONENTE: Record<string, string> = { manutencao: 'manutenção', insumos: 'insumos', energia: 'energia', outros: 'outros' };

export function StatusTitulo({ t }: { t: Titulo }) {
  if (vencido(t)) return <Pill tom="bad" icone={AlertTriangle}>Vencido · {t.diasAtraso} {t.diasAtraso === 1 ? 'dia' : 'dias'}</Pill>;
  const [r, tom] = STATUS[t.status] ?? [t.status, 'neutral'];
  return <Pill tom={tom} className={t.status === 'CANCELADO' ? 'line-through' : ''}>{r}</Pill>;
}

function origemLink(t: Titulo) {
  const o = t.origem;
  if (!o) return null;
  const to = o.tipo === 'OS' && o.id ? `/ordens-servico/${o.id}` : o.tipo.startsWith('PEDIDO') && o.id ? `/compras/pedidos/${o.id}` : o.tipo === 'RECEBIMENTO' ? '/compras?aba=pedidos' : o.tipo === 'RECORRENCIA' ? '/financeiro/recorrencias' : o.tipo === 'COMISSAO' ? '/financeiro/comissoes' : null;
  const rot = o.numero ?? o.tipo.toLowerCase();
  return to ? <Link to={to} className="mono">{rot}</Link> : <span className="mono">{rot}</span>;
}

type Filtro = 'abertos' | 'VENCIDO' | 'PAGO' | 'todos' | 'CANCELADO' | 'RENEGOCIADO';

export default function Titulos({ tipo }: { tipo: TipoTitulo }) {
  const { pode: podeFn_ } = useAuth();
  const podeGerir = podeFn_('financeiro.gerenciar');
  const receber = tipo === 'RECEBER';
  useTitulo(receber ? 'Contas a receber' : 'Contas a pagar');
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [comp, setComp] = useState<string | null>(null);
  const [centroCustoId, setCC] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sp] = useSearchParams();
  const [aberto, setAberto] = useState<string | null>(sp.get('titulo'));
  const [novo, setNovo] = useState(false);
  const [lote, setLote] = useState(false);
  const params = useParametros();
  const p = params.data as (typeof params.data & { multaAtraso?: string; jurosMes?: string }) | undefined;
  const ccs = useQuery({ queryKey: ['financeiro', 'centros-custo'], queryFn: () => api<CentroCusto[] | Lista<CentroCusto>>('/financeiro/centros-custo'), select: lista });
  const centros = useCentros();
  const nomeCentro = (id?: string) => centros.data?.itens.find((c) => c.id === id)?.nome ?? 'centro';

  const q = useQuery({
    queryKey: ['financeiro', 'titulos', tipo, filtro, busca.trim(), de, ate, comp],
    queryFn: () => api<ListaTitulos>('/financeiro/titulos', {
      query: {
        tipo, q: busca.trim(), vencimentoDe: de, vencimentoAte: ate, competencia: comp ?? undefined,
        status: filtro === 'VENCIDO' || filtro === 'PAGO' || filtro === 'CANCELADO' || filtro === 'RENEGOCIADO' ? filtro : undefined
      }
    }),
    placeholderData: (x) => x
  });
  const todos = q.data?.itens ?? [];
  const itens = todos.filter((t) => (filtro !== 'abertos' || t.status === 'ABERTO' || t.status === 'PARCIAL') && (!centroCustoId || t.centroCusto?.id === centroCustoId));
  const tot = q.data?.totais;
  const hj = hoje();
  const selecionados = itens.filter((t) => sel.has(t.id));
  const totalSel = selecionados.reduce((a, t) => a + toNum(previaBaixa({ saldo: t.saldo, vencimento: t.vencimento, dataPagamento: hj, multa: p?.multaAtraso, jurosMes: p?.jurosMes }).devidoTotal), 0);
  const marcaveis = itens.filter((t) => t.status === 'ABERTO' || t.status === 'PARCIAL');
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo={receber ? 'Contas a receber' : 'Contas a pagar'}
        texto={receber ? 'O que os clientes devem, parcela por parcela. Vencido há mais tempo bloqueia o cliente sozinho.' : 'O que a oficina deve. Cada título mostra se compõe o custo fixo ou o custo direto de uma máquina.'}
        acoes={podeGerir && <Button variante="primario" icone={Plus} onClick={() => setNovo(true)}>Novo lançamento</Button>}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Em aberto" valor={tot ? brl(tot.aberto) : '—'} sub={receber ? 'a receber' : 'a pagar'} />
          <HeroKpi rotulo="Vencido" valor={tot ? brl(tot.vencido) : '—'} sub={receber ? 'cobrar hoje' : 'pagar com encargos'} />
          <HeroKpi rotulo={receber ? 'Recebido no período' : 'Pago no período'} valor={tot ? brl(tot.pagoNoPeriodo) : '—'} />
        </div>
      </HeroBand>

      <Card className="overflow-hidden" aria-label={receber ? 'Títulos a receber' : 'Títulos a pagar'}>
        <div className="px-4 py-3.5 flex flex-col gap-2.5 border-b border-border">
          <div className="flex flex-wrap gap-2.5 items-center">
            <Busca valor={busca} onChange={setBusca} placeholder={receber ? 'Número, cliente, OS ou nota' : 'Número, fornecedor, pedido ou nota'} />
            <FiltroChips<Filtro> rotulo="Situação" valor={filtro} onChange={(v) => { setFiltro(v); setSel(new Set()); }} opcoes={[
              { valor: 'abertos', rotulo: 'Em aberto' }, { valor: 'VENCIDO', rotulo: 'Vencidos' }, { valor: 'PAGO', rotulo: receber ? 'Recebidos' : 'Pagos' },
              { valor: 'RENEGOCIADO', rotulo: 'Renegociados' }, { valor: 'CANCELADO', rotulo: 'Cancelados' }, { valor: 'todos', rotulo: 'Todos' }
            ]} />
          </div>
          <div className="flex flex-wrap gap-2.5 items-end">
            <TextField label="Vence de" type="date" mono value={de} onChange={setDe} className="w-[170px]" />
            <TextField label="até" type="date" mono value={ate} onChange={setAte} className="w-[170px]" />
            <label className="flex flex-col gap-1.5 min-w-0 flex-[1_1_200px] max-w-[300px]">
              <span className="text-[13.5px] font-medium text-ink-2">Centro de custo</span>
              <Select value={centroCustoId} onChange={setCC} vazio="Todos" opcoes={(ccs.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-ink-2">Competência</span>
              <div className="flex items-center gap-2">
                {comp ? <CompetenciaPicker valor={comp} onChange={setComp} /> : <Button tamanho="sm" onClick={() => setComp(competenciaAtual())}>Filtrar por mês</Button>}
                {comp && <Button tamanho="sm" variante="terciario" onClick={() => setComp(null)}>Todas</Button>}
              </div>
            </div>
          </div>
        </div>
        {selecionados.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-ink-1 text-surface-1" role="region" aria-label="Baixa em lote">
            <span className="font-semibold">{selecionados.length} {selecionados.length === 1 ? 'selecionado' : 'selecionados'} · <span className="mono">{brl(totalSel)}</span> com encargos de hoje</span>
            <span className="flex-1" />
            <Button tamanho="sm" icone={CheckCheck} onClick={() => setLote(true)}>{receber ? 'Receber em lote' : 'Pagar em lote'}</Button>
            <Button tamanho="sm" variante="terciario" className="!text-surface-1" onClick={() => setSel(new Set())}>Limpar</Button>
          </div>
        )}
        {q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : itens.length === 0 ? (
          <EmptyState ilustracao="prancheta" titulo="Nada por aqui com esse filtro" texto={receber ? 'Títulos a receber nascem na entrega da OS. Para um recebimento avulso, use o novo lançamento.' : 'Títulos a pagar nascem no recebimento de compra e nas recorrências. Para uma conta avulsa, use o novo lançamento.'} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="rt" aria-label="Títulos">
              <thead>
                <tr>
                  <th scope="col" className="w-10">
                    <input type="checkbox" aria-label="Selecionar todos em aberto" className="size-4 accent-[var(--pm-primary)]" checked={marcaveis.length > 0 && marcaveis.every((t) => sel.has(t.id))}
                      onChange={(e) => setSel(e.target.checked ? new Set(marcaveis.map((t) => t.id)) : new Set())} />
                  </th>
                  <th scope="col">Título</th><th scope="col">{receber ? 'Cliente' : 'Fornecedor'}</th><th scope="col">Vencimento</th><th scope="col">Centro de custo</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Valor</th><th scope="col" style={{ textAlign: 'right' }}>Saldo</th><th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((t) => {
                  const enc = vencido(t) ? encargosNaData({ saldo: t.saldo, vencimento: t.vencimento, dataPagamento: hj, multa: p?.multaAtraso, jurosMes: p?.jurosMes }) : null;
                  const marcavel = t.status === 'ABERTO' || t.status === 'PARCIAL';
                  return (
                    <tr key={t.id} data-link="true" onClick={(e) => { if (!(e.target as HTMLElement).closest('input,a,button')) setAberto(t.id); }}>
                      <td data-l="Selecionar">{marcavel && <input type="checkbox" className="size-4 accent-[var(--pm-primary)]" aria-label={`Selecionar ${t.numero}`} checked={sel.has(t.id)} onChange={() => toggle(t.id)} />}</td>
                      <td data-principal>
                        <button type="button" onClick={() => setAberto(t.id)} className="text-left flex flex-col">
                          <span className="mono text-caption text-ink-3">{t.numero}{t.parcela ? ` · ${t.parcela}` : ''}</span>
                          <span className="font-semibold">{t.descricao}</span>
                        </button>
                      </td>
                      <td data-l={receber ? 'Cliente' : 'Fornecedor'}>{t.pessoa?.nome ?? '—'}</td>
                      <td data-l="Vencimento" className="mono">
                        <span className={vencido(t) ? 'text-bad font-semibold' : ''}>{data(t.vencimento)}</span>
                        {enc && <span className="block text-caption text-bad">+{brl(toNum(enc.multa) + toNum(enc.juros))} hoje</span>}
                      </td>
                      <td data-l="Centro de custo">
                        <span className="flex flex-col gap-1 items-start">
                          <span>{t.centroCusto?.nome ?? '—'}</span>
                          <span className="flex flex-wrap gap-1">
                            {t.compoeCustoFixo && <Pill tom="steel">compõe custo fixo</Pill>}
                            {t.custoDiretoCentro && <Pill tom="primary">custo direto · {t.custoDiretoCentro.centroNome ?? nomeCentro(t.custoDiretoCentro.centroTrabalhoId)}</Pill>}
                          </span>
                        </span>
                      </td>
                      <td data-l="Valor" className="mono" style={{ textAlign: 'right' }}>{brl(t.valor)}</td>
                      <td data-l="Saldo" className="mono font-semibold" style={{ textAlign: 'right' }}>{brl(t.saldo)}</td>
                      <td data-l="Situação"><StatusTitulo t={t} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {itens.length > 0 && <div className="px-4 py-3 text-[13.5px] text-ink-2 border-t border-border">{itens.length} títulos · saldo <strong className="mono">{brl(itens.reduce((a, t) => a + toNum(t.saldo), 0))}</strong></div>}
      </Card>

      {aberto && <Detalhe id={aberto} tipo={tipo} onFechar={() => setAberto(null)} />}
      {novo && <NovoLancamento tipo={tipo} ccs={ccs.data ?? []} onFechar={() => setNovo(false)} />}
      {lote && <BaixaLote tipo={tipo} titulos={selecionados} total={totalSel} onFechar={(ok) => { setLote(false); if (ok) setSel(new Set()); }} />}
    </>
  );
}

const useContas = () => useQuery({ queryKey: ['financeiro', 'contas'], queryFn: () => api<ContaFin[] | Lista<ContaFin>>('/financeiro/contas'), select: (d) => lista(d).filter((c) => c.ativa !== false) });
const INVAL = [['financeiro'], ['painel'], ['clientes']];

function BaixaLote({ tipo, titulos, onFechar }: { tipo: TipoTitulo; titulos: Titulo[]; total?: number; onFechar: (ok?: boolean) => void }) {
  const contas = useContas();
  const params = useParametros();
  const p = params.data as (typeof params.data & { multaAtraso?: string; jurosMes?: string }) | undefined;
  const [f, setF] = useState({ data: hoje(), contaId: '' });
  const total = titulos.reduce((a, t) => a + toNum(previaBaixa({ saldo: t.saldo, vencimento: t.vencimento, dataPagamento: f.data, multa: p?.multaAtraso, jurosMes: p?.jurosMes }).devidoTotal), 0);
  const baixar = useAcao(() => api('/financeiro/baixas-lote', { method: 'POST', body: { tituloIds: titulos.map((t) => t.id), data: f.data, contaId: f.contaId } }), {
    invalida: INVAL,
    sucesso: `${titulos.length} ${titulos.length === 1 ? 'título baixado' : 'títulos baixados'}. O saldo da conta já mudou.`,
    onSuccess: () => onFechar(true)
  });
  return (
    <Modal aberto onFechar={() => onFechar()} titulo={tipo === 'RECEBER' ? 'Receber em lote' : 'Pagar em lote'}
      rodape={<><Button onClick={() => onFechar()}>Voltar</Button><Button variante="primario" icone={CheckCheck} disabled={!f.contaId} carregando={baixar.isPending} onClick={() => baixar.mutate(undefined)}>Baixar {titulos.length}</Button></>}>
      <p className="m-0 text-ink-2 text-[14px]">Baixa total de cada título, com multa e juros calculados pela data. Valores parciais ficam para a baixa individual.</p>
      <ul className="m-0 p-0 list-none flex flex-col max-h-[220px] overflow-y-auto">
        {titulos.map((t) => <li key={t.id} className="flex justify-between gap-3 py-1.5 border-t border-border first:border-0 text-[14px]"><span className="truncate">{t.numero} · {t.pessoa?.nome}</span><span className="mono">{brl(t.saldo)}</span></li>)}
      </ul>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Data" type="date" mono value={f.data} onChange={(v) => setF({ ...f, data: v })} />
        <SelectField label="Conta" value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} vazio="Escolha a conta" opcoes={(contas.data ?? []).map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${brl(c.saldoAtual)}` }))} />
      </div>
      <p className="m-0 text-[14px]">Total com encargos em {data(f.data)}: <strong className="mono">{brl(total)}</strong></p>
    </Modal>
  );
}

function NovoLancamento({ tipo, ccs, onFechar }: { tipo: TipoTitulo; ccs: CentroCusto[]; onFechar: () => void }) {
  const receber = tipo === 'RECEBER';
  const pessoas = useQuery({
    queryKey: [receber ? 'clientes' : 'fornecedores', 'fin'],
    queryFn: () => api<Lista<Cliente | Fornecedor> | (Cliente | Fornecedor)[]>(receber ? '/clientes' : '/fornecedores'),
    select: lista
  });
  const [f, setF] = useState({ modo: 'cadastro' as 'cadastro' | 'avulso', pessoaId: '', nome: '', descricao: '', centroCustoId: '', competencia: competenciaAtual(), valor: '', condicao: '', dataBase: hoje(), vencimento: hoje(), documentoFiscal: '', observacao: '' });
  const [tentou, setTentou] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const prev = useMemo(() => previaParcelas(f.condicao, f.valor, f.dataBase), [f.condicao, f.valor, f.dataBase]);
  const salvar = useAcao(() => api('/financeiro/titulos', {
    method: 'POST',
    body: {
      tipo,
      pessoa: f.modo === 'avulso' ? { nome: f.nome.trim() } : receber ? { clienteId: f.pessoaId } : { fornecedorId: f.pessoaId },
      descricao: f.descricao.trim(), centroCustoId: f.centroCustoId, competencia: f.competencia, valor: String(toNum(f.valor)),
      ...(f.condicao.trim() ? { condicao: f.condicao.trim(), dataBase: f.dataBase } : { vencimento: f.vencimento }),
      documentoFiscal: f.documentoFiscal.trim() || undefined, observacao: f.observacao.trim() || undefined
    }
  }), { invalida: INVAL, sucesso: prev.parcelas.length > 1 ? `Lançado em ${prev.parcelas.length} parcelas.` : 'Lançado.', onSuccess: onFechar });
  const pessoaOk = f.modo === 'avulso' ? f.nome.trim() : f.pessoaId;
  const ok = pessoaOk && f.descricao.trim() && f.centroCustoId && toNum(f.valor) > 0 && !prev.erro;
  return (
    <Modal aberto onFechar={onFechar} largura={640} titulo={receber ? 'Novo título a receber' : 'Novo título a pagar'}
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" icone={Plus} carregando={salvar.isPending} onClick={() => { setTentou(true); if (ok) salvar.mutate(undefined); }}>Lançar</Button></>}>
      <Segmented<'cadastro' | 'avulso'> label={receber ? 'Cliente' : 'Fornecedor'} tamanho="sm" value={f.modo} onChange={(v) => set('modo', v)} opcoes={[{ valor: 'cadastro', rotulo: 'Cadastrado' }, { valor: 'avulso', rotulo: 'Avulso' }]} />
      {f.modo === 'cadastro'
        ? <SelectField label={receber ? 'Cliente' : 'Fornecedor'} value={f.pessoaId} onChange={(v) => set('pessoaId', v)} vazio="Escolha" opcoes={(pessoas.data ?? []).map((x) => ({ valor: x.id, rotulo: x.fantasia || x.nome }))} erro={tentou && !f.pessoaId ? 'De quem é?' : null} />
        : <TextField label="Nome" value={f.nome} onChange={(v) => set('nome', v)} erro={tentou && !f.nome.trim() ? 'De quem é?' : null} />}
      <TextField label="Descrição" value={f.descricao} onChange={(v) => set('descricao', v)} placeholder={receber ? 'Venda de sucata' : 'Conserto do compressor'} erro={tentou && !f.descricao.trim() ? 'Descreva o lançamento.' : null} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SelectField label="Centro de custo" value={f.centroCustoId} onChange={(v) => set('centroCustoId', v)} vazio="Escolha (obrigatório)" opcoes={ccs.map((c) => ({ valor: c.id, rotulo: `${c.nome}${c.compoeCustoFixo ? ' · custo fixo' : ''}` }))} erro={tentou && !f.centroCustoId ? 'Sem centro de custo a DRE não fecha.' : null} />
        <div className="flex flex-col gap-1.5"><span className="text-[13.5px] font-medium text-ink-2">Competência</span><CompetenciaPicker valor={f.competencia} onChange={(v) => set('competencia', v)} /></div>
        <NumberField label="Valor total" prefixo="R$" value={f.valor} onChange={(v) => set('valor', v)} erro={tentou && !(toNum(f.valor) > 0) ? 'Informe o valor.' : null} />
        <TextField label="Condição (opcional)" value={f.condicao} onChange={(v) => set('condicao', v)} placeholder="30/60/90 ou entrada + 30" erro={prev.erro} />
        {f.condicao.trim()
          ? <TextField label="Data base" type="date" mono value={f.dataBase} onChange={(v) => set('dataBase', v)} />
          : <TextField label="Vencimento" type="date" mono value={f.vencimento} onChange={(v) => set('vencimento', v)} />}
        <TextField label="Documento fiscal" mono value={f.documentoFiscal} onChange={(v) => set('documentoFiscal', v)} placeholder="NF 1234" />
      </div>
      {prev.parcelas.length > 0 && (
        <div className="p-3 rounded-field bg-steel-soft text-[14px]" aria-live="polite">
          <strong>{prev.parcelas.length === 1 ? '1 parcela' : `${prev.parcelas.length} parcelas`}</strong>
          <ul className="m-0 mt-1 p-0 list-none grid grid-cols-[auto_1fr_auto] gap-x-3 mono text-[13.5px]">
            {prev.parcelas.map((x) => <li key={x.numero} className="contents"><span>{x.numero}/{prev.parcelas.length}</span><span>{data(x.vencimento)}</span><span className="text-right">{brl(x.valor)}</span></li>)}
          </ul>
        </div>
      )}
      <TextArea label="Observação" value={f.observacao} onChange={(v) => set('observacao', v)} />
    </Modal>
  );
}

function Detalhe({ id, tipo, onFechar }: { id: string; tipo: TipoTitulo; onFechar: () => void }) {
  const receber = tipo === 'RECEBER';
  const { pode } = useAuth();
  const gestor = pode('financeiro.estornar');
  const gere = pode('financeiro.gerenciar');
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['financeiro', 'titulo', id], queryFn: () => api<Titulo>(`/financeiro/titulos/${id}`) });
  const [modo, setModo] = useState<null | 'baixa' | 'renegociar' | 'cancelar' | { estornar: string }>(null);
  const [motivo, setMotivo] = useState('');
  const t = q.data;
  const cancelar = useAcao(() => api(`/financeiro/titulos/${id}/cancelar`, { method: 'POST', body: { motivo: motivo.trim() } }), { invalida: INVAL, sucesso: 'Título cancelado. Fica no histórico.', onSuccess: onFechar });
  const estornar = async (baixaId: string) => {
    try {
      await api(`/financeiro/titulos/${id}/baixas/${baixaId}/estornar`, { method: 'POST', body: { motivo: motivo.trim() } });
      INVAL.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast('Baixa estornada. O saldo voltou para o título e a comissão gerada foi desfeita.', 'ok');
      setModo(null);
      setMotivo('');
    } catch (e) {
      toast(msgErro(e), 'bad');
    }
  };
  if (!t) return <Modal aberto onFechar={onFechar} titulo="Título">{q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : <Carregando linhas={3} />}</Modal>;
  const emAberto = t.status === 'ABERTO' || t.status === 'PARCIAL';
  const semBaixa = !(t.baixas ?? []).some((b) => !b.estornada);
  return (
    <>
      <Modal aberto={!modo} onFechar={onFechar} largura={720} titulo={<span>{t.numero}{t.parcela ? <span className="text-ink-3 text-[20px]"> · {t.parcela}</span> : null}</span>}
        rodape={
          <>
            {emAberto && gere && semBaixa && <Button variante="perigo" icone={Ban} onClick={() => { setMotivo(''); setModo('cancelar'); }}>Cancelar</Button>}
            {emAberto && gere && <Button icone={Handshake} onClick={() => setModo('renegociar')}>Renegociar</Button>}
            {emAberto && gere && <Button variante="primario" icone={CircleDollarSign} onClick={() => setModo('baixa')}>{receber ? 'Receber' : 'Pagar'}</Button>}
          </>
        }>
        <div className="flex flex-wrap gap-2 items-center"><StatusTitulo t={t} />{t.compoeCustoFixo && <Pill tom="steel">compõe custo fixo</Pill>}{t.custoDiretoCentro && <Pill tom="primary">custo direto · {COMPONENTE[t.custoDiretoCentro.componente] ?? t.custoDiretoCentro.componente}</Pill>}</div>
        <p className="m-0 text-[15px]"><strong>{t.descricao}</strong> · {t.pessoa?.nome}</p>
        <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[['Valor', brl(t.valor)], ['Pago', brl(t.valorPago)], ['Saldo', brl(t.saldo)], ['Vencimento', data(t.vencimento)], ['Competência', competenciaLonga(t.competencia)], ['Centro de custo', t.centroCusto?.nome ?? '—'], ['Documento', t.documentoFiscal ?? '—'], ['Origem', origemLink(t) ?? 'manual']].map(([l, v]) => (
            <div key={l as string} className="p-2.5 rounded-field bg-surface-2 min-w-0"><dt className="text-caption text-ink-3">{l}</dt><dd className="m-0 mono text-[14px] font-semibold truncate">{v}</dd></div>
          ))}
        </dl>
        {t.encargosHoje && toNum(t.encargosHoje.multa) + toNum(t.encargosHoje.juros) > 0 && emAberto && (
          <p className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">Se {receber ? 'receber' : 'pagar'} hoje: <strong className="mono">{brl(t.encargosHoje.total)}</strong> ({t.encargosHoje.diasAtraso} dias de atraso · multa {brl(t.encargosHoje.multa)} · juros {brl(t.encargosHoje.juros)})</p>
        )}
        <div className="flex flex-col gap-1.5">
          <strong className="text-[14px]">Baixas</strong>
          {(t.baixas ?? []).length === 0 ? <span className="text-[14px] text-ink-3">Nenhuma ainda.</span> : (t.baixas ?? []).map((b) => (
            <div key={b.id} className={`flex flex-wrap items-center gap-3 p-2.5 rounded-field bg-surface-2 text-[14px] ${b.estornada ? 'opacity-60' : ''}`}>
              <span className="mono">{data(b.data)}</span>
              <span className={`mono font-semibold ${b.estornada ? 'line-through' : ''}`}>{brl(b.valor)}</span>
              {(b as { principal?: string }).principal && <span className="text-caption text-ink-3 mono">principal {brl((b as { principal?: string }).principal)}</span>}
              {toNum(b.multa) + toNum(b.juros) > 0 && <span className="text-caption text-ink-3">encargos {brl(toNum(b.multa) + toNum(b.juros))}</span>}
              {toNum(b.desconto) > 0 && <span className="text-caption text-ink-3">desconto {brl(b.desconto)}</span>}
              <span className="text-caption text-ink-3 flex-1">{b.conta?.nome ?? ''}{b.estornada ? ' · estornada' : ''}</span>
              {gestor && !b.estornada && <Button tamanho="sm" variante="terciario" icone={Undo2} onClick={() => { setMotivo(''); setModo({ estornar: b.id }); }}>Estornar</Button>}
            </div>
          ))}
        </div>
        {(t as { motivoCancelamento?: string | null }).motivoCancelamento && <p className="m-0 text-[14px] text-ink-2">Cancelado: {(t as { motivoCancelamento?: string | null }).motivoCancelamento}</p>}
        {((t as { renegociacao?: Titulo[] }).renegociacao ?? []).length > 0 && (
          <div className="flex flex-col gap-1">
            <strong className="text-[14px]">Virou estas parcelas</strong>
            {(t as { renegociacao?: Titulo[] }).renegociacao!.map((n) => <span key={n.id} className="mono text-[13.5px]">{n.numero}{n.parcela ? ` · ${n.parcela}` : ''} · {data(n.vencimento)} · {brl(n.valor)} · {STATUS[n.status]?.[0] ?? n.status}</span>)}
          </div>
        )}
        {(t.historico ?? []).length > 0 && (
          <div className="flex flex-col gap-1">
            <strong className="text-[14px]">Histórico</strong>
            <ol className="m-0 p-0 list-none">
              {t.historico!.map((h, i) => <li key={i} className="flex gap-3 py-1 text-[13.5px] border-t border-border first:border-0"><span className="mono text-ink-3 w-[86px] flex-none">{data(h.data)}</span><span>{(h.evento ?? '').replace(/_/g, ' ')}{h.detalhe ? ` · ${h.detalhe}` : ''}{h.usuario ? <span className="text-ink-3"> · {typeof h.usuario === 'string' ? h.usuario : h.usuario.nome}</span> : null}</span></li>)}
            </ol>
          </div>
        )}
        <HistoricoLink entidade="Titulo" id={t.id} className="self-start" />
      </Modal>
      {modo === 'baixa' && <BaixaSheet t={t} onFechar={(ok) => { setModo(null); if (ok) q.refetch(); }} />}
      {modo === 'renegociar' && <Renegociar t={t} onFechar={(ok) => { if (ok) onFechar(); else setModo(null); }} />}
      {modo === 'cancelar' && (
        <Modal aberto onFechar={() => setModo(null)} faixa titulo={`Cancelar ${t.numero}?`}
          rodape={<><Button onClick={() => setModo(null)}>Voltar</Button><Button variante="perigo" icone={Ban} disabled={motivo.trim().length < 5} carregando={cancelar.isPending} onClick={() => cancelar.mutate(undefined)}>Cancelar título</Button></>}>
          <p className="m-0 text-ink-2">O título sai do caixa previsto e fica guardado no histórico.</p>
          <TextArea label="Motivo" value={motivo} onChange={setMotivo} />
        </Modal>
      )}
      {modo && typeof modo === 'object' && (
        <Modal aberto onFechar={() => setModo(null)} faixa titulo="Estornar esta baixa?"
          rodape={<><Button onClick={() => setModo(null)}>Voltar</Button><Button variante="perigo" icone={Undo2} disabled={motivo.trim().length < 5} onClick={() => estornar(modo.estornar)}>Estornar</Button></>}>
          <p className="m-0 text-ink-2">O valor volta a ficar em aberto no título e sai da conta. Fica registrado com o seu nome e o motivo.</p>
          <TextArea label="Motivo" value={motivo} onChange={setMotivo} />
        </Modal>
      )}
    </>
  );
}

function BaixaSheet({ t, onFechar }: { t: Titulo; onFechar: (ok?: boolean) => void }) {
  const receber = t.tipo === 'RECEBER';
  const contas = useContas();
  const params = useParametros();
  const p = params.data as (typeof params.data & { multaAtraso?: string; jurosMes?: string }) | undefined;
  const [f, setF] = useState({ data: hoje(), valor: '', contaId: '', desconto: '', observacao: '' });
  const [manual, setManual] = useState<{ multa: string; juros: string } | null>(null);
  const enc = encargosNaData({ saldo: t.saldo, vencimento: t.vencimento, dataPagamento: f.data, multa: p?.multaAtraso, jurosMes: p?.jurosMes });
  const prev = previaBaixa({ saldo: t.saldo, vencimento: t.vencimento, dataPagamento: f.data, valor: f.valor, desconto: f.desconto, multa: p?.multaAtraso, jurosMes: p?.jurosMes });
  const multa = manual?.multa ?? prev.multa;
  const juros = manual?.juros ?? prev.juros;
  const devido = manual ? toNum(t.saldo) + toNum(multa) + toNum(juros) - toNum(f.desconto) : toNum(prev.devidoTotal);
  const valor = f.valor === '' ? devido : toNum(f.valor);
  const principal = manual ? valor - toNum(multa) - toNum(juros) + toNum(f.desconto) : toNum(prev.principal);
  const resta = Math.max(0, toNum(t.saldo) - principal);
  const quita = manual ? valor >= devido - 0.004 : prev.quita;
  const erroValor = manual ? (valor > devido + 0.004 ? `Passa do devido: o máximo é ${brl(devido)}.` : null) : prev.erro;
  const [erro, setErro] = useState<string | null>(null);
  const baixar = useAcao(() => api<Titulo>(`/financeiro/titulos/${t.id}/baixas`, {
    method: 'POST',
    body: { data: f.data, valor: valor.toFixed(2), contaId: f.contaId, ...(manual ? { multa: multa || '0', juros: juros || '0' } : {}), desconto: f.desconto || undefined, observacao: f.observacao.trim() || undefined }
  }), { invalida: INVAL, sucesso: !quita ? `Baixa parcial registrada. Fica um saldo de ${brl(resta)}.` : receber ? 'Recebido! O título está quitado.' : 'Pago! O título está quitado.', onSuccess: () => onFechar(true) });
  return (
    <Modal aberto onFechar={() => onFechar()} largura={580} titulo={`${receber ? 'Receber' : 'Pagar'} ${t.numero}`}
      rodape={<><Button onClick={() => onFechar()}>Voltar</Button><Button variante="primario" icone={CircleDollarSign} disabled={!f.contaId || !(valor > 0) || !!erroValor} carregando={baixar.isPending}
        onClick={() => { setErro(null); baixar.mutate(undefined, { onError: (e) => setErro(e instanceof ApiError ? e.message : msgErro(e)) }); }}>Confirmar {brl(valor)}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Data do pagamento" type="date" mono value={f.data} onChange={(v) => { setF({ ...f, data: v, valor: '' }); setManual(null); }} hint={enc.diasAtraso ? `${enc.diasAtraso} dias depois do vencimento` : 'em dia, sem encargos'} />
        <SelectField label="Conta" value={f.contaId} onChange={(v) => setF({ ...f, contaId: v })} vazio="Escolha a conta" opcoes={(contas.data ?? []).map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${brl(c.saldoAtual)}` }))} />
        <NumberField label="Valor recebido" prefixo="R$" value={f.valor === '' ? devido.toFixed(2) : f.valor} onChange={(v) => setF({ ...f, valor: v })} hint={`devido hoje ${brl(devido)}`} erro={erroValor} />
        <NumberField label="Desconto" prefixo="R$" value={f.desconto} onChange={(v) => setF({ ...f, desconto: v, valor: '' })} />
        <NumberField label="Multa" prefixo="R$" value={multa} onChange={(v) => setManual({ multa: v, juros })} hint={manual ? 'ajustada à mão' : `parte da multa de ${num(toNum(p?.multaAtraso ?? 0.02) * 100, 1)}% neste valor`} />
        <NumberField label="Juros" prefixo="R$" value={juros} onChange={(v) => setManual({ multa, juros: v })} hint={manual ? <>ajustado à mão · <button type="button" className="underline" onClick={() => setManual(null)}>voltar ao cálculo</button></> : `${num(toNum(p?.jurosMes ?? 0.01) * 100, 1)}% ao mês pró-rata, proporcional`} />
      </div>
      {!erroValor && <p className="m-0 text-[13.5px] text-ink-2 mono">Recebe {brl(valor)} = principal {brl(principal)} + multa {brl(multa)} + juros {brl(juros)}{toNum(f.desconto) > 0 ? ` − desconto ${brl(f.desconto)}` : ''}</p>}
      {!erroValor && (
        <div className={`p-3 rounded-field text-[14px] ${quita ? 'bg-ok-soft' : 'bg-warn-soft'}`} aria-live="polite">
          {quita ? <>Quita o título.</> : <>Fica um saldo de <strong className="mono">{brl(resta)}</strong>; os encargos dele são calculados na próxima baixa.</>}
        </div>
      )}
      <TextArea label="Observação" value={f.observacao} onChange={(v) => setF({ ...f, observacao: v })} />
      {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
    </Modal>
  );
}

function Renegociar({ t, onFechar }: { t: Titulo; onFechar: (ok?: boolean) => void }) {
  const [f, setF] = useState({ condicao: '30/60', dataBase: hoje(), valor: '' });
  const valor = f.valor === '' ? t.saldo : f.valor;
  const prev = useMemo(() => previaParcelas(f.condicao, valor, f.dataBase), [f.condicao, valor, f.dataBase]);
  const ok = !prev.erro && prev.parcelas.length > 0;
  const reneg = useAcao(() => api(`/financeiro/titulos/${t.id}/renegociar`, { method: 'POST', body: { condicao: f.condicao.trim(), dataBase: f.dataBase, ...(f.valor !== '' ? { valor: String(toNum(f.valor)) } : {}) } }), {
    invalida: INVAL, sucesso: `Renegociado em ${prev.parcelas.length} parcelas. O título original fica como renegociado.`, onSuccess: () => onFechar(true)
  });
  return (
    <Modal aberto onFechar={() => onFechar()} titulo={`Renegociar ${t.numero}`}
      rodape={<><Button onClick={() => onFechar()}>Voltar</Button><Button variante="primario" icone={Handshake} disabled={!ok} carregando={reneg.isPending} onClick={() => reneg.mutate(undefined)}>Renegociar</Button></>}>
      <p className="m-0 text-ink-2 text-[14px]">O saldo de {brl(t.saldo)} vira novas parcelas ligadas a este título. Se combinou juros ou desconto, ajuste o valor.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TextField label="Nova condição" value={f.condicao} onChange={(v) => setF({ ...f, condicao: v })} erro={prev.erro} />
        <TextField label="Data base" type="date" mono value={f.dataBase} onChange={(v) => setF({ ...f, dataBase: v })} />
        <NumberField label="Valor renegociado" prefixo="R$" value={f.valor} onChange={(v) => setF({ ...f, valor: v })} placeholder={num(t.saldo)} />
      </div>
      {prev.parcelas.length > 0 && (
        <ul className="m-0 p-3 list-none rounded-field bg-steel-soft grid grid-cols-[auto_1fr_auto] gap-x-3 mono text-[13.5px]" aria-live="polite">
          {prev.parcelas.map((x) => <li key={x.numero} className="contents"><span>{x.numero}/{prev.parcelas.length}</span><span>{data(x.vencimento)}</span><span className="text-right">{brl(x.valor)}</span></li>)}
        </ul>
      )}
      <p className="m-0 text-caption text-ink-3 flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden /> Nada muda até você confirmar.</p>
    </Modal>
  );
}

