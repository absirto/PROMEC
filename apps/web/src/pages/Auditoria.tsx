import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Eraser, Pencil, Plus, Trash2, Zap, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { Lista } from '../lib/types';
import { HeroBand } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/Field';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill, type Tom } from '../components/Pill';
import { useTitulo } from '../layout/titulo';

type Valor = Record<string, unknown> | null | undefined;
interface Registro { id?: string; data: string; usuario?: string | { id?: string; nome?: string } | null; entidade: string; entidadeId?: string | null; acao: string; antes?: Valor; depois?: Valor }

const ENTIDADES: Record<string, string> = {
  Orcamento: 'Orçamento', OrdemServico: 'Ordem de serviço', TabelaCustos: 'Tabela de Custos', CustoFixo: 'Custo fixo', CentroTrabalho: 'Centro de trabalho', Colaborador: 'Funcionário',
  Cliente: 'Cliente', Titulo: 'Título financeiro', ContaFinanceira: 'Conta', Transferencia: 'Transferência', CentroCusto: 'Centro de custo', Recorrencia: 'Recorrência', Comissao: 'Comissão',
  Pedido: 'Pedido de compra', Requisicao: 'Requisição', Cotacao: 'Cotação', Movimento: 'Movimento de estoque', Inventario: 'Inventário', LocalEstoque: 'Local de estoque',
  Item: 'Item', Fornecedor: 'Fornecedor', PlanoInspecao: 'Plano de inspeção', NaoConformidade: 'Não conformidade', Garantia: 'Garantia', Usuario: 'Usuário', Perfil: 'Perfil', Parametros: 'Parâmetros'
};
const FILTROS = ['de', 'ate', 'entidade', 'entidadeId', 'usuarioId'] as const;
type Filtros = Record<(typeof FILTROS)[number], string>;

const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);
const nomeUsuario = (u: Registro['usuario']) => (!u ? 'Sistema' : typeof u === 'string' ? u : u.nome ?? 'Sistema');
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const texto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function acaoInfo(acao: string): [string, Tom, LucideIcon] {
  const a = acao.toUpperCase();
  if (/CRIA|CREATE|INSER/.test(a)) return ['Criou', 'ok', Plus];
  if (/EXCLU|DELET|REMOV/.test(a)) return ['Excluiu', 'bad', Trash2];
  if (/ALTER|UPDAT|EDIT/.test(a)) return ['Alterou', 'info', Pencil];
  if (a === 'LINK-PORTAL') return ['Gerou link do portal', 'run', Zap];
  return [acao.charAt(0).toUpperCase() + acao.slice(1).toLowerCase().replace(/[_-]/g, ' '), 'run', Zap];
}

function diferencas(antes: Valor, depois: Valor) {
  const a = ehObjeto(antes) ? antes : null;
  const d = ehObjeto(depois) ? depois : null;
  const chaves = [...new Set([...Object.keys(a ?? {}), ...Object.keys(d ?? {})])];
  return chaves
    .map((k) => ({ k, antes: a ? texto(a[k]) : null, depois: d ? texto(d[k]) : null }))
    .filter((x) => !a || !d || x.antes !== x.depois);
}

