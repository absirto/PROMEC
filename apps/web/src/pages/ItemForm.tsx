import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, Save } from 'lucide-react';
import { sugestaoDeCompra } from '@promec/motor';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Fornecedor, Item, Lista, Movimento, SaldoLocal, TipoItem } from '../lib/types';
import { brl, data, num, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
import { FormHeader, NavSecoes, Secao, span } from '../components/Form';
import { NumberField, SelectField, TextField, Toggle } from '../components/Field';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { Card } from '../components/Card';
import { Carregando, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { TIPO_ITEM, textoConversao } from '../features/suprimentos/sup';
import { SituacaoPill, situacaoItem } from './ItensLista';
import { useTitulo } from '../layout/titulo';

type Form = Omit<Item, 'id' | 'saldo' | 'classeABC' | 'saldosPorLocal' | 'ultimoCusto'> & { pesoPorMetroKg: string; precoVenda: string; margemPeca: string; fornecedorPreferidoId: string; categoriaDespesa: string };
const VAZIO: Form = {
  codigo: '', descricao: '', tipo: 'MATERIA_PRIMA', unidadeCompra: 'kg', unidadeConsumo: 'kg', fatorConversao: '1', pesoPorMetroKg: '', custoMedio: '',
  precoVenda: '', margemPeca: '', estoqueMinimo: '', estoqueMaximo: '', fornecedorPreferidoId: '', rastreavel: false, categoriaDespesa: 'materiaPrima', ativo: true
};
const CATEGORIAS = [['materiaPrima', 'Matéria-prima'], ['insumos', 'Insumos'], ['pecas', 'Peças'], ['ferramentas', 'Ferramentas'], ['servicos', 'Serviços de terceiros']] as const;
const z = (v: string | null | undefined) => (v === '' || v == null ? '0' : v);
const lista = <T,>(x: T[] | Lista<T> | undefined) => (Array.isArray(x) ? x : x?.itens ?? []);

export default function ItemForm() {
  const { pode: podeFn_ } = useAuth();
  const podeGerir = podeFn_('cadastros.gerenciar') || podeFn_('compras.gerenciar') || podeFn_('estoque.gerenciar');
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['itens', id], queryFn: () => api<Item>(`/itens/${id}`), enabled: !novo });
  const forn = useQuery({ queryKey: ['fornecedores', ''], queryFn: () => api<Lista<Fornecedor> | Fornecedor[]>('/fornecedores') });
  const saldos = useQuery({ queryKey: ['estoque', 'saldos', 'item', id], queryFn: () => api<Lista<SaldoLocal> | SaldoLocal[]>('/estoque/saldos', { query: { q: q.data?.codigo } }), enabled: !!q.data?.codigo });
  const movs = useQuery({ queryKey: ['estoque', 'movimentos', 'item', id], queryFn: () => api<Lista<Movimento>>('/estoque/movimentos', { query: { itemId: id } }), enabled: !novo });
  const [f, setF] = useState<Form | null>(novo ? VAZIO : null);
  const [tentou, setTentou] = useState(false);
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);
  const [inativar, setInativar] = useState(false);
  useEffect(() => {
    if (q.data) {
      const i = q.data;
      setF({ ...VAZIO, ...i, pesoPorMetroKg: i.pesoPorMetroKg ?? '', precoVenda: i.precoVenda ?? '', margemPeca: i.margemPeca ?? '', fornecedorPreferidoId: i.fornecedorPreferidoId ?? '', categoriaDespesa: i.categoriaDespesa ?? '' });
    }
  }, [q.data]);
  useTitulo(novo ? 'Novo item' : q.data?.descricao ?? 'Item');

  const inval = [['itens'], ['estoque']];
  const salvar = useAcao(
    (x: Form) => api<Item>(novo ? '/itens' : `/itens/${id}`, {
      method: novo ? 'POST' : 'PATCH',
      body: {
        ...x, codigo: x.codigo.trim().toUpperCase(), descricao: x.descricao.trim(), fatorConversao: z(x.fatorConversao), custoMedio: z(x.custoMedio),
        estoqueMinimo: z(x.estoqueMinimo), estoqueMaximo: z(x.estoqueMaximo), pesoPorMetroKg: x.pesoPorMetroKg || null, precoVenda: x.precoVenda || null,
        margemPeca: x.margemPeca || null, fornecedorPreferidoId: x.fornecedorPreferidoId || null, categoriaDespesa: x.categoriaDespesa || null
      }
    }),
    { invalida: inval, sucesso: (_r, x) => `${x.descricao} salvo. Já aparece para orçar e para comprar.`, onSuccess: (r) => novo && r?.id && navigate(`/itens/${r.id}`, { replace: true }) }
  );
  const del = useAcao(() => api(`/itens/${id}`, { method: 'DELETE' }), { invalida: inval, sucesso: 'Item inativado. O histórico continua guardado.', onSuccess: () => navigate('/itens') });

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const difere = f.unidadeCompra.trim().toLowerCase() !== f.unidadeConsumo.trim().toLowerCase();
  const erroFator = difere && !(toNum(f.fatorConversao) > 0) ? `Quantos ${f.unidadeConsumo || 'consumo'} vêm em 1 ${f.unidadeCompra || 'compra'}? Sem isso o estoque não fecha.` : null;
  const erroMax = f.estoqueMaximo && toNum(f.estoqueMaximo) < toNum(f.estoqueMinimo) ? 'O máximo precisa ser maior que o mínimo.' : null;
  const erroDesc = tentou && !f.descricao.trim() ? 'Descreva o item como o comprador procura: material, bitola, medida.' : null;
  const erroCod = erroCodigo ?? (tentou && !f.codigo.trim() ? 'Dê um código curto, como MP-LAT-C360-25.' : null);
  const saldo = q.data?.saldo ?? { fisico: '0', reservado: '0', disponivel: '0' };
  const sugestao = toNum(f.estoqueMinimo) > 0 ? sugestaoDeCompra({ disponivel: saldo.disponivel, minimo: z(f.estoqueMinimo), maximo: z(f.estoqueMaximo) }) : '0';
  const exemploCorte = toNum(f.pesoPorMetroKg) > 0 ? `1 m = ${num(f.pesoPorMetroKg, 2)} kg · uma peça de 45 mm = ${num(toNum(f.pesoPorMetroKg) * 0.045, 3)} kg` : null;
  const porLocal = q.data?.saldosPorLocal ?? lista(saldos.data).filter((s) => s.item.id === id);
  const enviar = () => {
    setTentou(true);
    if (!f.codigo.trim() || !f.descricao.trim() || erroFator || erroMax) return;
    salvar.mutate(f, { onError: (e) => e instanceof ApiError && e.codigo === 'CODIGO_DUPLICADO' && setErroCodigo(e.message) });
  };
  const peca = f.tipo === 'PECA_REPOSICAO' || f.tipo === 'PRODUTO_ACABADO';

  return (
    <>
      <FormHeader
        voltar={{ to: '/itens', rotulo: 'Itens' }}
        iniciais={(f.codigo || 'IT').slice(0, 2)}
        cor="linear-gradient(135deg, #1D6FB8, #15395A)"
        titulo={novo ? 'Novo item' : f.descricao}
        lead="O custo médio muda sozinho a cada recebimento. Aqui você define unidades, limites de estoque e como o item é controlado."
        pills={!novo && q.data && <><Pill tom="neutral">{TIPO_ITEM[f.tipo]}</Pill>{q.data.classeABC && <Pill tom="primary">classe {q.data.classeABC}</Pill>}{f.rastreavel && <Pill tom="steel">rastreável</Pill>}<SituacaoPill s={situacaoItem(q.data)} /></>}
        acoes={<>{podeGerir && !novo && f.ativo && <Button variante="perigo" icone={Ban} onClick={() => setInativar(true)}>Inativar</Button>}{podeGerir && <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>Salvar</Button>}</>}
      />
      <div className="flex flex-wrap gap-5 items-start">
        <NavSecoes secoes={[
          { id: 'o-que', titulo: 'O que é', completa: !!(f.codigo.trim() && f.descricao.trim()) },
          { id: 'unidades', titulo: 'Unidades', completa: !erroFator },
          { id: 'custo', titulo: 'Custo e preço', completa: toNum(f.custoMedio) > 0 },
          { id: 'estoque', titulo: 'Estoque', completa: toNum(f.estoqueMaximo) > 0 && !erroMax }
        ]} />
        <form className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
          <Secao id="o-que" titulo="O que é">
            <TextField className={span(2)} label="Código" required mono value={f.codigo} onChange={(v) => { setErroCodigo(null); set('codigo', v.toUpperCase()); }} erro={erroCod} />
            <TextField className={span(4)} label="Descrição" required value={f.descricao} onChange={(v) => set('descricao', v)} erro={erroDesc} placeholder="Barra de latão C360 Ø25" />
            <SelectField className={span(3)} label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v as TipoItem)} opcoes={(Object.keys(TIPO_ITEM) as TipoItem[]).map((t) => ({ valor: t, rotulo: TIPO_ITEM[t] }))} />
            <SelectField className={span(3)} label="Categoria de despesa" value={f.categoriaDespesa} onChange={(v) => set('categoriaDespesa', v)} vazio="—" opcoes={CATEGORIAS.map(([valor, rotulo]) => ({ valor, rotulo }))} hint="Para onde vai a conta a pagar do recebimento." />
            <div className={span(3)}><Toggle label="Rastreável por lote" descricao="Exige lote e certificado no recebimento e no consumo." value={f.rastreavel} onChange={(v) => set('rastreavel', v)} /></div>
            <div className={span(3)}><Toggle label="Ativo" descricao="Inativos somem do orçamento e das compras." value={f.ativo} onChange={(v) => set('ativo', v)} /></div>
          </Secao>
          <Secao id="unidades" titulo="Unidades" descricao="Compra numa unidade, consome em outra? Diga quanto vem em cada uma.">
            <TextField className={span(2)} label="Unidade de compra" value={f.unidadeCompra} onChange={(v) => set('unidadeCompra', v)} placeholder="barra" />
            <TextField className={span(2)} label="Unidade de consumo" value={f.unidadeConsumo} onChange={(v) => set('unidadeConsumo', v)} placeholder="mm" />
            <NumberField className={span(2)} label="Fator de conversão" value={f.fatorConversao} onChange={(v) => set('fatorConversao', v)} erro={erroFator} disabled={!difere} hint={!difere ? 'Mesma unidade: fator 1.' : undefined} />
            <p className={`${span(6)} m-0 px-3.5 py-2.5 rounded-field bg-steel-soft text-steel font-semibold mono`} aria-live="polite">
              {textoConversao(f.unidadeCompra, f.unidadeConsumo, f.fatorConversao) ?? 'Informe o fator para ver a conversão.'}
            </p>
            {(f.tipo === 'MATERIA_PRIMA' || toNum(f.pesoPorMetroKg) > 0) && (
              <NumberField className={span(3)} label="Peso por metro" sufixo="kg/m" value={f.pesoPorMetroKg} onChange={(v) => set('pesoPorMetroKg', v)} hint={exemploCorte ?? 'Para barra e perfil: o orçamento calcula o material por corte.'} />
            )}
          </Secao>
          <Secao id="custo" titulo="Custo e preço">
            <NumberField className={span(2)} label="Custo médio" prefixo="R$" sufixo={`/${f.unidadeConsumo}`} value={f.custoMedio} onChange={(v) => set('custoMedio', v)} disabled={!novo} hint={novo ? 'Ponto de partida; depois o recebimento atualiza.' : `Atualizado pelos recebimentos${q.data?.ultimoCusto ? ` · último ${brl(q.data.ultimoCusto)}` : ''}.`} />
            {peca && <NumberField className={span(2)} label="Preço de venda" prefixo="R$" value={f.precoVenda} onChange={(v) => set('precoVenda', v)} />}
            {peca && <NumberField className={span(2)} label="Margem da peça" percentual value={f.margemPeca} onChange={(v) => set('margemPeca', v)} hint={toNum(f.custoMedio) > 0 && toNum(f.margemPeca) > 0 && toNum(f.margemPeca) < 1 ? `Sugere ${brl(toNum(f.custoMedio) / (1 - toNum(f.margemPeca)))}` : undefined} />}
            <SelectField className={span(peca ? 6 : 4)} label="Fornecedor preferido" value={f.fornecedorPreferidoId} onChange={(v) => set('fornecedorPreferidoId', v)} vazio="Nenhum" opcoes={lista(forn.data).map((x) => ({ valor: x.id, rotulo: x.fantasia || x.nome }))} />
          </Secao>
          <Secao id="estoque" titulo="Estoque" descricao="Abaixo do mínimo, o ponto de pedido sugere comprar até o máximo.">
            <NumberField className={span(2)} label="Estoque mínimo" sufixo={f.unidadeConsumo} value={f.estoqueMinimo} onChange={(v) => set('estoqueMinimo', v)} />
            <NumberField className={span(2)} label="Estoque máximo" sufixo={f.unidadeConsumo} value={f.estoqueMaximo} onChange={(v) => set('estoqueMaximo', v)} erro={erroMax} />
            <div className={`${span(2)} flex flex-col justify-center p-3 rounded-field ${toNum(sugestao) > 0 ? 'bg-warn-soft' : 'bg-surface-2'}`} aria-live="polite">
              <span className="text-caption text-ink-3">Sugestão de compra</span>
              <span className="mono text-[20px] font-bold">{toNum(sugestao) > 0 ? `${num(sugestao, 2)} ${f.unidadeConsumo}` : 'nada agora'}</span>
            </div>
          </Secao>
        </form>
        <GlassPanel placa="aco" className="flex-[1_1_300px] max-w-full lg:max-w-[360px] lg:sticky lg:top-24" aria-label="Saldo do item">
          <h2 className="m-0 text-[24px] font-bold">Saldo agora</h2>
          <div className="grid grid-cols-3 gap-2">
            {[['Físico', saldo.fisico], ['Reservado', saldo.reservado], ['Disponível', saldo.disponivel]].map(([l, v]) => (
              <div key={l} className="p-2.5 rounded-[14px] bg-surface-1"><span className="block text-caption text-ink-3">{l}</span><span className="mono text-[16px] font-bold">{num(v, 2)}</span></div>
            ))}
          </div>
          <div className="p-3 rounded-[16px] bg-surface-1 flex justify-between items-baseline"><span className="text-[14px]">Valor em estoque</span><span className="mono font-bold">{brl(toNum(saldo.fisico) * toNum(f.custoMedio))}</span></div>
          {porLocal.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Por local</span>
              {porLocal.map((s) => <div key={s.localId} className="flex justify-between px-3 py-2 rounded-[12px] bg-surface-1 text-[14px]"><span>{s.localNome}</span><span className="mono">{num(s.disponivel, 2)} / {num(s.fisico, 2)}</span></div>)}
            </div>
          )}
          {q.data?.classeABC && <span className="text-[13px] text-ink-2">Classe <strong>{q.data.classeABC}</strong> na curva ABC: {q.data.classeABC === 'A' ? 'pesa muito no consumo, vale negociar preço e acompanhar de perto.' : q.data.classeABC === 'B' ? 'consumo intermediário.' : 'pouco peso no consumo total.'}</span>}
          {(q.data?.fornecedores ?? []).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Quem vende</span>
              {q.data!.fornecedores!.map((x) => (
                <Link key={x.fornecedorId} to={`/fornecedores/${x.fornecedorId}`} className="flex justify-between gap-2 px-3 py-2 rounded-[12px] bg-surface-1 text-[13px] no-underline text-ink-1">
                  <span className="truncate">{x.nome}</span><span className="mono">{brl(x.ultimoPreco)} · {data(x.data)}</span>
                </Link>
              ))}
            </div>
          )}
          {!novo && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Últimos movimentos</span>
              {(movs.data?.itens ?? []).slice(0, 5).map((m) => (
                <div key={m.id} className="flex justify-between gap-2 px-3 py-2 rounded-[12px] bg-surface-1 text-[13px]">
                  <span className="truncate">{m.tipo.replace(/_/g, ' ').toLowerCase()}{m.estornado ? ' (estornado)' : ''}{m.origem?.numero ? ` · ${m.origem.numero}` : ''}</span>
                  <span className={`mono ${toNum(m.quantidade) < 0 ? 'text-bad' : 'text-ok'}`}>{toNum(m.quantidade) > 0 ? '+' : ''}{num(m.quantidade, 2)} · {data(m.data)}</span>
                </div>
              ))}
              {movs.isSuccess && !movs.data?.itens?.length && <span className="text-[13px] text-ink-3">Nenhum movimento ainda.</span>}
              <Link to={`/estoque?aba=movimentos&item=${id}`} className="text-[13px] font-semibold">Ver todos no estoque</Link>
            </div>
          )}
          {toNum(f.custoMedio) > 0 && toNum(f.pesoPorMetroKg) > 0 && <span className="text-caption text-ink-2">Custo por metro de barra: <strong className="mono">{brl(toNum(f.custoMedio) * toNum(f.pesoPorMetroKg))}</strong></span>}
        </GlassPanel>
      </div>
      <Modal aberto={inativar} onFechar={() => setInativar(false)} titulo="Inativar este item?"
        rodape={<><Button onClick={() => setInativar(false)}>Manter</Button><Button variante="perigo" icone={Ban} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Inativar</Button></>}>
        <p className="m-0 text-ink-2">Ele some do orçamento e das compras. Saldo, lotes e histórico ficam guardados.</p>
      </Modal>
    </>
  );
}
