import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, Cpu, Link2, Handshake, Layers, Minus, Package, Plus, RefreshCw, Save, Send, ShieldCheck, ThumbsDown, ThumbsUp, Truck, UserRound, Wrench, type LucideIcon
} from 'lucide-react';
import { paraLinhaMotor, mapaCentros, useOrcamentoAoVivo, type PrecoForm } from '../features/orcamento/calculo';
import { CartaoPrazo } from '../features/orcamento/Prazo';
import { previaParcelas } from '../features/financeiro/fin';
import { comId, LinhaEditor, novaLinha, type LinhaForm, type OpcaoCentro } from '../features/orcamento/LinhaEditor';
import { api, msgErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { LinhaApi, Orcamento, Segmento } from '../lib/types';
import { brl, competenciaLonga, data, pct, toNum } from '../lib/format';
import { useAcao, useUsuariosOpcoes, useCentros, useClientes, useParametros, useTabela, useTabelaVigente } from '../lib/queries';
import { SEGMENTO } from '../lib/rotulos';
import { Card, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { DecimalInput, Field, NumberField, Segmented, Select, SelectField, TextArea, TextField } from '../components/Field';
import { GlassPanel } from '../components/GlassPanel';
import { CompositionBar, COR_ORCAMENTO, fatias } from '../components/CompositionBar';
import { MarginRuler } from '../components/MarginRuler';
import { ExplainTree } from '../components/ExplainTree';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { Pill, StatusOrcamentoPill, rotuloOrcamento } from '../components/Pill';
import { Illustration } from '../components/Illustrations';
import { Modal } from '../components/Modal';
import { useTitulo } from '../layout/titulo';
import { PerderDialog, type CorpoPerda } from '../components/PerderDialog';
import { LinkPortal } from '../components/LinkPortal';
import { useVerCusto } from '../components/Mascara';
import { HistoricoLink } from '../components/HistoricoLink';
import type { MetodoPreco, PontoCurva } from '@promec/motor';

interface Form extends Omit<PrecoForm, 'linhas'> {
  clienteId: string;
  titulo: string;
  segmento: Segmento;
  validade: string;
  observacoes: string;
  prazoPrometido: string;
  condicaoPagamento: string;
  vendedorId: string;
  linhas: LinhaForm[];
}

interface Bloco { chave: string; titulo: string; sub?: string; tipos: LinhaApi['tipo'][]; cor: string; fg?: string; icone: LucideIcon; vazio: string; adicionar: [LinhaApi['tipo'], string][] }
const BLOCOS: Bloco[] = [
  { chave: 'material', titulo: 'Material', tipos: ['material', 'materialCorte'], cor: '#1D6FB8', icone: Package, vazio: 'Nenhum material ainda. Barra, chapa ou peça comprada entram aqui.', adicionar: [['material', 'Material'], ['materialCorte', 'Material por corte']] },
  { chave: 'ferramental', titulo: 'Ferramental específico', tipos: ['ferramental'], cor: '#E0A100', fg: '#1E1B16', icone: Wrench, vazio: 'Nada por aqui ainda. Se a peça pede um alargador especial, é só adicionar.', adicionar: [['ferramental', 'Adicionar']] },
  { chave: 'operacao', titulo: 'Operações na máquina', sub: 'setup uma vez por lote, ciclo por peça', tipos: ['operacao'], cor: '#E35D14', icone: Cpu, vazio: 'Nenhuma operação. Escolha a máquina e informe o ciclo e o setup.', adicionar: [['operacao', 'Adicionar operação']] },
  { chave: 'maoDeObra', titulo: 'Mão de obra avulsa', tipos: ['maoDeObra'], cor: '#7C5CC4', icone: UserRound, vazio: 'O operador já está incluído na hora da máquina. Use aqui só para trabalho fora dela.', adicionar: [['maoDeObra', 'Adicionar']] },
  { chave: 'terceiros', titulo: 'Terceiros e frete', tipos: ['terceiro', 'frete'], cor: '#0F9D76', icone: Truck, vazio: 'Tratamento térmico, galvanização, retífica, entrega…', adicionar: [['terceiro', 'Terceiro'], ['frete', 'Frete']] }
];

const hojeMais = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const doOrcamento = (o: Orcamento): Form => ({
  clienteId: o.clienteId ?? o.cliente?.id ?? '',
  titulo: o.titulo,
  segmento: o.segmento,
  lote: String(o.lote),
  validade: (o.validade ?? '').slice(0, 10),
  impostos: o.impostos,
  comissao: o.comissao,
  margemAlvo: o.margemAlvo,
  margemMinima: o.margemMinima,
  desconto: o.desconto ?? '0',
  metodo: o.metodo ?? 'divisor',
  observacoes: o.observacoes ?? '',
  prazoPrometido: (o.prazoPrometido ?? '').slice(0, 10),
  condicaoPagamento: o.condicaoPagamento ?? '',
  vendedorId: o.vendedorId ?? o.vendedor?.id ?? '',
  linhas: o.linhas.map(comId)
});

function CurvaLote({ pontos, lote }: { pontos: PontoCurva[]; lote: number }) {
  const max = Math.max(...pontos.map((p) => toNum(p.precoUnitario)), 1);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-ink-2">Mais peças, menos por peça: o setup se dilui</span>
      <div className="grid grid-cols-4 gap-2 items-end h-[104px]" role="img" aria-label={`Preço por peça sem desconto: ${pontos.map((p) => `${p.quantidade} peças ${brl(p.precoUnitario)}`).join(', ')}`}>
        {pontos.map((p) => {
          const on = p.quantidade === lote;
          return (
            <div key={p.quantidade} className="flex flex-col items-center justify-end gap-1 h-full">
              <span className={`mono text-[11.5px] font-semibold ${on ? 'text-primary-text' : 'text-ink-3'}`}>{brl(p.precoUnitario).replace('R$ ', '')}</span>
              <div className="w-full rounded-t-lg rounded-b-[3px] transition-[height] duration-panel ease-promec" style={{ height: `${Math.max(6, (toNum(p.precoUnitario) / max) * 62)}px`, background: on ? 'linear-gradient(180deg,#F08A3E,#E35D14)' : 'var(--pm-chart-orcado)' }} />
              <span className="mono text-[11.5px] text-ink-3">{p.quantidade} pç</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrcamentoEditor() {
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario, pode } = useAuth();
  const liberador = pode('orcamento.aprovar_desconto');

  const q = useQuery({ queryKey: ['orcamentos', id], queryFn: () => api<Orcamento>(`/orcamentos/${id}`), enabled: !novo });
  const o = q.data;
  const params = useParametros();
  const clientes = useClientes('');
  const centros = useCentros();
  const vigente = useTabelaVigente(novo);
  const daTabela = useTabela(o?.tabelaCustos?.id);
  const tabela = novo ? vigente.data : daTabela.data;
  const mapa = useMemo(() => mapaCentros(tabela?.resultado), [tabela]);

  const [f, setF] = useState<Form | null>(null);
  const [sujo, setSujo] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [arvore, setArvore] = useState(false);
  const [modal, setModal] = useState<null | 'liberar' | 'recusar' | 'portal'>(null);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (o && !sujo) setF(doOrcamento(o));
  }, [o]);
  useEffect(() => {
    if (novo && !f && params.data) {
      const p = params.data;
      setF({
        clienteId: sp.get('cliente') ?? '', titulo: '', segmento: 'USINAGEM', lote: '1', validade: hojeMais(p.validadeOrcamentoDias ?? 15),
        impostos: p.impostosPadrao, comissao: p.comissaoPadrao, margemAlvo: p.margemAlvo, margemMinima: p.margemMinima, desconto: '0',
        metodo: p.metodoPreco ?? 'divisor', observacoes: '', prazoPrometido: '', condicaoPagamento: '', vendedorId: '', linhas: [novaLinha('material'), novaLinha('operacao')]
      });
    }
  }, [novo, f, params.data, sp]);
  useEffect(() => {
    if (!sujo) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [sujo]);
  useTitulo(novo ? 'Novo orçamento' : o ? `${o.numero} · ${o.titulo}` : 'Orçamento');

  const verCusto = useVerCusto();
  const local = useOrcamentoAoVivo(verCusto ? f : null, mapa);
  // Sem permissão para o custo-hora, o navegador não tem os números: o servidor calcula (/orcamentos/simular).
  const [corpoSim, setCorpoSim] = useState<string | null>(null);
  useEffect(() => {
    if (verCusto || !f || !f.clienteId) return;
    const t = window.setTimeout(() => setCorpoSim(JSON.stringify(corpo(f))), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verCusto, f]);
  const sim = useQuery({
    queryKey: ['orcamentos', 'simular', corpoSim],
    queryFn: () => api<Orcamento['resultado']>('/orcamentos/simular', { method: 'POST', body: { ...JSON.parse(corpoSim!), tabelaCustosId: o?.tabelaCustos?.id } }),
    enabled: !verCusto && !!corpoSim,
    placeholderData: (ant) => ant,
    retry: false
  });
  const r = verCusto ? local.resultado : (sim.data ?? o?.resultado ?? null);
  const erroCalc = verCusto ? local.erro : sim.error ? msgErro(sim.error) : null;
  const vendedores = useUsuariosOpcoes();

  const status = o?.status ?? 'RASCUNHO';
  const editavel = novo || status === 'RASCUNHO' || status === 'EM_NEGOCIACAO';

  const corpo = (x: Form) => ({
    clienteId: x.clienteId, titulo: x.titulo.trim(), segmento: x.segmento, lote: Math.floor(toNum(x.lote)), validade: x.validade,
    impostos: x.impostos || '0', comissao: x.comissao || '0', margemAlvo: x.margemAlvo || '0', margemMinima: x.margemMinima || '0', desconto: x.desconto || '0',
    metodo: x.metodo, observacoes: x.observacoes, prazoPrometido: x.prazoPrometido || null, condicaoPagamento: x.condicaoPagamento.trim() || null, vendedorId: x.vendedorId || undefined,
    linhas: x.linhas.map((l) => {
      const m = paraLinhaMotor(l, mapa) as Record<string, unknown>;
      if (l.itemId) m.itemId = l.itemId;
      if (l.tipo === 'operacao' || l.tipo === 'maoDeObra') {
        delete m.custoHora;
        delete m.rateioHora;
        m.centroId = l.centroId;
      }
      return m;
    }),
    ...(novo && vigente.data ? { tabelaCustosId: vigente.data.id } : {})
  });

  const aposGravar = (r2: Orcamento) => {
    setSujo(false);
    if (r2?.id) {
      qc.setQueryData(['orcamentos', r2.id], r2);
      if (r2.linhas) setF(doOrcamento(r2));
    }
  };
  const inval = [['orcamentos'], ['painel'], ['clientes']];
  const salvar = useAcao((x: Form) => api<Orcamento>(novo ? '/orcamentos' : `/orcamentos/${id}`, { method: novo ? 'POST' : 'PUT', body: corpo(x) }), {
    invalida: inval,
    sucesso: (r2) => (novo ? `Rascunho ${r2?.numero ?? ''} guardado. Ajuste o que precisar e envie quando estiver pronto.` : `Tudo salvo${r2?.versao ? ` na versão ${r2.versao}` : ''}.`),
    onSuccess: (r2) => {
      aposGravar(r2);
      if (novo && r2?.id) navigate(`/orcamentos/${r2.id}`, { replace: true });
    }
  });
  const acao = (rota: string, sucesso: string, body?: unknown) =>
    useAcao(() => api<Orcamento>(`/orcamentos/${id}/${rota}`, { method: 'POST', body }), { invalida: inval, sucesso, onSuccess: (r2) => { aposGravar(r2); setModal(null); } });
  const nomeCliente = (clientes.data?.itens ?? []).find((c) => c.id === f?.clienteId)?.fantasia || o?.cliente?.nome || 'o cliente';
  const enviar = acao('enviar', `Pronto! O orçamento foi para ${nomeCliente}. Quando responderem, você fica sabendo.`);
  const negociar = acao('negociar', 'Em negociação. Pode ajustar: ao salvar, sai uma versão nova.');
  const aprovar = acao('aprovar', 'Aprovado! Agora é com a produção.');
  const recusar = useAcao((corpoPerda: CorpoPerda) => api<Orcamento>(`/orcamentos/${id}/recusar`, { method: 'POST', body: corpoPerda }), { invalida: inval, sucesso: 'Recusa registrada. O motivo ajuda a acertar os próximos.', onSuccess: (r2) => { aposGravar(r2); setModal(null); } });
  const liberar = useAcao((justificativa: string) => api<Orcamento>(`/orcamentos/${id}/liberar-margem`, { method: 'POST', body: { justificativa } }), { invalida: inval, sucesso: 'Margem liberada. O orçamento já pode ser enviado.', onSuccess: (r2) => { aposGravar(r2); setModal(null); } });
  const converter = useAcao(() => api<{ id: string; numero: string }>(`/orcamentos/${id}/converter`, { method: 'POST' }), {
    invalida: [...inval, ['ordens-servico']],
    sucesso: (r2) => `${r2?.numero ?? 'OS'} criada e na fila. O roteiro veio do orçamento.`,
    onSuccess: (r2) => r2?.id && navigate(`/ordens-servico/${r2.id}`)
  });
  const atualizar = acao('atualizar-custos', 'Custos atualizados para a tabela vigente. Uma versão nova foi gerada.');

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f) return <Card>{params.isError ? <ErroEstado erro={params.error} tentar={() => params.refetch()} /> : <Carregando />}</Card>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF({ ...f, [k]: v }); setSujo(true); };
  const setLinha = (i: number, l: LinhaForm) => set('linhas', f.linhas.map((x, j) => (j === i ? l : x)));
  const addLinha = (t: LinhaApi['tipo']) => set('linhas', [...f.linhas, novaLinha(t)]);

  const erros = {
    cliente: tentou && !f.clienteId ? 'Para quem é o orçamento? Escolha o cliente.' : null,
    titulo: tentou && !f.titulo.trim() ? 'Dê um nome à peça ou ao serviço, como “Bucha de latão H7”.' : null
  };
  const valido = () => {
    setTentou(true);
    return !!f.clienteId && !!f.titulo.trim() && !!r && !parcelas.erro;
  };
  const gravar = () => valido() && salvar.mutate(f);
  const gravarEEnviar = async () => {
    if (!valido()) return;
    if (sujo) await salvar.mutateAsync(f).catch(() => null);
    enviar.mutate(undefined);
  };

  const opcoesCentro: OpcaoCentro[] = (tabela?.resultado.centros ?? []).map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${brl(c.cheioHora)}/h`, cheioHora: c.cheioHora }));
  for (const l of f.linhas) {
    if ('centroId' in l && l.centroId && !opcoesCentro.some((c) => c.valor === l.centroId)) {
      const nome = centros.data?.itens.find((c) => c.id === l.centroId)?.nome ?? 'Centro';
      opcoesCentro.push({ valor: l.centroId, rotulo: `${nome} · fora da tabela`, cheioHora: l.custoHora });
    }
  }
  const opcoesCliente = (clientes.data?.itens ?? [])
    .filter((c) => c.status !== 'INATIVO' || c.id === f.clienteId)
    .map((c) => ({ valor: c.id, rotulo: `${c.fantasia || c.nome}${c.status === 'BLOQUEADO' ? ' · bloqueado' : ''}` }));
  const clienteSel = clientes.data?.itens.find((c) => c.id === f.clienteId);

  const sit = r?.situacaoMargem ?? 'ok';
  const precisaLiberar = !!r?.exigeAprovacao && !o?.margemLiberada;
  const primeiroNome = usuario?.nome?.split(' ')[0] ?? '';
  const msg = {
    ok: `Boa${primeiroNome ? `, ${primeiroNome}` : ''}! A margem está no alvo. Pode enviar tranquilo.`,
    atencao: `Dá para enviar, mas a margem ficou abaixo do alvo de ${pct(f.margemAlvo)}. Que tal um desconto menor?`,
    perigo: o?.margemLiberada
      ? `Margem abaixo do mínimo, mas liberada pelo gestor${o.justificativaLiberacao ? `: “${o.justificativaLiberacao}”` : '.'}`
      : `Com esse desconto a margem fica abaixo do mínimo de ${pct(f.margemMinima)}. ${liberador ? 'Você pode liberar com uma justificativa.' : 'Peça um ok ao gestor antes de enviar.'}`
  }[sit];
  const corMargem = { ok: 'text-ok', atencao: 'text-warn', perigo: 'text-bad' }[sit];
  const fundoMargem = { ok: 'bg-ok-soft', atencao: 'bg-warn-soft', perigo: 'bg-bad-soft' }[sit];
  const lote = Math.floor(toNum(f.lote)) || 0;
  const parcelas = previaParcelas(f.condicaoPagamento || clienteSel?.condicaoPagamento || '', r?.precoFinalLote ?? '', new Date().toISOString().slice(0, 10));
  const custoLinha = (i: number) => r?.linhas[i]?.custoLote;
  const ocupado = salvar.isPending || enviar.isPending;

  const acoes = (() => {
    if (novo) return [<Button key="s" variante="primario" tamanho="lg" icone={Save} carregando={salvar.isPending} onClick={gravar} className="w-full">Salvar rascunho</Button>];
    if (status === 'RASCUNHO' || status === 'EM_NEGOCIACAO') {
      const principal = precisaLiberar ? (
        liberador ? <Button key="l" variante="primario" tamanho="lg" icone={ShieldCheck} onClick={() => { setTexto(''); setModal('liberar'); }} className="w-full" disabled={sujo}>Liberar margem</Button>
          : <Button key="s" variante="primario" tamanho="lg" icone={Save} carregando={salvar.isPending} onClick={gravar} className="w-full">Salvar</Button>
      ) : (
        <Button key="e" variante="primario" tamanho="lg" icone={Send} carregando={ocupado} onClick={gravarEEnviar} className="w-full">Enviar para {nomeCliente}</Button>
      );
      return [
        principal,
        <div key="sec" className="flex flex-wrap gap-2">
          {!(precisaLiberar && !liberador) && <Button tamanho="sm" icone={Save} carregando={salvar.isPending} onClick={gravar} className="flex-1" disabled={!sujo}>{status === 'EM_NEGOCIACAO' ? 'Salvar nova versão' : 'Salvar'}</Button>}
          {status === 'EM_NEGOCIACAO' && <Button tamanho="sm" icone={ThumbsUp} onClick={() => aprovar.mutate(undefined)} className="flex-1">Aprovar</Button>}
          {status === 'EM_NEGOCIACAO' && <Button tamanho="sm" variante="perigo" icone={ThumbsDown} onClick={() => { setTexto(''); setModal('recusar'); }} className="flex-1">Recusar</Button>}
        </div>,
        ...(status === 'EM_NEGOCIACAO' ? [<Button key="p" tamanho="sm" variante="terciario" icone={Link2} onClick={() => setModal('portal')} className="w-full">Enviar link ao cliente</Button>] : [])
      ];
    }
    if (status === 'ENVIADO')
      return [
        <Button key="a" variante="primario" tamanho="lg" icone={ThumbsUp} carregando={aprovar.isPending} onClick={() => aprovar.mutate(undefined)} className="w-full">Cliente aprovou</Button>,
        <div key="sec" className="flex flex-wrap gap-2">
          <Button tamanho="sm" icone={Handshake} carregando={negociar.isPending} onClick={() => negociar.mutate(undefined)} className="flex-1">Negociar e ajustar</Button>
          <Button tamanho="sm" variante="perigo" icone={ThumbsDown} onClick={() => { setTexto(''); setModal('recusar'); }} className="flex-1">Recusar</Button>
        </div>,
        <Button key="p" tamanho="sm" variante="terciario" icone={Link2} onClick={() => setModal('portal')} className="w-full">Enviar link ao cliente</Button>
      ];
    if (status === 'APROVADO')
      return [
        <Button key="c" variante="primario" tamanho="lg" icone={Wrench} carregando={converter.isPending} onClick={() => converter.mutate(undefined)} className="w-full">Converter em OS</Button>,
        <p key="ro" className="m-0 text-[13.5px] text-ink-2">Aprovado: o orçamento fica como foi combinado. A OS copia o roteiro e os materiais.</p>
      ];
    return [
      <p key="ro" className="m-0 text-[13.5px] text-ink-2 p-3 rounded-field bg-surface-1">
        {status === 'RECUSADO' ? `Recusado${o?.motivoRecusa ? `: “${o.motivoRecusa}”` : '.'}` : status === 'CONVERTIDO' ? 'Convertido em OS: acompanhe a execução em Ordens de Serviço.' : `${rotuloOrcamento(status)}: só para consulta.`}
      </p>
    ];
  })();

  return (
    <>
      <section className="anim-subir flex flex-wrap gap-5 items-stretch" aria-label="Peça e cliente">
        <div className="flex-[1_1_340px] flex flex-col gap-3 justify-center">
          <div className="flex flex-wrap gap-2">
            {o ? <StatusOrcamentoPill status={o.status} versao={o.versao} /> : <Pill tom="neutral">Novo rascunho</Pill>}
            <Pill tom="run">{SEGMENTO[f.segmento]}</Pill>
            {tabela ? <Pill tom="ok" icone={Layers}>Custos {tabela.competencia} · v{tabela.versao}</Pill> : o?.tabelaCustos ? <Pill tom="ok" icone={Layers}>Custos {o.tabelaCustos.competencia} · v{o.tabelaCustos.versao}</Pill> : null}
            {sujo && <Pill tom="warn">alterações não salvas</Pill>}
          </div>
          {o && <span className="mono text-[13px] text-ink-3">{o.numero}</span>}
          <h1 className="m-0 text-[clamp(32px,3.6vw,46px)] font-bold leading-none">{f.titulo || 'Novo orçamento'}</h1>
          <p className="m-0 text-[15.5px] text-ink-2">
            {clienteSel ? <>Para a <strong className="text-ink-1">{clienteSel.fantasia || clienteSel.nome}</strong>. {editavel ? 'Mexa em qualquer número: o preço ao lado recalcula na hora.' : 'Este orçamento está travado para edição. Para mudar algo, coloque em negociação e salve uma nova versão.'}</> : 'Escolha o cliente, coloque o material e as operações. O preço aparece enquanto você digita.'}
          </p>
        </div>
        <figure className="hero flex-[1_1_320px] m-0 relative overflow-hidden rounded-card p-4 flex flex-col justify-between min-h-[160px]">
          <Illustration tipo="torno" className="w-full h-auto" />
          <figcaption className="mono flex justify-between text-[11.5px] text-[#C9D7E6] border-t border-white/20 pt-1.5">
            <span>{o?.numero ?? 'ORC-novo'} · v{o?.versao ?? 1}</span>
            <span>lote {lote} pç</span>
          </figcaption>
        </figure>
      </section>

      {o?.tabelaMaisNova && (
        <Aviso
          tom="warn"
          titulo="Saiu uma Tabela de Custos mais nova"
          acao={(status === 'RASCUNHO' || status === 'EM_NEGOCIACAO') && <Button icone={RefreshCw} carregando={atualizar.isPending} onClick={() => atualizar.mutate(undefined)}>Recalcular com a vigente</Button>}
        >
          Este orçamento usa os custos de {competenciaLonga(o.tabelaCustos.competencia)}. Ao recalcular, sai uma versão nova com os custos de hoje; a atual fica guardada.
        </Aviso>
      )}
      {o?.custoDesatualizado && editavel && (
        <Aviso tom="warn" titulo="O custo de algum material mudou">
          Um recebimento recente mudou mais de 5% o preço de um item deste orçamento. Escolha o item de novo na linha para puxar o custo médio atual, confira a margem e salve.
        </Aviso>
      )}
      {novo && vigente.isError && (
        <Aviso tom="bad" faixa titulo="Ainda não há Tabela de Custos vigente">
          Sem ela não dá para saber quanto custa a hora das máquinas. Publique a tabela do mês e volte aqui.
        </Aviso>
      )}
      {clienteSel?.status === 'BLOQUEADO' && (
        <Aviso tom="bad" titulo={`${clienteSel.fantasia || clienteSel.nome} está bloqueado`}>Fale com o financeiro antes de enviar um orçamento para esse cliente.</Aviso>
      )}

      <div className="flex flex-wrap gap-[22px] items-start">
        <div className="flex-[999_1_600px] min-w-0 flex flex-col gap-5">
          <Card className="p-5 grid grid-cols-1 sm:grid-cols-6 gap-3.5" aria-label="Condições">
            <SelectField className="sm:col-span-3" label="Cliente" required value={f.clienteId} onChange={(v) => set('clienteId', v)} opcoes={opcoesCliente} vazio="Escolha o cliente" erro={erros.cliente} disabled={!editavel} />
            <TextField className="sm:col-span-3" label="Peça ou serviço" required value={f.titulo} onChange={(v) => set('titulo', v)} erro={erros.titulo} placeholder="Bucha de latão H7, lote piloto" disabled={!editavel} />
            <Field className="sm:col-span-2" label="Quantas peças?">
              {({ id: fid }) => (
                <div className="campo !px-1.5 justify-between !border-2 !border-primary">
                  <button type="button" onClick={() => set('lote', String(Math.max(1, lote - 1)))} aria-label="Menos peças" disabled={!editavel} className="size-9 grid place-items-center rounded-control hover:bg-surface-3"><Minus className="size-4" aria-hidden /></button>
                  <DecimalInput id={fid} value={f.lote} onChange={(v) => set('lote', v)} className="text-center font-bold text-[16px]" disabled={!editavel} />
                  <span className="un">pç</span>
                  <button type="button" onClick={() => set('lote', String(lote + 1))} aria-label="Mais peças" disabled={!editavel} className="size-9 grid place-items-center rounded-control hover:bg-surface-3"><Plus className="size-4" aria-hidden /></button>
                </div>
              )}
            </Field>
            <TextField className="sm:col-span-2" label="Válido até" type="date" mono value={f.validade} onChange={(v) => set('validade', v)} disabled={!editavel} />
            <div className="sm:col-span-2">
              <Segmented<Segmento> label="Segmento" tamanho="sm" value={f.segmento} onChange={(v) => set('segmento', v)} disabled={!editavel} opcoes={(Object.keys(SEGMENTO) as Segmento[]).map((k) => ({ valor: k, rotulo: SEGMENTO[k] }))} />
            </div>
          </Card>

          <Card className="overflow-hidden" aria-label="Linhas do orçamento">
            {BLOCOS.map((b) => {
              const idx = f.linhas.map((l, i) => [l, i] as const).filter(([l]) => b.tipos.includes(l.tipo));
              const total = idx.reduce((a, [, i]) => a + toNum(custoLinha(i)), 0);
              return (
                <section
                  key={b.chave}
                  aria-labelledby={`b-${b.chave}`}
                  className="border-b border-border"
                  onKeyDown={(e: KeyboardEvent) => { if (editavel && e.altKey && e.key === 'ArrowDown') { e.preventDefault(); addLinha(b.adicionar[0]![0]); } }}
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 bg-surface-2">
                    <span className="chip-ico" style={{ background: b.cor, color: b.fg ?? '#fff' }}><b.icone className="size-[18px]" aria-hidden /></span>
                    <div className="flex-1 min-w-[180px] flex flex-col">
                      <h2 id={`b-${b.chave}`} className="m-0 font-sans text-[16px] font-semibold">
                        {b.titulo} {b.sub && <span className="font-normal text-ink-3 text-[13px]">· {b.sub}</span>}
                      </h2>
                      {idx.length === 0 && <span className="text-[13px] text-ink-3">{b.vazio}</span>}
                    </div>
                    {idx.length > 0 && <span className="mono text-[15px] font-bold">{brl(total)}</span>}
                    {editavel && b.adicionar.map(([t, rot]) => (
                      <Button key={t} tamanho="sm" variante="terciario" icone={Plus} onClick={() => addLinha(t)}>{rot}</Button>
                    ))}
                  </div>
                  {idx.map(([l, i]) => (
                    <LinhaEditor key={l._id} linha={l} onChange={(x) => setLinha(i, x)} onRemover={() => set('linhas', f.linhas.filter((_, j) => j !== i))} custoLote={custoLinha(i)} centros={opcoesCentro} editavel={editavel} />
                  ))}
                </section>
              );
            })}
            <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-4 border-t-2 border-ink-1">
              <span className="text-caption text-ink-3 hidden sm:inline"><kbd className="mono">Alt</kbd> + <kbd className="mono">↓</kbd> nova linha no bloco</span>
              <span className="flex gap-3.5 items-baseline ml-auto">
                <span className="text-[14px] text-ink-2">Custo do lote</span>
                <span className="mono text-[20px] font-bold">{brl(r?.custoLote ?? 0)}</span>
              </span>
            </div>
          </Card>

          <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-preco">
            <CardHeader id="h-preco" titulo="Formação do preço" sub="Impostos e comissão saem de dentro do preço; a margem é o que sobra." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <NumberField label="Impostos" percentual value={f.impostos} onChange={(v) => set('impostos', v)} disabled={!editavel} />
              <NumberField label="Comissão" percentual value={f.comissao} onChange={(v) => set('comissao', v)} disabled={!editavel} />
              <NumberField label="Margem alvo" percentual value={f.margemAlvo} onChange={(v) => set('margemAlvo', v)} disabled={!editavel} />
              <NumberField label="Margem mínima" percentual value={f.margemMinima} onChange={(v) => set('margemMinima', v)} disabled={!editavel} />
            </div>
            <Segmented<MetodoPreco>
              label="Método"
              tamanho="sm"
              value={f.metodo}
              onChange={(v) => editavel && set('metodo', v)}
              opcoes={[{ valor: 'divisor', rotulo: 'Divisor: custo ÷ (1 − impostos − comissão − margem)' }, { valor: 'markup', rotulo: 'Markup sobre o custo' }]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
              <TextField label="Condição de pagamento" value={f.condicaoPagamento} onChange={(v) => set('condicaoPagamento', v)} disabled={!editavel}
                placeholder={clienteSel?.condicaoPagamento ? `do cliente: ${clienteSel.condicaoPagamento}` : '28 dias, 30/60/90, entrada + 30'}
                erro={parcelas.erro} hint={parcelas.texto || (f.condicaoPagamento ? undefined : 'Vazio usa a condição do cliente.')} />
              <div className="flex flex-col gap-1.5">
                <span className="text-[13.5px] font-medium text-ink-2">Vendedor</span>
                <Select aria-label="Vendedor" value={f.vendedorId || usuario?.id || ''} onChange={(v) => set('vendedorId', v)} disabled={!editavel}
                  opcoes={[...(vendedores.data ?? []), ...(o?.vendedor && !(vendedores.data ?? []).some((x) => x.id === o.vendedor!.id) ? [o.vendedor] : [])].map((x) => ({ valor: x.id, rotulo: x.nome }))} />
              </div>
            </div>
            <TextArea label="Observações" value={f.observacoes} onChange={(v) => set('observacoes', v)} hint="Prazo de entrega, quem pediu, cuidados." />
          </Card>

          <CartaoPrazo linhas={f.linhas} lote={lote} promessaSalva={o?.promessa} usarSalva={!sujo} prazo={f.prazoPrometido} onPrazo={(d) => set('prazoPrometido', d)} editavel={editavel} />

          {o && o.historico?.length > 0 && (
            <Card className="p-5 flex flex-col gap-2" aria-labelledby="h-hist">
              <CardHeader id="h-hist" titulo="Histórico" acao={<HistoricoLink entidade="Orcamento" id={o.id} />} />
              <ol className="m-0 p-0 list-none flex flex-col">
                {o.historico.map((h, i) => (
                  <li key={i} className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 items-center py-2 border-t border-border first:border-0 text-[14px]">
                    <span className="mono text-ink-3">v{h.versao}</span>
                    <span className="flex flex-col min-w-0">
                      <span>{h.evento ? h.evento.charAt(0).toUpperCase() + h.evento.slice(1) : rotuloOrcamento(h.status)}{h.detalhe ? <span className="text-ink-3"> · {h.detalhe}</span> : null}</span>
                      <span className="mono text-caption text-ink-3">{data(h.data)}</span>
                    </span>
                    <span className="mono font-semibold">{brl(h.precoFinalLote)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <GlassPanel id="composicao" aria-label="Como chegamos nesse preço" className="flex-[1_1_360px] w-full lg:max-w-[430px] lg:sticky lg:top-24">
          <div className="flex justify-between items-center gap-2">
            <h2 className="m-0 text-[24px] font-bold">Como chegamos nesse preço</h2>
            <Pill tom="neutral"><span className="mono">{lote} pç</span></Pill>
          </div>
          {erroCalc && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erroCalc}</p>}
          {r && (
            <>
              <CompositionBar itens={fatias(r.composicao, COR_ORCAMENTO)} rotulo="Composição do preço" />
              <div className="grid grid-cols-3 gap-2">
                {[['Impostos', f.impostos], ['Comissão', f.comissao], ['Margem alvo', f.margemAlvo]].map(([l, v]) => (
                  <div key={l} className="px-3 py-2.5 rounded-[14px] bg-surface-1 flex flex-col">
                    <span className="text-caption text-ink-3">{l}</span>
                    <span className="mono text-[15px] font-semibold">{pct(v)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="rng-desc" className="text-[14px] font-medium">Desconto</label>
                  <span className="mono text-[13.5px]"><strong>{pct(f.desconto)}</strong> <span className="text-ink-3">· − {brl(toNum(r.precoLote) - toNum(r.precoFinalLote))}</span></span>
                </div>
                <input
                  id="rng-desc"
                  type="range"
                  min={0}
                  max={30}
                  step={0.5}
                  disabled={!editavel}
                  value={toNum(f.desconto) * 100}
                  onChange={(e) => set('desconto', String(Number(e.target.value) / 100))}
                  className="w-full accent-[var(--pm-primary)] h-8 cursor-pointer"
                  aria-valuetext={pct(f.desconto)}
                />
              </div>
              <div className={`flex flex-col gap-2.5 p-3.5 rounded-[18px] transition-colors duration-panel ${fundoMargem}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-medium">Margem que sobra</span>
                  <span className={`mono text-[26px] font-bold transition-colors duration-panel ${corMargem}`} aria-live="polite">{pct(r.margemEfetiva)}</span>
                </div>
                <MarginRuler efetiva={r.margemEfetiva} minima={f.margemMinima} alvo={f.margemAlvo} />
                <span className="text-[13.5px]">{msg}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] text-ink-2">Preço do lote</span>
                <span className="mono text-[clamp(40px,4.4vw,52px)] font-bold tracking-[-.04em] leading-[1.05]" aria-live="polite">{brl(r.precoFinalLote)}</span>
                <span className="mono text-[14px] text-ink-2">
                  <strong className="text-ink-1">{brl(r.precoFinalUnitario)}</strong> por peça
                  {toNum(f.desconto) > 0 && <span className="text-ink-3"> · sem desconto {brl(r.precoLote)}</span>}
                </span>
                <span className="text-caption text-ink-3 mt-1">Margem de contribuição {brl(r.margemContribuicao)}</span>
              </div>
              <CurvaLote pontos={r.curvaLote} lote={lote} />
              <button type="button" onClick={() => setArvore(!arvore)} aria-expanded={arvore} className="self-start inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-text">
                <ChevronDown className={`size-4 transition-transform ${arvore ? 'rotate-180' : ''}`} aria-hidden /> Ver a conta completa
              </button>
              {arvore && <div className="rounded-field bg-surface-1 p-2"><ExplainTree raiz={r.explicacao} rotulo="Conta completa do preço" /></div>}
            </>
          )}
          <div className="flex flex-col gap-2">{acoes}</div>
          {sujo && precisaLiberar && liberador && <span className="text-caption text-ink-2">Salve as alterações antes de liberar a margem.</span>}
        </GlassPanel>
      </div>

      <Modal
        aberto={modal === 'liberar'}
        onFechar={() => setModal(null)}
        faixa
        titulo="Liberar margem abaixo do mínimo?"
        rodape={<><Button onClick={() => setModal(null)}>Voltar</Button><Button variante="primario" icone={ShieldCheck} carregando={liberar.isPending} disabled={texto.trim().length < 5} onClick={() => liberar.mutate(texto.trim())}>Liberar</Button></>}
      >
        <p className="m-0 text-ink-2">A margem ficou em <strong className="mono">{r ? pct(r.margemEfetiva) : '—'}</strong>, abaixo do mínimo de {pct(f.margemMinima)}. Conte o porquê: fica registrado no histórico.</p>
        <TextArea label="Justificativa" value={texto} onChange={setTexto} hint="Ex.: cliente estratégico, lote piloto que abre um contrato maior." />
      </Modal>
      <PerderDialog aberto={modal === 'recusar'} onFechar={() => setModal(null)} titulo="O cliente recusou?" precoOfertado={r?.precoFinalLote ?? o?.resultado?.precoFinalLote}
        enviando={recusar.isPending} onConfirmar={(b) => recusar.mutate(b)} />
      <LinkPortal aberto={modal === 'portal'} onFechar={() => setModal(null)} rota={`/orcamentos/${id}/link-portal`} titulo="Enviar link ao cliente" />
    </>
  );
}
