import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban, CalendarClock, Check, ChevronDown, FileText, Trash2, ClipboardCheck, Cpu, PackageCheck, Pause, Play, Plus, Rocket, Timer, TriangleAlert, UserRound
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { podeLiberarMargem, useAuth } from '../lib/auth';
import type { CustoOS, MotivoPausa, OrdemServico, Prioridade } from '../lib/types';
import { brl, data, horas, num, pct, toNum } from '../lib/format';
import { useAcao, useParametros } from '../lib/queries';
import { SEGMENTO } from '../lib/rotulos';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { DecimalInput, Segmented, SelectField, TextArea, TextField, NumberField } from '../components/Field';
import { GlassPanel } from '../components/GlassPanel';
import { MarginRuler } from '../components/MarginRuler';
import { ExplainTree } from '../components/ExplainTree';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { useTitulo } from '../layout/titulo';
import { cronometro, MOTIVOS_PAUSA, segundosDesde, textoAlerta, useAgora } from '../features/os/os';
import { InspecaoDialog } from '../features/os/Inspecao';
import { ConsumosOS } from '../features/os/Consumos';
import { ItemPicker } from '../components/ItemPicker';
import { BarrasOrcadoReal, DesvioBadge, ilustracaoSegmento, PlacaMercosul, StatusOSPill, StepperOS } from '../features/os/componentes';

const EVENTOS: Record<string, string> = {
  criada: 'OS aberta',
  convertido: 'Criada a partir do orçamento',
  liberada: 'Liberada para a fila',
  execucao_iniciada: 'Execução iniciada',
  pausada: 'Pausada',
  retomada: 'Retomada',
  operacoes_encerradas: 'Todas as operações encerradas',
  inspecao_aprovada: 'Inspeção aprovada',
  inspecao_reprovada: 'Inspeção reprovada: retrabalho',
  entregue: 'Entregue ao cliente',
  cancelada: 'Cancelada'
};

const STATUS_OP = { PENDENTE: ['Pendente', 'neutral'], EM_ANDAMENTO: ['Em andamento', 'run'], PAUSADA: ['Pausada', 'warn'], CONCLUIDA: ['Concluída', 'ok'] } as const;
const CATEGORIA_CUSTO: Record<CustoOS['categoria'], string> = { material: 'Material', ferramental: 'Ferramental', terceiros: 'Terceiros', frete: 'Frete' };
const TOLERANCIA = 0.2;

const lead = (o: OrdemServico) =>
  ({
    ABERTA: 'Aberta e esperando liberação. Separe o material e libere para a fila.',
    EM_FILA: 'Na fila do chão de fábrica. Começa quando o operador iniciar o setup no Modo Operador.',
    EM_EXECUCAO: 'Rodando agora. Os números ao lado mudam a cada apontamento.',
    PAUSADA: 'Parada. Resolva o motivo e retome para não perder o prazo.',
    CONTROLE_QUALIDADE: 'Todas as operações encerradas. Falta a inspeção para concluir.',
    CONCLUIDA: 'Inspeção aprovada. Pronta para entregar.',
    ENTREGUE: `Entregue${o.recebidoPor ? ` para ${o.recebidoPor}` : ''}. O custo real ficou gravado.`,
    CANCELADA: 'Cancelada. O que já foi apontado ficou como perda.'
  })[o.status];

function itensPadrao(o: OrdemServico) {
  if (o.segmento === 'OFICINA') return ['Teste de rodagem', 'Aperto e torque conferidos', 'Sem vazamentos'];
  if (o.segmento === 'CALDEIRARIA') return ['Inspeção visual da solda', 'Dimensões gerais', 'Pintura sem falhas'];
  return [o.objeto?.desenho ? `Dimensional conforme ${o.objeto.desenho}${o.objeto.revisao ? ` rev. ${o.objeto.revisao}` : ''}` : 'Dimensional conforme desenho', 'Acabamento superficial', 'Quantidade conferida'];
}

