import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, PackageCheck, Truck, XCircle } from 'lucide-react';
import { custoMedioAposEntrada } from '@promec/motor';
import { api, ApiError, msgErro } from '../lib/api';
import type { Fornecedor, Item, Lista, LocalEstoque, Pedido, StatusPedido } from '../lib/types';
import { brl, data, num, pct, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
import { podeLiberarMargem, useAuth } from '../lib/auth';
import { flagsDivergencia } from '../features/suprimentos/sup';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { Pill, type Tom } from '../components/Pill';
import { Modal } from '../components/Modal';
import { NumberField, SelectField, TextArea, TextField } from '../components/Field';
import { Estrelas } from '../components/Estrelas';
import { useItens } from '../components/ItemPicker';
import { useToast } from '../components/Toast';
import { useTitulo } from '../layout/titulo';

type ItemPedido = Pedido['itens'][number];
type Rec = NonNullable<Pedido['recebimentos']>[number];

const STATUS: Record<StatusPedido, [string, Tom]> = {
  AGUARDANDO_APROVACAO: ['Aguardando aprovação', 'warn'],
  APROVADO: ['Aprovado', 'info'],
  PARCIAL: ['Recebido em parte', 'run'],
  RECEBIDO: ['Recebido', 'ok'],
  CANCELADO: ['Cancelado', 'bad']
};

const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);
const pendenteDe = (i: ItemPedido) => (i.pendente !== undefined ? toNum(i.pendente) : Math.max(0, toNum(i.quantidade) - toNum(i.recebido)));
const qtd = (v: string | number) => num(v, toNum(v) % 1 ? 2 : 0);

/** "28 dias", "30/60/90", "à vista" → dias até o primeiro vencimento; null quando não dá para ler. */
function diasDaCondicao(c?: string | null): number | null {
  if (!c) return null;
  if (/vista/i.test(c)) return 0;
  const m = c.match(/\d+/);
  return m ? Number(m[0]) : null;
}
const somarDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

function textoDivergencia(d: unknown): string {
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    if (typeof o.mensagem === 'string') return o.mensagem;
    const nome = (o.descricao ?? o.item ?? '') as string;
    const esp = o.esperado as string | undefined, rec = o.recebido as string | undefined;
    if (o.tipo === 'QUANTIDADE' || o.tipo === 'quantidade') return `${nome ? `${nome}: ` : ''}quantidade ${esp !== undefined ? `esperada ${esp}, veio ${rec}` : 'diferente do pendente'}`;
    if (o.tipo === 'PRECO' || o.tipo === 'preco') return `${nome ? `${nome}: ` : ''}preço ${esp !== undefined ? `do pedido ${brl(esp)}, na nota ${brl(rec)}` : 'fora do pedido'}${o.variacao !== undefined ? ` (${toNum(o.variacao as string) > 0 ? '+' : ''}${pct(o.variacao as string)})` : ''}`;
    if (typeof o.descricao === 'string') return o.descricao;
    return Object.values(o).filter((v) => typeof v === 'string' || typeof v === 'number').join(' · ');
  }
  return String(d);
}