export default function Auditoria() {
  useTitulo('Histórico de alterações');
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(FILTROS.map((k) => [k, sp.get(k) ?? ''])) as Filtros;
  const set = (k: keyof Filtros, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  const [idTexto, setIdTexto] = useState(f.entidadeId);
  useEffect(() => setIdTexto(f.entidadeId), [f.entidadeId]);
  useEffect(() => {
    if (idTexto.trim() === f.entidadeId) return;
    const t = window.setTimeout(() => set('entidadeId', idTexto.trim()), 400);
    return () => window.clearTimeout(t);
  }, [idTexto]);
  const limpar = () => {
    setIdTexto('');
    setSp(new URLSearchParams(), { replace: true });
  };
  const filtrando = FILTROS.some((k) => f[k]);

  const usuarios = useQuery({ queryKey: ['usuarios', 'opcoes'], queryFn: () => api<{ id: string; nome: string }[] | Lista<{ id: string; nome: string }>>('/usuarios/opcoes'), select: comoLista, staleTime: 5 * 60_000 });
  const q = useQuery({
    queryKey: ['auditoria', f],
    queryFn: () => api<Registro[] | Lista<Registro>>('/auditoria', { query: f }),
    select: (d) => ({ itens: comoLista(d), total: Array.isArray(d) ? d.length : d?.total ?? 0 })
  });
  const itens = q.data?.itens ?? [];
  const entidades = Object.entries(ENTIDADES).map(([valor, rotulo]) => ({ valor, rotulo }));
  if (f.entidade && !ENTIDADES[f.entidade]) entidades.push({ valor: f.entidade, rotulo: f.entidade });

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo="Histórico de alterações"
        texto="Quem mexeu, quando e o que mudou. Custos, orçamentos, OS, estoque, financeiro e acessos ficam registrados aqui."
      />
      <Card className="p-4 flex flex-col gap-3" aria-label="Filtros do histórico">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <SelectField label="O que mudou" value={f.entidade} onChange={(v) => set('entidade', v)} vazio="Tudo" opcoes={entidades} />
          <TextField label="Código ou ID" mono value={idTexto} onChange={setIdTexto} placeholder="Ex.: id do orçamento" />
          <SelectField label="Quem fez" value={f.usuarioId} onChange={(v) => set('usuarioId', v)} vazio="Todos" opcoes={(usuarios.data ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }))} />
          <TextField label="De" type="date" value={f.de} onChange={(v) => set('de', v)} max={f.ate || undefined} />
          <TextField label="Até" type="date" value={f.ate} onChange={(v) => set('ate', v)} min={f.de || undefined} />
        </div>
        {filtrando && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13.5px] text-ink-2" aria-live="polite">
              {q.isSuccess ? <><strong className="mono">{q.data.total}</strong> {q.data.total === 1 ? 'registro' : 'registros'} com esses filtros</> : 'Filtrando…'}
            </span>
            <Button tamanho="sm" variante="terciario" icone={Eraser} onClick={limpar}>Limpar filtros</Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden" aria-label="Linha do tempo">
        {q.isLoading ? (
          <Carregando rotulo="Carregando histórico" />
        ) : q.isError ? (
          <ErroEstado erro={q.error} tentar={() => q.refetch()} />
        ) : !itens.length ? (
          <EmptyState
            titulo={filtrando ? 'Nada registrado com esses filtros' : 'Nenhuma alteração registrada ainda'}
            texto={filtrando ? 'Tente um período maior ou tire algum filtro. Se o registro é antigo, pode ser de antes do histórico começar.' : 'Assim que alguém criar, alterar ou excluir algo importante, aparece aqui com nome e hora.'}
            acao={filtrando && <Button icone={Eraser} onClick={limpar}>Limpar filtros</Button>}
          />
        ) : (
          <>
            <ol className="list-none m-0 p-0">
              {itens.map((r, i) => <Linha key={r.id ?? `${r.data}-${i}`} r={r} />)}
            </ol>
            {q.data && q.data.total > itens.length && (
              <p className="m-0 px-5 py-3 border-t border-border text-[13.5px] text-ink-2">
                Mostrando <strong className="mono">{itens.length}</strong> de <strong className="mono">{q.data.total}</strong>. Use os filtros para chegar no que procura.
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function Linha({ r }: { r: Registro }) {
  const [aberto, setAberto] = useState(false);
  const [rotulo, tom, Icone] = acaoInfo(r.acao);
  const mudancas = diferencas(r.antes, r.depois);
  // Sem "antes" numa ação que não é criação: é o primeiro registro do histórico (o estado anterior não foi guardado).
  const primeiro = !ehObjeto(r.antes) && ehObjeto(r.depois) && !/CRIA|CREATE|INSER/i.test(r.acao);
  const criacao = !ehObjeto(r.antes) && ehObjeto(r.depois);
  const exclusao = ehObjeto(r.antes) && !ehObjeto(r.depois);
  const id = useId();

  return (
    <li className="border-t border-border first:border-0">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        disabled={!mudancas.length}
        onClick={() => setAberto(!aberto)}
        className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 hover:bg-surface-2 disabled:hover:bg-transparent disabled:cursor-default"
      >
        <span className="mono text-[13px] text-ink-3 w-[132px] flex-none">{quando(r.data)}</span>
        <Pill tom={tom} icone={Icone}>{rotulo}</Pill>
        <span className="flex-1 min-w-[180px] flex flex-col">
          <span className="font-medium">
            {ENTIDADES[r.entidade] ?? r.entidade} {r.entidadeId && <span className="mono text-[13px] text-ink-2 break-all">{r.entidadeId}</span>}
          </span>
          <span className="text-[13px] text-ink-3">por {nomeUsuario(r.usuario)}{primeiro ? ' · primeiro registro' : mudancas.length ? ` · ${mudancas.length} ${mudancas.length === 1 ? 'campo' : 'campos'}` : ''}</span>
        </span>
        {mudancas.length > 0 && <ChevronDown className={`size-5 text-ink-3 transition ${aberto ? 'rotate-180' : ''}`} aria-hidden />}
      </button>
      {aberto && (
        <div id={id} className="px-5 pb-4 flex flex-col gap-2">
          {primeiro && <p className="m-0 text-[13.5px] text-ink-2">Primeiro registro deste item no histórico: o estado anterior não foi guardado, então aparece só como ficou.</p>}
          <div className="relative overflow-x-auto rounded-field border border-border">
            <table className="w-full text-[13.5px] border-collapse" aria-label={`O que mudou em ${ENTIDADES[r.entidade] ?? r.entidade}`}>
              <thead className="bg-surface-2">
                <tr>
                  <th scope="col" className="text-left font-semibold px-3 py-2">Campo</th>
                  {!criacao && <th scope="col" className="text-left font-semibold px-3 py-2">Antes</th>}
                  {!exclusao && <th scope="col" className="text-left font-semibold px-3 py-2">{criacao && !primeiro ? 'Valor' : primeiro ? 'Como ficou' : 'Depois'}</th>}
                </tr>
              </thead>
              <tbody>
                {mudancas.map((m) => (
                  <tr key={m.k} className="border-t border-border align-top">
                    <th scope="row" className="text-left font-medium px-3 py-2 mono text-[12.5px]">{m.k}</th>
                    {!criacao && <td className="px-3 py-2 mono text-bad line-through break-all min-w-[120px]">{m.antes}</td>}
                    {!exclusao && <td className="px-3 py-2 mono text-ok break-all min-w-[120px]">{m.depois}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </li>
  );
}