function LinhaCusto({ c, osId, editavel, desvio }: { c: CustoOS; osId: string; editavel: boolean; desvio?: string }) {
  const [real, setReal] = useState(c.real ?? '');
  const [just, setJust] = useState('');
  const [pedeJust, setPedeJust] = useState(false);
  const acima = toNum(real) > toNum(c.orcado) * (1 + TOLERANCIA) && toNum(real) > 0;
  const salvar = useAcao(() => api(`/ordens-servico/${osId}/custos/${c.id}`, { method: 'PATCH', body: { real: real || '0', ...(just.trim() ? { justificativa: just.trim() } : {}) } }), {
    invalida: [['ordens-servico']],
    sucesso: 'Lançado. A projeção já considera o valor real.',
    onSuccess: () => setPedeJust(false)
  });
  const remover = useAcao(() => api(`/ordens-servico/${osId}/custos/${c.id}`, { method: 'DELETE' }), { invalida: [['ordens-servico']], sucesso: 'Custo removido da OS.' });
  const lancar = () => {
    if ((acima || pedeJust) && !just.trim()) return setPedeJust(true);
    salvar.mutate(undefined, { onError: (e) => e instanceof ApiError && e.codigo === 'JUSTIFICATIVA_OBRIGATORIA' && setPedeJust(true) });
  };
  const mudou = (c.real ?? '') !== real;
  return (
    <li className="flex flex-col gap-2 px-5 py-3 border-t border-border first:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex-[2_1_180px] min-w-0 flex flex-col">
          <span className="font-medium text-[14.5px]">{c.descricao}</span>
          <span className="text-caption text-ink-3">{CATEGORIA_CUSTO[c.categoria] ?? c.categoria}{toNum(c.orcado) === 0 ? ' · não orçado' : ''}</span>
        </span>
        <span className="flex flex-col text-right min-w-[96px]">
          <span className="text-caption text-ink-3">orçado</span>
          <span className="mono text-[14px] text-ink-2">{brl(c.orcado)}</span>
        </span>
        {editavel ? (
          <label className="flex flex-col min-w-[140px] flex-[0_1_160px]">
            <span className="text-caption text-ink-3">real</span>
            <span className="campo !min-h-[38px] !px-3 !rounded-control">
              <span className="un">R$</span>
              <DecimalInput value={real} onChange={setReal} className="text-right !h-8" aria-label={`Valor real de ${c.descricao}`} placeholder="—" />
            </span>
          </label>
        ) : (
          <span className="flex flex-col text-right min-w-[96px]">
            <span className="text-caption text-ink-3">real</span>
            <span className="mono text-[14px] font-semibold">{c.real === null ? '—' : brl(c.real)}</span>
          </span>
        )}
        {desvio !== undefined && c.real !== null && <DesvioBadge desvio={desvio} />}
        {editavel && mudou && <Button tamanho="sm" icone={Check} carregando={salvar.isPending} onClick={lancar}>Lançar</Button>}
        {editavel && !c.doOrcamento && toNum(c.orcado) === 0 && <IconButton icone={Trash2} rotulo={`Remover ${c.descricao}`} onClick={() => remover.mutate(undefined)} className="size-9 hover:text-bad" />}
      </div>
      {editavel && (pedeJust || (acima && mudou)) && (
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-field bg-warn-soft">
          <TextField className="flex-1 min-w-[220px]" label="Por que passou do orçado?" value={just} onChange={setJust} hint={`Acima de ${pct(TOLERANCIA, 0)} do orçado precisa de justificativa.`} placeholder="Ex.: o fornecedor reajustou o latão" />
        </div>
      )}
      {c.justificativa && <span className="text-caption text-ink-2">Justificativa: {c.justificativa}</span>}
    </li>
  );
}