export default function PedidoDetalhe() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const gestor = podeLiberarMargem(usuario?.papel);
  const q = useQuery({ queryKey: ['compras', 'pedidos', id], queryFn: () => api<Pedido>(`/compras/pedidos/${id}`), enabled: !!id });
  const p = q.data;
  const fq = useQuery({ queryKey: ['fornecedores', 'detalhe', p?.fornecedor?.id], queryFn: () => api<Fornecedor>(`/fornecedores/${p!.fornecedor.id}`), enabled: !!p?.fornecedor?.id, retry: false });
  useTitulo(p ? `Pedido ${p.numero}` : 'Pedido de compra');
  const [receber, setReceber] = useState(false);
  const [cancelar, setCancelar] = useState(false);

  const inval = [['compras'], ['painel']];
  const aprovar = useAcao(() => api(`/compras/pedidos/${id}/aprovar`, { method: 'POST' }), {
    invalida: inval,
    sucesso: 'Pedido aprovado. Pode confirmar com o fornecedor; quando o material chegar, registre o recebimento.'
  });
  const cancela = useAcao(() => api(`/compras/pedidos/${id}/cancelar`, { method: 'POST' }), {
    invalida: inval,
    sucesso: 'Pedido cancelado. Nada entra no estoque e nada vai para o Financeiro.',
    onSuccess: () => setCancelar(false)
  });

  if (q.isLoading) return <Card><Carregando rotulo="Carregando pedido" /></Card>;
  if (q.isError || !p) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;

  const f = fq.data;
  const condicao = f?.condicaoPagamento ?? p.condicaoPagamento ?? p.fornecedor.condicaoPagamento;
  const podeReceber = p.status === 'APROVADO' || p.status === 'PARCIAL';
  const podeCancelar = p.status === 'AGUARDANDO_APROVACAO' || p.status === 'APROVADO';
  const pendentes = p.itens.filter((i) => pendenteDe(i) > 0).length;
  const texto = {
    AGUARDANDO_APROVACAO: gestor
      ? 'Passou do limite de compra sem aprovação. Confira itens e valores; aprovando, o fornecedor pode separar o material.'
      : 'Passou do limite de compra e está aguardando a aprovação do gestor. Assim que ele aprovar, dá para receber.',
    APROVADO: 'Aprovado. Quando o material chegar, registre o recebimento conferindo a nota: a entrada no estoque e a conta a pagar saem daí.',
    PARCIAL: `Parte do material já chegou. ${pendentes === 1 ? 'Falta 1 item' : `Faltam ${pendentes} itens`}; registre o próximo recebimento quando vier.`,
    RECEBIDO: 'Tudo recebido e no estoque. A conta a pagar ficou registrada para o Financeiro.',
    CANCELADO: 'Pedido cancelado. Nada entra no estoque e nada vai para o Financeiro.'
  }[p.status];

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        sobretitulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link to="/compras?aba=pedidos" className="inline-flex items-center gap-1.5 text-[#FFC08F] no-underline hover:underline">
              <ArrowLeft className="size-4" aria-hidden /> Pedido de compra
            </Link>
            <Pill tom={STATUS[p.status]?.[1] ?? 'neutral'}>{STATUS[p.status]?.[0] ?? p.status}</Pill>
          </span>
        }
        titulo={<span className={p.status === 'CANCELADO' ? 'line-through' : ''}>{p.numero}</span>}
        texto={texto}
        acoes={
          <>
            {podeCancelar && <Button variante="vidro" icone={XCircle} onClick={() => setCancelar(true)}>Cancelar pedido</Button>}
            {p.status === 'AGUARDANDO_APROVACAO' &&
              (gestor ? (
                <Button variante="primario" icone={BadgeCheck} carregando={aprovar.isPending} onClick={() => aprovar.mutate(undefined)}>Aprovar pedido</Button>
              ) : (
                <span className="glass-dark rounded-full px-4 h-11 inline-flex items-center text-[13.5px]">Aguardando a aprovação do gestor</span>
              ))}
            {podeReceber && <Button variante="primario" icone={PackageCheck} onClick={() => setReceber(true)}>Registrar recebimento</Button>}
          </>
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Total do pedido" valor={brl(p.total)} sub={toNum(p.frete) > 0 ? `com ${brl(p.frete)} de frete` : 'sem frete'} />
          <HeroKpi
            rotulo="Fornecedor"
            valor={<span className="font-sans text-[20px] leading-tight block">{p.fornecedor.nome}</span>}
            sub={f ? <span className="inline-flex text-white"><Estrelas valor={f.avaliacao} tamanho={13} /></span> : condicao}
          />
          <HeroKpi rotulo="Previsão de entrega" valor={<span className="text-[24px]">{data(p.previsaoEntrega ?? p.previsao)}</span>} sub={condicao ? `pagamento: ${condicao}` : undefined} />
        </div>
      </HeroBand>

      <Card className="p-4 sm:p-5 flex flex-col gap-4">
        <CardHeader titulo="Itens" sub={p.cotacaoId ? <Link to={`/compras/cotacoes/${p.cotacaoId}`}>Ver a cotação de origem</Link> : 'Pedido direto, sem cotação'} />
        <DataTable<ItemPedido>
          rotulo="Itens do pedido"
          linhas={p.itens}
          chave={(i) => i.itemId}
          colunas={[
            {
              chave: 'i',
              titulo: 'Item',
              principal: true,
              render: (i) => (
                <span className="flex flex-col min-w-0">
                  {i.codigo && <span className="mono text-caption text-ink-3">{i.codigo}</span>}
                  <span className="font-semibold">{i.descricao}</span>
                  {i.rastreavel && <span className="text-caption text-ink-2">rastreável: pede lote e certificado</span>}
                </span>
              )
            },
            { chave: 'q', titulo: 'Pedido', alinhar: 'right', mono: true, render: (i) => `${qtd(i.quantidade)} ${i.unidade ?? ''}` },
            { chave: 'r', titulo: 'Recebido', alinhar: 'right', mono: true, render: (i) => qtd(i.recebido ?? 0) },
            {
              chave: 'pe',
              titulo: 'Pendente',
              alinhar: 'right',
              mono: true,
              render: (i) => (pendenteDe(i) > 0 ? <strong>{qtd(pendenteDe(i))}</strong> : <span className="text-ok">em dia</span>)
            },
            { chave: 'pu', titulo: 'Preço unitário', alinhar: 'right', mono: true, render: (i) => brl(i.precoUnitario) },
            { chave: 'st', titulo: 'Subtotal', alinhar: 'right', mono: true, render: (i) => <strong>{brl(toNum(i.quantidade) * toNum(i.precoUnitario))}</strong> }
          ]}
        />
      </Card>

      <Recebimentos itens={p.recebimentos ?? []} />

      {receber && <RecebimentoModal pedido={p} condicao={condicao} onFechar={() => setReceber(false)} />}

      <Modal
        aberto={cancelar}
        onFechar={() => setCancelar(false)}
        titulo={`Cancelar o ${p.numero}?`}
        faixa
        rodape={
          <>
            <Button variante="secundario" onClick={() => setCancelar(false)}>Manter pedido</Button>
            <Button variante="perigo" icone={XCircle} carregando={cancela.isPending} onClick={() => cancela.mutate(undefined)}>Cancelar pedido</Button>
          </>
        }
      >
        <p className="m-0 text-ink-2">Avise o fornecedor antes, para ele não despachar. As requisições ligadas voltam a precisar de compra.</p>
      </Modal>
    </>
  );
}

function Recebimentos({ itens }: { itens: Rec[] }) {
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-3">
      <CardHeader titulo="Recebimentos" sub="Cada entrega conferida, com divergências e a conta a pagar gerada." />
      {itens.length === 0 ? (
        <p className="m-0 text-ink-2 text-[14px]">Nada recebido ainda. Quando o material chegar, confira com a nota e registre por aqui.</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
          {itens.map((r) => {
            const div = (r.divergencias ?? []).map(textoDivergencia).filter(Boolean);
            return (
              <li key={r.id} className="rounded-field border border-border p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Truck className="size-4 text-ink-3" aria-hidden />
                  <span className="mono font-semibold">{data(r.data)}</span>
                  {r.notaFiscal && <span className="text-ink-2 text-[14px]">NF <span className="mono">{r.notaFiscal}</span></span>}
                  {div.length ? <Pill tom="warn">{div.length === 1 ? '1 divergência' : `${div.length} divergências`}</Pill> : <Pill tom="ok">Conferido sem divergência</Pill>}
                </div>
                {div.length > 0 && (
                  <ul className="m-0 pl-5 text-[14px] text-ink-2">
                    {div.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
                {r.contaPagar && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-field bg-surface-2 px-3 py-2 text-[14px]">
                    <span>Conta a pagar <strong className="mono">{brl(r.contaPagar.valor)}</strong></span>
                    <span>vence <span className="mono">{data(r.contaPagar.vencimento)}</span></span>
                    {r.contaPagar.categoria && <span className="text-ink-3">{r.contaPagar.categoria}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

type Linha = { quantidade: string; preco: string; lote: string; numero: string; corrida: string; norma: string };

function RecebimentoModal({ pedido, condicao, onFechar }: { pedido: Pedido; condicao?: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const lq = useQuery({ queryKey: ['estoque', 'locais'], queryFn: () => api<LocalEstoque[] | Lista<LocalEstoque>>('/estoque/locais') });
  const locais = comoLista(lq.data);
  const cad = useItens();
  const mapa = useMemo(() => new Map<string, Item>((cad.data ?? []).map((i) => [i.id, i])), [cad.data]);
  const abertos = pedido.itens.filter((i) => pendenteDe(i) > 0);
  const [local, setLocal] = useState('');
  const [nf, setNf] = useState('');
  const [obs, setObs] = useState('');
  const [tentou, setTentou] = useState(false);
  const [erroApi, setErroApi] = useState<{ codigo?: string; msg: string } | null>(null);
  const [linhas, setLinhas] = useState<Record<string, Linha>>(() =>
    Object.fromEntries(abertos.map((i) => [i.itemId, { quantidade: String(pendenteDe(i)), preco: String(toNum(i.precoUnitario)), lote: '', numero: '', corrida: '', norma: '' }]))
  );
  const set = (id: string, p: Partial<Linha>) => setLinhas((l) => ({ ...l, [id]: { ...l[id]!, ...p } }));
  const rastreavel = (i: ItemPedido) => i.rastreavel ?? mapa.get(i.itemId)?.rastreavel ?? false;

  const recebidos = abertos.filter((i) => toNum(linhas[i.itemId]?.quantidade) > 0);
  const valorItens = recebidos.reduce((a, i) => a + toNum(linhas[i.itemId]!.quantidade) * toNum(linhas[i.itemId]!.preco), 0);
  const valorPedidoItens = pedido.itens.reduce((a, i) => a + toNum(i.quantidade) * toNum(i.precoUnitario), 0);
  const fatia = recebidos.reduce((a, i) => a + toNum(linhas[i.itemId]!.quantidade) * toNum(i.precoUnitario), 0);
  const frete = toNum(pedido.frete) > 0 && valorPedidoItens > 0 ? (toNum(pedido.frete) * Math.min(fatia, valorPedidoItens)) / valorPedidoItens : 0;
  const dias = diasDaCondicao(condicao);
  const categorias = [...new Set(recebidos.map((i) => mapa.get(i.itemId)?.categoriaDespesa).filter(Boolean))] as string[];

  const faltaCert = (i: ItemPedido) => {
    const l = linhas[i.itemId]!;
    return rastreavel(i) && toNum(l.quantidade) > 0 && (!l.lote.trim() || !l.numero.trim() || !l.corrida.trim() || !l.norma.trim());
  };
  const problemas = [
    !local && 'Escolha o local onde o material vai ficar.',
    !recebidos.length && 'Informe a quantidade de pelo menos um item.',
    abertos.some(faltaCert) && 'Itens rastreáveis precisam de lote e dos dados do certificado.'
  ].filter(Boolean) as string[];

  const enviar = useMutation({
    mutationFn: (b: unknown) => api(`/compras/pedidos/${pedido.id}/recebimentos`, { method: 'POST', body: b }),
    onSuccess: () => {
      ['compras', 'itens', 'estoque', 'fornecedores', 'painel', 'orcamentos'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast('Recebimento registrado: o material entrou no estoque e a conta a pagar ficou guardada para o Financeiro.', 'ok');
      onFechar();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.codigo === 'CERTIFICADO_OBRIGATORIO') {
        setTentou(true);
        setErroApi({ codigo: e.codigo, msg: 'Esse material é rastreável: sem o certificado da usina não dá para provar a origem do lote. Preencha lote, número, corrida e norma.' });
      } else if (e instanceof ApiError && e.codigo === 'PEDIDO_NAO_APROVADO') {
        setErroApi({ codigo: e.codigo, msg: 'Este pedido ainda não foi aprovado, então não dá para dar entrada. Peça ao gestor para aprovar e registre de novo.' });
      } else {
        setErroApi(null);
        toast(msgErro(e), 'bad');
      }
    }
  });

  const confirmar = () => {
    setTentou(true);
    setErroApi(null);
    if (problemas.length) return;
    enviar.mutate({
      localId: local,
      notaFiscal: nf.trim() || undefined,
      observacao: obs.trim() || undefined,
      itens: recebidos.map((i) => {
        const l = linhas[i.itemId]!;
        return {
          itemId: i.itemId,
          quantidade: l.quantidade,
          precoUnitario: l.preco,
          ...(rastreavel(i) ? { lote: { codigo: l.lote.trim(), certificado: { numero: l.numero.trim(), corrida: l.corrida.trim(), norma: l.norma.trim() } } } : {})
        };
      })
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Receber ${pedido.numero}`}
      largura={760}
      rodape={
        <>
          <Button variante="terciario" onClick={onFechar}>Voltar</Button>
          <Button variante="primario" icone={PackageCheck} carregando={enviar.isPending} onClick={confirmar}>Dar entrada no estoque</Button>
        </>
      }
    >
      <p className="m-0 text-ink-2 text-[14px]">Confira com a nota fiscal. Quantidade diferente do pendente ou preço mais de 2% fora do pedido ficam registrados e pesam na avaliação do fornecedor.</p>
      {erroApi && <Aviso tom={erroApi.codigo === 'PEDIDO_NAO_APROVADO' ? 'warn' : 'bad'} faixa>{erroApi.msg}</Aviso>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SelectField
          label="Guardar em"
          required
          value={local}
          onChange={setLocal}
          vazio={lq.isLoading ? 'Carregando locais…' : 'Escolha o local'}
          opcoes={locais.map((l) => ({ valor: l.id, rotulo: l.nome }))}
          erro={tentou && !local ? 'Escolha onde o material vai ficar.' : null}
        />
        <TextField label="Nota fiscal" value={nf} onChange={setNf} mono placeholder="Número da NF" />
      </div>

      {abertos.length === 0 && <Aviso tom="ok">Nenhum item pendente neste pedido.</Aviso>}
      {abertos.map((i) => {
        const l = linhas[i.itemId]!;
        const cadItem = mapa.get(i.itemId);
        const flags = flagsDivergencia({ pendente: pendenteDe(i), quantidade: l.quantidade || 0, precoPedido: i.precoUnitario, preco: l.preco || 0 });
        const saldo = i.saldo ?? cadItem?.saldo?.fisico ?? '0';
        const medio = i.custoMedio ?? cadItem?.custoMedio ?? '0';
        const q = toNum(l.quantidade);
        const novo = q > 0 && toNum(l.preco) > 0 ? custoMedioAposEntrada({ saldo: String(toNum(saldo)), custoMedio: String(toNum(medio)), quantidade: String(q), custoUnitario: String(toNum(l.preco)) }) : null;
        const rast = rastreavel(i);
        const erroCert = (v: string) => (tentou && rast && q > 0 && !v.trim() ? 'Obrigatório para material rastreável.' : null);
        return (
          <fieldset key={i.itemId} className="m-0 rounded-field border border-border p-3 flex flex-col gap-3 min-w-0">
            <legend className="px-1 font-semibold">{i.descricao}</legend>
            <div className="flex flex-wrap items-center gap-2 text-caption text-ink-3 -mt-1">
              <span className="mono">pendente {qtd(pendenteDe(i))} {i.unidade ?? ''} · pedido a {brl(i.precoUnitario)}</span>
              {q > 0 && flags.quantidade && <Pill tom="warn">{q < pendenteDe(i) ? 'Menos que o pendente' : 'Mais que o pendente'}</Pill>}
              {q > 0 && flags.preco && <Pill tom={Math.abs(flags.variacao) > 0.05 ? 'bad' : 'warn'}>Preço {flags.variacao > 0 ? '+' : ''}{pct(flags.variacao)} do pedido</Pill>}
              {q > 0 && !flags.quantidade && !flags.preco && <Pill tom="ok">Confere com o pedido</Pill>}
              {q === 0 && <Pill tom="neutral">Não veio nesta entrega</Pill>}
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              <NumberField label="Quantidade recebida" sufixo={i.unidade} value={l.quantidade} onChange={(v) => set(i.itemId, { quantidade: v })} />
              <NumberField label="Preço unitário na nota" prefixo="R$" value={l.preco} onChange={(v) => set(i.itemId, { preco: v })} />
            </div>
            {rast && q > 0 && (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 rounded-field bg-surface-2 p-3">
                <TextField label="Lote" required mono value={l.lote} onChange={(v) => set(i.itemId, { lote: v })} erro={erroCert(l.lote)} />
                <TextField label="Certificado nº" required mono value={l.numero} onChange={(v) => set(i.itemId, { numero: v })} erro={erroCert(l.numero)} />
                <TextField label="Corrida" required mono value={l.corrida} onChange={(v) => set(i.itemId, { corrida: v })} erro={erroCert(l.corrida)} />
                <TextField label="Norma" required value={l.norma} onChange={(v) => set(i.itemId, { norma: v })} erro={erroCert(l.norma)} placeholder="ex.: ASTM B16" />
              </div>
            )}
            {novo && (
              <p className="m-0 text-[13.5px] text-ink-2">
                Custo médio <span className="mono">{brl(medio)}</span> → <strong className="mono text-ink-1">{brl(novo.custoMedio)}</strong>
                <span className="text-ink-3"> · saldo vai de <span className="mono">{qtd(saldo)}</span> para <span className="mono">{qtd(novo.saldo)}</span></span>
              </p>
            )}
          </fieldset>
        );
      })}

      <TextArea label="Observação" value={obs} onChange={setObs} rows={2} hint="Avaria na embalagem, falta de documento, quem conferiu." />

      <div className="rounded-field bg-surface-2 p-3 flex flex-col gap-1.5 text-[14px]" aria-live="polite">
        <strong>Conta a pagar deste recebimento</strong>
        <div className="flex justify-between gap-3"><span className="text-ink-2">Itens</span><span className="mono">{brl(valorItens)}</span></div>
        {frete > 0 && <div className="flex justify-between gap-3"><span className="text-ink-2">Frete proporcional (estimado)</span><span className="mono">{brl(frete)}</span></div>}
        <div className="flex justify-between gap-3 border-t border-border pt-1.5"><span className="font-semibold">Total</span><strong className="mono text-[17px]">{brl(valorItens + frete)}</strong></div>
        <span className="text-caption text-ink-3">
          {dias !== null ? `Vence em ${data(somarDias(dias))}${dias ? ` (${condicao})` : ' (à vista)'}` : 'Vencimento conforme a condição de pagamento do fornecedor'}
          {categorias.length ? ` · ${categorias.join(', ')}` : ''}
        </span>
      </div>
      {tentou && problemas.length > 0 && (
        <ul role="alert" className="m-0 pl-5 text-caption text-bad font-medium">
          {problemas.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
    </Modal>
  );
}