function NovoCusto({ osId, onFechar }: { osId: string; onFechar: () => void }) {
  const [c, setC] = useState({ descricao: '', categoria: 'material' as CustoOS['categoria'], real: '', justificativa: '' });
  const [tentou, setTentou] = useState(false);
  const add = useAcao(() => api(`/ordens-servico/${osId}/custos`, { method: 'POST', body: { ...c, orcado: '0' } }), { invalida: [['ordens-servico']], sucesso: 'Custo lançado na OS.', onSuccess: onFechar });
  const ok = c.descricao.trim() && toNum(c.real) > 0 && c.justificativa.trim();
  return (
    <div className="mx-5 mb-4 p-4 rounded-field bg-surface-2 border border-border grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
      <TextField className="sm:col-span-2" label="O que foi gasto" value={c.descricao} onChange={(v) => setC({ ...c, descricao: v })} erro={tentou && !c.descricao.trim() ? 'Descreva o gasto.' : null} />
      <SelectField label="Tipo" value={c.categoria} onChange={(v) => setC({ ...c, categoria: v as CustoOS['categoria'] })} opcoes={Object.entries(CATEGORIA_CUSTO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
      <NumberField label="Valor real" prefixo="R$" value={c.real} onChange={(v) => setC({ ...c, real: v })} erro={tentou && !(toNum(c.real) > 0) ? 'Informe o valor.' : null} />
      <TextField className="sm:col-span-3" label="Justificativa" value={c.justificativa} onChange={(v) => setC({ ...c, justificativa: v })} hint="Não estava no orçado: conte por que entrou." erro={tentou && !c.justificativa.trim() ? 'Gasto fora do orçado precisa de justificativa.' : null} />
      <div className="flex gap-2">
        <Button tamanho="sm" onClick={onFechar}>Cancelar</Button>
        <Button tamanho="sm" icone={Check} carregando={add.isPending} onClick={() => { setTentou(true); if (ok) add.mutate(undefined); }}>Lançar</Button>
      </div>
    </div>
  );
}

type Evento = { quando: string; titulo: string; detalhe?: string; tom: string; aberto?: string };

export default function OSDetalhe() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const gestor = podeLiberarMargem(usuario?.papel);
  const params = useParametros();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ordens-servico', id], queryFn: () => api<OrdemServico>(`/ordens-servico/${id}`), refetchInterval: 30_000 });
  const o = q.data;
  useTitulo(o ? `${o.numero} · ${o.titulo}` : 'Ordem de Serviço');
  const abertos = (o?.apontamentos ?? []).filter((a) => !a.fim);
  const agora = useAgora(abertos.length > 0);
  const [modal, setModal] = useState<null | 'pausa' | 'inspecao' | 'entregar' | 'cancelar' | 'prazo'>(null);
  const [edPrazo, setEdPrazo] = useState<{ prazo: string; prioridade: Prioridade; motivo: string; pedeMotivo: boolean }>({ prazo: '', prioridade: 'NORMAL', motivo: '', pedeMotivo: false });
  const [arvore, setArvore] = useState(false);
  const [novoCusto, setNovoCusto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoPausa | ''>('');
  const [obs, setObs] = useState('');
  const [entrega, setEntrega] = useState({ recebidoPor: '', documento: '', observacao: '' });
  const [faltaItem, setFaltaItem] = useState({ itemId: '', quantidade: '' });
  const [ncAberta, setNcAberta] = useState<string | null>(null);

  const inval = [['ordens-servico'], ['painel'], ['orcamentos']];
  const post = (rota: string, sucesso: string) =>
    useAcao((body?: unknown) => api<OrdemServico>(`/ordens-servico/${id}/${rota}`, { method: 'POST', body }), {
      invalida: inval,
      sucesso,
      onSuccess: (os) => { if (os?.operacoes && os.resultado) qc.setQueryData(['ordens-servico', id], os); setModal(null); setObs(''); }
    });
  const liberar = post('liberar', 'Liberada. A OS entrou na fila do chão de fábrica.');
  const pausar = post('pausar', 'Pausa registrada. Quando resolver, é só retomar.');
  const retomar = post('retomar', 'De volta ao trabalho. A previsão foi recalculada.');
  const inspecao = post('inspecao', 'Inspeção registrada.');
  const entregar = post('entregar', 'Entregue! O custo real e o desvio ficaram gravados.');
  const cancelar = post('cancelar', 'OS cancelada. O que já foi apontado ficou como perda.');
  const reprogramar = useAcao(
    () => api<OrdemServico>(`/ordens-servico/${id}`, { method: 'PATCH', body: { prazo: edPrazo.prazo || null, prioridade: edPrazo.prioridade, ...(edPrazo.motivo.trim() ? { motivoReprogramacao: edPrazo.motivo.trim() } : {}) } }),
    { invalida: [['ordens-servico'], ['planejamento'], ['painel']], sucesso: 'Prazo e prioridade atualizados. A fila já foi recalculada.', onSuccess: (os) => { if (os?.operacoes && os.resultado) qc.setQueryData(['ordens-servico', id], os); setModal(null); } }
  );

  if (q.isLoading) return <Card><Carregando /></Card>;
  if (q.isError || !o) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;

  const r = o.resultado;
  const atrasa = !!edPrazo.prazo && !!o.prazo && edPrazo.prazo > o.prazo.slice(0, 10);
  const horasVivas = abertos.reduce((a, x) => a + segundosDesde(x.inicio, agora) / 3600, 0);
  const opRes = new Map(r.operacoes.map((x) => [x.id, x]));
  const custoRes = new Map(r.custos.map((x) => [x.id, x]));
  const editavelCustos = o.status !== 'ENTREGUE' && o.status !== 'CANCELADA';
  const minima = o.margemMinima ?? params.data?.margemMinima ?? '0.15';
  const alvo = params.data?.margemAlvo ?? r.margemOrcada;
  const projetadaTom = toNum(r.margemProjetada) >= toNum(alvo) - 1e-7 ? 'text-ok' : toNum(r.margemProjetada) >= toNum(minima) ? 'text-warn' : 'text-bad';

  const eventos: Evento[] = [
    ...o.apontamentos.map((a) => {
      const op = o.operacoes.find((x) => x.id === a.operacaoId);
      return {
        quando: a.inicio,
        titulo: `${a.colaboradorNome} · ${a.tipo === 'SETUP' ? 'setup' : 'produção'}${op ? ` na op. ${op.sequencia}` : ''}`,
        detalhe: a.fim ? `${horas(a.horas ?? 0)}${a.tipo === 'PRODUCAO' ? ` · ${a.quantidadeBoa} boas${a.refugo ? `, ${a.refugo} refugo` : ''}` : ''}${a.observacao ? ` · ${a.observacao}` : ''}` : undefined,
        tom: a.tipo === 'SETUP' ? 'bg-chart-setup' : 'bg-steel',
        aberto: a.fim ? undefined : a.inicio
      };
    }),
    ...o.ocorrencias.map((x) => ({
      quando: x.inicio,
      titulo: x.tipo === 'PAUSA' ? `Pausa: ${MOTIVOS_PAUSA[x.motivo as MotivoPausa] ?? x.motivo ?? 'sem motivo'}` : x.tipo,
      detalhe: [x.fim ? `durou ${horas(x.horas ?? 0)}` : 'ainda parada', x.observacao].filter(Boolean).join(' · '),
      tom: 'bg-signal'
    })),
    ...o.inspecoes.map((i) => ({
      quando: i.data ?? i.criadaEm ?? '',
      titulo: i.aprovada ? 'Inspeção aprovada' : 'Inspeção reprovada: retrabalho',
      detalhe: [`${i.itens.filter((x) => x.conforme).length} de ${i.itens.length} itens conformes`, i.observacao].filter(Boolean).join(' · '),
      tom: i.aprovada ? 'bg-ok' : 'bg-bad'
    })),
    ...o.historico.filter((h) => h.evento).map((h) => ({ quando: h.data, titulo: EVENTOS[h.evento!] ?? (h.evento!.charAt(0).toUpperCase() + h.evento!.slice(1)).replace(/_/g, ' '), detalhe: h.detalhe ?? undefined, tom: 'bg-neutral' }))
  ].sort((a, b) => (b.quando ?? '').localeCompare(a.quando ?? ''));

  const abrirInspecao = () => setModal('inspecao');

  const principal = {
    ABERTA: <Button variante="primario" icone={Rocket} carregando={liberar.isPending} onClick={() => liberar.mutate(undefined)}>Liberar para a fila</Button>,
    EM_FILA: <Button variante="primario" icone={Timer} to="/operador">Abrir o Modo Operador</Button>,
    EM_EXECUCAO: <Button variante="primario" icone={Timer} to="/operador">Abrir o Modo Operador</Button>,
    PAUSADA: <Button variante="primario" icone={Play} carregando={retomar.isPending} onClick={() => retomar.mutate(undefined)}>Retomar</Button>,
    CONTROLE_QUALIDADE: <Button variante="primario" icone={ClipboardCheck} onClick={abrirInspecao}>Inspecionar</Button>,
    CONCLUIDA: <Button variante="primario" icone={PackageCheck} onClick={() => setModal('entregar')}>Entregar</Button>,
    ENTREGUE: null,
    CANCELADA: null
  }[o.status];

  return (
    <>
      <HeroBand
        ilustracao={ilustracaoSegmento[o.segmento] ?? 'torno'}
        sobretitulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="mono">{o.numero}</span> · {SEGMENTO[o.segmento]} <StatusOSPill status={o.status} />
            {o.prioridade && o.prioridade !== 'NORMAL' && <Pill tom={o.prioridade === 'URGENTE' ? 'bad' : o.prioridade === 'ALTA' ? 'warn' : 'neutral'}>prioridade {o.prioridade.toLowerCase()}</Pill>}
          </span>
        }
        titulo={o.titulo}
        texto={<>Para <strong className="text-white">{o.cliente.nome.replace(/\.$/, '')}</strong>{o.orcamento && <> · do <Link to={`/orcamentos/${o.orcamento.id}`} className="text-[#FFC08F] mono">{o.orcamento.numero}</Link></>}. {lead(o)}</>}
        acoes={
          <>
            {o.status === 'EM_EXECUCAO' && <Button variante="vidro" icone={Pause} onClick={() => { setMotivo(''); setModal('pausa'); }}>Pausar</Button>}
            {o.inspecoes.length > 0 && <Button variante="vidro" icone={FileText} to={`/ordens-servico/${o.id}/laudo`}>Laudo</Button>}
            {o.status !== 'ENTREGUE' && o.status !== 'CANCELADA' && <Button variante="vidro" icone={CalendarClock} onClick={() => { setEdPrazo({ prazo: (o.prazo ?? '').slice(0, 10), prioridade: o.prioridade ?? 'NORMAL', motivo: '', pedeMotivo: false }); setModal('prazo'); }}>Prazo e prioridade</Button>}
            {gestor && o.status !== 'ENTREGUE' && o.status !== 'CANCELADA' && <Button variante="vidro" icone={Ban} onClick={() => { setObs(''); setModal('cancelar'); }}>Cancelar OS</Button>}
            {principal}
          </>
        }
      >
        <StepperOS status={o.status} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Margem projetada" valor={<span className={projetadaTom}>{pct(r.margemProjetada)}</span>} sub={`orçada ${pct(r.margemOrcada)}`} />
          <HeroKpi rotulo="Progresso" valor={pct(r.progresso, 0)} sub={`${o.lote} ${o.lote === 1 ? 'peça' : 'peças'} no lote`} />
          <HeroKpi rotulo="Horas" valor={`${num(toNum(r.horasReais) + horasVivas, 1)} h`} sub={`orçadas ${num(r.horasOrcadas, 2)} · projetadas ${num(r.horasProjetadas, 2)}`} />
          <HeroKpi rotulo="Prazo" valor={<span className={o.atrasada ? 'text-[#FF9B9B]' : ''}>{o.prazo ? data(o.prazo) : '—'}</span>} sub={o.atrasada ? 'atrasada' : o.tabelaCustos ? `custos ${o.tabelaCustos.competencia} · v${o.tabelaCustos.versao}` : undefined} />
        </div>
      </HeroBand>

      {(o.ncs ?? []).filter((n) => n.status !== 'ENCERRADA').length > 0 && (
        <Aviso tom="bad" titulo="Não-conformidade nesta OS" acao={<Button to={`/qualidade?aba=ncs`}>Ver as NCs</Button>}>
          {(o.ncs ?? []).filter((n) => n.status !== 'ENCERRADA').map((n) => `${n.numero ?? 'NC'}${n.descricao ? `: ${n.descricao}` : ''}${n.status === 'ABERTA' ? ' (sem ação ainda, bloqueia a entrega)' : ' (em tratamento)'}`).join(' · ')}
        </Aviso>
      )}
      {o.alertas.length > 0 && (
        <Aviso tom={o.alertas.some((a) => typeof a !== 'string' && a.tipo === 'perigo') ? 'bad' : 'warn'} faixa titulo={o.alertas.length === 1 ? 'Um ponto pede atenção' : `${o.alertas.length} pontos pedem atenção`}>
          <ul className="m-0 pl-0 list-none flex flex-col gap-1">
            {o.alertas.map((a, i) => <li key={i} className="flex gap-2 items-start"><TriangleAlert className="size-4 mt-0.5 text-warn flex-none" aria-hidden />{textoAlerta(a)}</li>)}
          </ul>
        </Aviso>
      )}

      <div className="flex flex-wrap gap-[22px] items-start">
        <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5">
          {o.objeto && Object.values(o.objeto).some((v) => v !== null && v !== '' && v !== undefined) && (
            <Card className="p-5 flex flex-wrap items-center gap-x-8 gap-y-3" aria-label="Objeto da OS">
              {o.segmento === 'OFICINA' ? (
                <>
                  {o.objeto.placa && <PlacaMercosul placa={o.objeto.placa} />}
                  <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2">
                    {[['Veículo', o.objeto.veiculo], ['Km na entrada', o.objeto.kmEntrada != null ? `${num(o.objeto.kmEntrada, 0)} km` : null], ['Km na saída', o.objeto.kmSaida != null ? `${num(o.objeto.kmSaida, 0)} km` : null]]
                      .filter(([, v]) => v).map(([l, v]) => <div key={l as string}><dt className="text-caption text-ink-3">{l}</dt><dd className="m-0 font-semibold">{v}</dd></div>)}
                  </dl>
                </>
              ) : (
                <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2">
                  {(o.segmento === 'CALDEIRARIA' ? [['Projeto', o.objeto.projeto]] : [['Desenho', o.objeto.desenho], ['Revisão', o.objeto.revisao], ['Material', o.objeto.material]])
                    .filter(([, v]) => v).map(([l, v]) => <div key={l as string}><dt className="text-caption text-ink-3">{l}</dt><dd className="m-0 font-semibold mono">{v}</dd></div>)}
                </dl>
              )}
            </Card>
          )}

          <Card className="overflow-hidden" aria-labelledby="h-roteiro">
            <div className="px-5 pt-5 pb-3"><CardHeader id="h-roteiro" titulo="Roteiro" sub="Orçado em cinza, real em azul; o tracejado é a projeção para o lote inteiro." /></div>
            {o.operacoes.length === 0 && <p className="m-0 px-5 pb-5 text-ink-2">Nenhuma operação no roteiro.</p>}
            <ol className="m-0 p-0 list-none">
              {[...o.operacoes].sort((a, b) => a.sequencia - b.sequencia).map((op) => {
                const res = opRes.get(op.id);
                const aberto = abertos.find((a) => a.operacaoId === op.id);
                const [rot, tom] = STATUS_OP[op.status] ?? [op.status, 'neutral'];
                return (
                  <li key={op.id} className={`px-5 py-4 border-t border-border flex flex-col gap-3 ${op.retrabalho ? 'bg-bad-soft' : ''}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="mono text-[13px] text-ink-3 w-8 pt-0.5">{op.sequencia}</span>
                      <span className="flex-1 min-w-[200px] flex flex-col">
                        <span className="font-semibold text-[15px]">{op.descricao}</span>
                        <span className="text-caption text-ink-2 inline-flex flex-wrap gap-x-3">
                          <span className="inline-flex items-center gap-1"><Cpu className="size-3.5" aria-hidden />{op.centroNome} · {brl(op.custoHora)}/h</span>
                          {op.colaboradorNome && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" aria-hidden />{op.colaboradorNome}</span>}
                        </span>
                      </span>
                      <Pill tom={tom}>{op.status === 'EM_ANDAMENTO' && <span className="size-2 rounded-full bg-run anim-pulsar" aria-hidden />}{rot}</Pill>
                      {res && <DesvioBadge desvio={res.desvio} retrabalho={op.retrabalho} />}
                    </div>
                    {aberto && (
                      <div className="ml-11 inline-flex flex-wrap items-center gap-3 self-start px-3 py-2 rounded-field bg-run-soft text-run">
                        <span className="size-2 rounded-full bg-run anim-pulsar" aria-hidden />
                        <span className="text-[13.5px] font-semibold">{aberto.colaboradorNome} em {aberto.tipo === 'SETUP' ? 'setup' : 'produção'} há</span>
                        <span className="mono text-[18px] font-bold" aria-live="off">{cronometro(segundosDesde(aberto.inicio, agora))}</span>
                      </div>
                    )}
                    <div className="ml-11 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 items-center">
                      {res ? (
                        <BarrasOrcadoReal orcado={toNum(res.horasOrcadas)} real={toNum(res.horasReais)} projetado={toNum(res.horasProjetadas)} rotulo={`${op.descricao}: orçado ${num(res.horasOrcadas)} h, real ${num(res.horasReais)} h, projetado ${num(res.horasProjetadas)} h`} />
                      ) : <span />}
                      <dl className="m-0 grid grid-cols-4 gap-4 text-right">
                        {[
                          ['Setup', `${num(toNum(op.setupRealHoras) + (aberto?.tipo === 'SETUP' ? segundosDesde(aberto.inicio, agora) / 3600 : 0))} / ${num(op.setupOrcadoHoras)} h`],
                          ['Produção', `${num(toNum(op.producaoRealHoras) + (aberto?.tipo === 'PRODUCAO' ? segundosDesde(aberto.inicio, agora) / 3600 : 0))} h`],
                          ['Projetado', res ? `${num(res.horasProjetadas)} h` : '—'],
                          ['Peças', `${op.quantidadeBoa}/${o.lote}${op.refugo ? ` · ${op.refugo} ref.` : ''}`]
                        ].map(([l, v]) => (
                          <div key={l} className="flex flex-col"><dt className="text-caption text-ink-3">{l}</dt><dd className="m-0 mono text-[13px] font-semibold whitespace-nowrap">{v}</dd></div>
                        ))}
                      </dl>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <ConsumosOS o={o} editavel={editavelCustos} />

          <Card className="overflow-hidden" aria-labelledby="h-custos">
            <div className="px-5 pt-5 pb-3">
              <CardHeader id="h-custos" titulo="Materiais, terceiros e frete" sub="Lance o valor real quando a nota chegar. Até lá, a projeção usa o orçado."
                acao={editavelCustos && !novoCusto && <Button tamanho="sm" variante="terciario" icone={Plus} onClick={() => setNovoCusto(true)}>Custo não orçado</Button>} />
            </div>
            {novoCusto && <NovoCusto osId={o.id} onFechar={() => setNovoCusto(false)} />}
            {o.custos.length === 0 && !novoCusto && <p className="m-0 px-5 pb-5 text-ink-2">Nenhum material ou terceiro nesta OS.</p>}
            <ul className="m-0 p-0 list-none">
              {o.custos.map((c) => <LinhaCusto key={`${c.id}-${c.real}`} c={c} osId={o.id} editavel={editavelCustos} desvio={custoRes.get(c.id)?.desvio} />)}
            </ul>
          </Card>

          <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-tempo">
            <CardHeader id="h-tempo" titulo="O que aconteceu" sub="Apontamentos, pausas e inspeções, do mais recente para o mais antigo." />
            {eventos.length === 0 ? (
              <p className="m-0 text-ink-2">Nada apontado ainda. O primeiro registro aparece quando o operador iniciar o setup.</p>
            ) : (
              <ol className="m-0 p-0 list-none relative">
                <span className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />
                {eventos.map((e, i) => (
                  <li key={i} className="relative pl-7 py-2">
                    <span className={`absolute left-0 top-3.5 size-4 rounded-full border-[3px] border-surface-1 ${e.tom} ${e.aberto ? 'anim-pulsar' : ''}`} aria-hidden />
                    <div className="flex flex-wrap justify-between gap-x-3">
                      <span className="font-medium text-[14.5px]">{e.titulo}</span>
                      <span className="mono text-caption text-ink-3">{e.quando ? new Date(e.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    {e.aberto ? (
                      <span className="text-[13px] text-run font-semibold">em andamento · <span className="mono">{cronometro(segundosDesde(e.aberto, agora))}</span></span>
                    ) : (
                      e.detalhe && <span className="text-[13px] text-ink-2">{e.detalhe}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <GlassPanel aria-label="Orçado, real e projetado" className="flex-[1_1_340px] w-full lg:max-w-[420px] lg:sticky lg:top-24">
          <h2 className="m-0 text-[24px] font-bold">Orçado × real</h2>
          <div className="flex gap-4 text-caption text-ink-2">
            <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-1.5 rounded bg-chart-orcado" />orçado</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-1.5 rounded bg-chart-real" />real</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-1.5 rounded border-2 border-dashed border-chart-real" />projetado</span>
          </div>
          {[
            ['Horas', r.horasOrcadas, r.horasReais, r.horasProjetadas, (v: string) => horas(v)],
            ['Custo', r.custoOrcado, r.custoReal, r.custoProjetado, (v: string) => brl(v)]
          ].map(([l, orc, real, proj, f]) => {
            const fmt = f as (v: string) => string;
            return (
              <div key={l as string} className="p-3 rounded-[16px] bg-surface-1 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[14px] font-medium">{l as string}</span>
                  {l === 'Custo' && <DesvioBadge desvio={r.desvioCusto} />}
                </div>
                <BarrasOrcadoReal orcado={toNum(orc as string)} real={toNum(real as string)} projetado={toNum(proj as string)} rotulo={`${l}: orçado ${fmt(orc as string)}, real ${fmt(real as string)}, projetado ${fmt(proj as string)}`} />
                <dl className="m-0 grid grid-cols-3 gap-2 text-right">
                  {[['orçado', orc, 'text-ink-3'], ['real', real, 'text-steel'], ['projetado', proj, 'text-ink-1']].map(([k, v, c]) => (
                    <div key={k as string}><dt className="text-[11.5px] text-ink-3">{k as string}</dt><dd className={`m-0 mono text-[13.5px] font-semibold ${c}`}>{fmt(v as string)}</dd></div>
                  ))}
                </dl>
              </div>
            );
          })}
          <div className="p-3.5 rounded-[18px] bg-surface-1 flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[14px] font-medium">Margem projetada</span>
              <span className={`mono text-[26px] font-bold ${projetadaTom}`} aria-live="polite">{pct(r.margemProjetada)}</span>
            </div>
            <MarginRuler efetiva={r.margemProjetada} minima={minima} alvo={alvo} />
            <span className="text-[13px] text-ink-2">Orçada em {pct(r.margemOrcada)}. {toNum(r.margemProjetada) < toNum(minima) ? 'Abaixo do mínimo: vale entender o desvio antes de seguir.' : toNum(r.margemProjetada) < toNum(r.margemOrcada) - 0.0005 ? 'O desvio está comendo parte da margem.' : 'Dentro do combinado.'}</span>
          </div>
          {toNum(r.custoNaoQualidade) > 0 && (
            <div className="p-3 rounded-[16px] bg-bad-soft flex justify-between items-baseline">
              <span className="text-[14px] font-medium">Custo da não-qualidade</span>
              <span className="mono text-[18px] font-bold text-bad">{brl(r.custoNaoQualidade)}</span>
            </div>
          )}
          {o.custoRealFinal && (
            <div className="p-3 rounded-[16px] bg-ok-soft flex justify-between items-baseline gap-2">
              <span className="text-[14px] font-medium">Custo real final</span>
              <span className="mono text-[18px] font-bold">{brl(o.custoRealFinal)}{o.desvioFinal != null && <span className="text-[13px] text-ink-2"> · {toNum(o.desvioFinal) > 0 ? '+' : ''}{pct(o.desvioFinal)}</span>}</span>
            </div>
          )}
          <span className="text-caption text-ink-2">Preço do lote {brl(o.precoFinalLote)}{o.tabelaCustos ? ` · custo-hora da tabela ${o.tabelaCustos.competencia} v${o.tabelaCustos.versao}` : ''}</span>
          <button type="button" onClick={() => setArvore(!arvore)} aria-expanded={arvore} className="self-start inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-text">
            <ChevronDown className={`size-4 transition-transform ${arvore ? 'rotate-180' : ''}`} aria-hidden /> Como chegamos na projeção
          </button>
          {arvore && <div className="rounded-field bg-surface-1 p-2"><ExplainTree raiz={r.explicacao} rotulo="Conta da projeção" /></div>}
        </GlassPanel>
      </div>


      <Modal aberto={modal === 'prazo'} onFechar={() => setModal(null)} titulo="Prazo e prioridade"
        rodape={<><Button onClick={() => setModal(null)}>Voltar</Button><Button variante="primario" icone={Check} carregando={reprogramar.isPending}
          disabled={(atrasa || edPrazo.pedeMotivo) && edPrazo.motivo.trim().length < 5}
          onClick={() => reprogramar.mutate(undefined, { onError: (e) => e instanceof ApiError && e.codigo === 'MOTIVO_OBRIGATORIO' && setEdPrazo((x) => ({ ...x, pedeMotivo: true })) })}>Salvar</Button></>}>
        <TextField label="Prazo" type="date" mono value={edPrazo.prazo} onChange={(v) => setEdPrazo({ ...edPrazo, prazo: v })} hint={o.prazo ? `Hoje está em ${data(o.prazo)}.` : undefined} />
        <Segmented<Prioridade> label="Prioridade" tamanho="sm" value={edPrazo.prioridade} onChange={(v) => setEdPrazo({ ...edPrazo, prioridade: v })}
          opcoes={[{ valor: 'BAIXA', rotulo: 'Baixa' }, { valor: 'NORMAL', rotulo: 'Normal' }, { valor: 'ALTA', rotulo: 'Alta' }, { valor: 'URGENTE', rotulo: 'Urgente' }]} />
        {(atrasa || edPrazo.pedeMotivo) && (
          <>
            <p className="m-0 flex gap-2 p-3 rounded-field bg-warn-soft text-[14px]"><TriangleAlert className="size-4 text-warn mt-0.5 flex-none" aria-hidden />Empurrar o prazo para frente avisa o vendedor e fica no histórico. Conte o motivo.</p>
            <TextArea label="Motivo da reprogramação" value={edPrazo.motivo} onChange={(v) => setEdPrazo({ ...edPrazo, motivo: v })} hint="Ex.: fornecedor atrasou o latão em 3 dias." />
          </>
        )}
      </Modal>

      <Modal aberto={modal === 'pausa'} onFechar={() => setModal(null)} titulo="Por que parou?"
        rodape={<><Button onClick={() => setModal(null)}>Voltar</Button><Button variante="primario" icone={Pause} disabled={!motivo} carregando={pausar.isPending} onClick={() => pausar.mutate({ motivo, observacao: obs.trim() || undefined, ...(motivo === 'FALTA_PECA' && faltaItem.itemId && toNum(faltaItem.quantidade) > 0 ? { itemId: faltaItem.itemId, quantidade: faltaItem.quantidade } : {}) })}>Pausar a OS</Button></>}>
        <div role="radiogroup" aria-label="Motivo da pausa" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(MOTIVOS_PAUSA) as MotivoPausa[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={motivo === m} onClick={() => setMotivo(m)}
              className={`min-h-[56px] px-4 rounded-field border-2 text-left font-semibold transition ${motivo === m ? 'border-primary bg-primary-soft text-primary-text' : 'border-border-strong bg-surface-2 hover:border-ink-3'}`}>
              {MOTIVOS_PAUSA[m]}
            </button>
          ))}
        </div>
        {motivo === 'FALTA_PECA' && (
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3 p-3 rounded-field bg-warn-soft">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-ink-2">Qual item falta (opcional)</span>
              <ItemPicker value={faltaItem.itemId} onChange={(id) => setFaltaItem({ ...faltaItem, itemId: id })} vazio="Não sei ou não é de estoque" />
            </label>
            <NumberField label="Quanto precisa" value={faltaItem.quantidade} onChange={(v) => setFaltaItem({ ...faltaItem, quantidade: v })} />
            <span className="sm:col-span-2 text-caption text-ink-2">Com o item escolhido, Compras recebe a requisição ligada a esta OS na hora.</span>
          </div>
        )}
        <TextArea label="Observação" value={obs} onChange={setObs} hint={motivo === 'FALTA_PECA' ? 'Qual peça? Ajuda compras a correr atrás.' : 'Opcional.'} />
        <p className="m-0 text-caption text-ink-3">Os apontamentos abertos são fechados agora e o tempo parado fica registrado.</p>
      </Modal>

      <InspecaoDialog o={o} aberto={modal === 'inspecao'} onFechar={() => setModal(null)} enviando={inspecao.isPending} padrao={itensPadrao(o)} onEnviar={(b) => inspecao.mutate(b)} />

      <Modal aberto={modal === 'entregar'} onFechar={() => setModal(null)} faixa titulo={`Entregar ${o.numero}?`}
        rodape={<><Button onClick={() => setModal(null)}>Ainda não</Button><Button variante="primario" icone={PackageCheck} disabled={!entrega.recebidoPor.trim()} carregando={entregar.isPending}
          onClick={() => { setNcAberta(null); entregar.mutate({ recebidoPor: entrega.recebidoPor.trim(), documento: entrega.documento.trim() || undefined, observacao: entrega.observacao.trim() || undefined }, { onError: (e) => e instanceof ApiError && e.codigo === 'NC_ABERTA' && setNcAberta(e.message) }); }}>Confirmar entrega</Button></>}>
        {ncAberta && (
          <div role="alert" className="p-3 rounded-field bg-bad-soft text-[14px] flex flex-col gap-1">
            <strong>Tem uma não-conformidade aberta nesta OS</strong>
            <span>{ncAberta}</span>
            <Link to={`/qualidade?aba=ncs&os=${o.id}`} className="font-semibold">Abrir as não-conformidades</Link>
          </div>
        )}
        <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[['Preço do lote', brl(o.precoFinalLote)], ['Custo real', brl(r.custoReal)], ['Margem final', pct(r.margemProjetada)], ['Desvio de custo', pct(r.desvioCusto)]].map(([l, v]) => (
            <div key={l} className="p-3 rounded-field bg-surface-2"><dt className="text-caption text-ink-3">{l}</dt><dd className="m-0 mono font-bold">{v}</dd></div>
          ))}
        </dl>
        <p className="m-0 text-ink-2 text-[14px]">Depois de entregue, o custo real e o desvio ficam gravados e a OS não muda mais.</p>
        <TextField label="Quem recebeu" required value={entrega.recebidoPor} onChange={(v) => setEntrega({ ...entrega, recebidoPor: v })} placeholder="Juliana Prates" />
        <TextField label="Documento de quem recebeu" mono value={entrega.documento} onChange={(v) => setEntrega({ ...entrega, documento: v })} hint="Opcional: RG, CPF ou nota de recebimento." />
        <TextArea label="Observação" value={entrega.observacao} onChange={(v) => setEntrega({ ...entrega, observacao: v })} />
      </Modal>

      <Modal aberto={modal === 'cancelar'} onFechar={() => setModal(null)} faixa titulo={`Cancelar ${o.numero}?`}
        rodape={<><Button onClick={() => setModal(null)}>Manter a OS</Button><Button variante="perigo" icone={Ban} disabled={obs.trim().length < 5} carregando={cancelar.isPending} onClick={() => cancelar.mutate({ motivo: obs.trim() })}>Cancelar de vez</Button></>}>
        <p className="m-0 text-ink-2">Não tem volta. O que já foi apontado ({brl(r.custoReal)}) fica registrado como perda e a capacidade reservada é liberada.</p>
        <TextArea label="Motivo" value={obs} onChange={setObs} hint="Ex.: cliente desistiu do pedido." />
      </Modal>
    </>
  );
}
