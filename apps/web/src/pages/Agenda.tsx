import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, ChevronLeft, ChevronRight, DoorOpen, Plus, Save, UserX, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Agendamento, Lista, StatusAgendamento } from '../lib/types';
import { mascaraPlaca, mascaraTelefone, placaValida, soDigitos, limparPlaca } from '../lib/documento';
import { num } from '../lib/format';
import { useAcao, useCentros, useClientes, useColaboradores } from '../lib/queries';
import { HeroBand } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { NumberField, Segmented, SelectField, TextArea, TextField } from '../components/Field';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill, type Tom } from '../components/Pill';
import { Modal } from '../components/Modal';
import { PlacaMercosul } from '../features/os/componentes';
import { diasDaSemana, rotuloDia, semanaDe, somarDias } from '../features/planejamento/plano';
import { useTitulo } from '../layout/titulo';

const INICIO = 8, FIM = 18, ALTURA = 56;
const HORAS = Array.from({ length: FIM - INICIO }, (_, i) => INICIO + i);
const SLOTS = Array.from({ length: (FIM - INICIO) * 2 }, (_, i) => `${String(INICIO + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const STATUS: Record<StatusAgendamento, [string, Tom]> = {
  MARCADO: ['Marcado', 'neutral'], CONFIRMADO: ['Confirmado', 'info'], CHEGOU: ['Chegou', 'ok'], NAO_VEIO: ['Não veio', 'warn'], CANCELADO: ['Cancelado', 'bad']
};
const COR_BLOCO: Record<StatusAgendamento, string> = {
  MARCADO: 'bg-surface-1 border-border-strong', CONFIRMADO: 'bg-info-soft border-info', CHEGOU: 'bg-ok-soft border-ok', NAO_VEIO: 'bg-warn-soft border-signal opacity-70', CANCELADO: 'bg-bad-soft border-bad opacity-50 line-through'
};
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const local = (iso: string) => { const d = new Date(iso); return { data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, horas: d.getHours() + d.getMinutes() / 60, hhmm: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }; };
const nomeDe = (a: Agendamento) => a.cliente?.nome ?? a.nomeCliente ?? 'Cliente avulso';

const MENSAGENS: Record<string, string> = {
  HORARIO_OCUPADO: 'Esse horário já está tomado nesse box ou com esse mecânico. Tente outro horário ou outro box.',
  NAO_HABILITADO: 'Esse mecânico não trabalha nesse box. Escolha alguém alocado nele, ou deixe sem mecânico.',
  FORA_DO_EXPEDIENTE: 'Fora do expediente do box (08:00 às 18:00, nos dias de trabalho, sem feriados nem paradas). Escolha outro horário.'
};
const mensagemAgenda = (e: unknown) => (e instanceof ApiError ? e.message || (e.codigo && MENSAGENS[e.codigo]) : null) || 'Não deu para salvar agora. Tente de novo.';

interface Form { id?: string; clienteId: string; avulso: boolean; nomeCliente: string; telefone: string; placa: string; veiculo: string; servico: string; centroId: string; colaboradorId: string; data: string; hora: string; duracaoHoras: string; observacao: string }

function Bloco({ a, onAbrir, compacto }: { a: Agendamento; onAbrir: (a: Agendamento) => void; compacto?: boolean }) {
  const l = local(a.inicio);
  return (
    <button type="button" onClick={() => onAbrir(a)}
      className={`absolute inset-x-1 rounded-control border-l-4 border px-2 py-1 text-left overflow-hidden shadow-1 hover:shadow-2 transition ${COR_BLOCO[a.status]}`}
      style={{ top: (l.horas - INICIO) * ALTURA + 1, height: Math.max(26, Number(a.duracaoHoras) * ALTURA - 2) }}
      aria-label={`${l.hhmm}, ${nomeDe(a)}, ${a.servico}${a.placa ? `, placa ${a.placa}` : ''}, ${STATUS[a.status][0]}`}>
      <span className="block mono text-[11.5px] text-ink-3">{l.hhmm}{a.placa ? ` · ${limparPlaca(a.placa)}` : ''}</span>
      <span className="block text-[13px] font-semibold leading-tight truncate">{compacto ? a.servico : nomeDe(a)}</span>
      {!compacto && <span className="block text-[12px] text-ink-2 truncate">{a.servico}{a.colaboradorNome ? ` · ${a.colaboradorNome.split(' ')[0]}` : ''}</span>}
    </button>
  );
}

export default function Agenda() {
  useTitulo('Agenda da oficina');
  const navigate = useNavigate();
  const [vista, setVista] = useState<'dia' | 'semana'>('dia');
  const [dia, setDia] = useState(hojeLocal);
  const centrosQ = useCentros();
  const boxes = (centrosQ.data?.itens ?? []).filter((c) => c.tipo === 'box' && c.status !== 'desativado');
  const [boxSemana, setBoxSemana] = useState('');
  const box = boxSemana || boxes[0]?.id || '';
  const de = vista === 'dia' ? dia : semanaDe(dia);
  const ate = vista === 'dia' ? dia : somarDias(de, 6);
  const q = useQuery({
    queryKey: ['agendamentos', de, ate, vista === 'semana' ? box : ''],
    queryFn: () => api<Lista<Agendamento>>('/agendamentos', { query: { de, ate, centroId: vista === 'semana' ? box : undefined } }),
    enabled: vista === 'dia' || !!box
  });
  const itens = q.data?.itens ?? [];
  const [form, setForm] = useState<Form | null>(null);
  const atual = form?.id ? itens.find((x) => x.id === form.id) : undefined;

  const novo = (centroId: string, data: string, hora = '08:00'): Form => ({ clienteId: '', avulso: false, nomeCliente: '', telefone: '', placa: '', veiculo: '', servico: '', centroId, colaboradorId: '', data, hora, duracaoHoras: '1', observacao: '' });
  const abrir = (a: Agendamento) => {
    const l = local(a.inicio);
    setForm({ id: a.id, clienteId: a.cliente?.id ?? '', avulso: !a.cliente?.id, nomeCliente: a.nomeCliente ?? (a.cliente?.id ? '' : a.cliente?.nome ?? ''), telefone: a.telefone ?? '', placa: mascaraPlaca(a.placa ?? ''), veiculo: a.veiculo ?? '', servico: a.servico, centroId: a.centroId, colaboradorId: a.colaboradorId ?? '', data: l.data, hora: l.hhmm, duracaoHoras: String(a.duracaoHoras), observacao: a.observacao ?? '' });
  };
  const contagem = itens.filter((a) => a.status !== 'CANCELADO').length;
  const colunasDias = vista === 'semana' ? diasDaSemana(de).filter((d) => {
    const ds = boxes.find((b) => b.id === box)?.diasSemana ?? [1, 2, 3, 4, 5, 6];
    return ds.includes(new Date(`${d}T12:00:00`).getDay()) || itens.some((a) => local(a.inicio).data === d);
  }) : [];

  return (
    <>
      <HeroBand
        ilustracao="elevador"
        titulo="Agenda da oficina"
        texto={`${contagem} ${contagem === 1 ? 'horário marcado' : 'horários marcados'} ${vista === 'dia' ? `em ${rotuloDia(dia)}` : 'nesta semana'}. Toque num horário livre para marcar.`}
        acoes={<Button variante="primario" icone={Plus} onClick={() => setForm(novo(vista === 'semana' ? box : boxes[0]?.id ?? '', dia))} disabled={!boxes.length}>Marcar horário</Button>}
      />
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <Segmented<'dia' | 'semana'> label="Visão" ocultarRotulo tamanho="sm" value={vista} onChange={setVista} opcoes={[{ valor: 'dia', rotulo: 'Dia' }, { valor: 'semana', rotulo: 'Semana' }]} />
        <div className="inline-flex items-center gap-1" role="group" aria-label="Navegar nas datas">
          <button type="button" className="size-10 grid place-items-center rounded-full hover:bg-surface-3" aria-label={vista === 'dia' ? 'Dia anterior' : 'Semana anterior'} onClick={() => setDia(somarDias(dia, vista === 'dia' ? -1 : -7))}><ChevronLeft className="size-5" aria-hidden /></button>
          <span className="mono text-[14px] font-semibold min-w-[150px] text-center" aria-live="polite">{vista === 'dia' ? rotuloDia(dia) : `${rotuloDia(de)} a ${rotuloDia(ate)}`}</span>
          <button type="button" className="size-10 grid place-items-center rounded-full hover:bg-surface-3" aria-label={vista === 'dia' ? 'Próximo dia' : 'Próxima semana'} onClick={() => setDia(somarDias(dia, vista === 'dia' ? 1 : 7))}><ChevronRight className="size-5" aria-hidden /></button>
          <Button tamanho="sm" variante="terciario" onClick={() => setDia(hojeLocal())}>Hoje</Button>
        </div>
        {vista === 'semana' && boxes.length > 1 && <Segmented label="Box" ocultarRotulo tamanho="sm" value={box} onChange={setBoxSemana} opcoes={boxes.map((b) => ({ valor: b.id, rotulo: b.nome }))} />}
      </Card>

      <Card className="overflow-hidden" aria-label="Horários">
        {centrosQ.isLoading || q.isLoading ? <Carregando /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : boxes.length === 0 ? (
          <EmptyState ilustracao="elevador" titulo="Nenhum box cadastrado" texto="Cadastre o box ou elevador como centro de trabalho do tipo “Box / elevador” para marcar horários." acao={<Button to="/centros-trabalho/novo">Novo centro de trabalho</Button>} />
        ) : (
          <>
            <ul className="md:hidden m-0 p-0 list-none" aria-label="Horários do dia">
              {(vista === 'semana' ? diasDaSemana(de) : [dia]).map((d) => {
                const doDia = itens.filter((a) => local(a.inicio).data === d).sort((a, b) => a.inicio.localeCompare(b.inicio));
                return (
                  <li key={d} className="border-t border-border first:border-0">
                    <div className="px-4 py-2 bg-surface-2 text-[13px] font-semibold">{rotuloDia(d)}</div>
                    {doDia.length === 0 ? <p className="m-0 px-4 py-3 text-[14px] text-ink-3">Livre o dia todo.</p> : doDia.map((a) => (
                      <button key={a.id} type="button" onClick={() => abrir(a)} className="w-full text-left px-4 py-3 border-t border-border flex items-start gap-3">
                        <span className="mono text-[15px] font-bold w-14">{local(a.inicio).hhmm}</span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className={`font-semibold ${a.status === 'CANCELADO' ? 'line-through' : ''}`}>{nomeDe(a)}</span>
                          <span className="text-[13px] text-ink-2">{a.servico} · {a.centroNome}{a.placa ? ` · ${limparPlaca(a.placa)}` : ''}</span>
                        </span>
                        <Pill tom={STATUS[a.status][1]}>{STATUS[a.status][0]}</Pill>
                      </button>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <div className="grid min-w-[560px]" style={{ gridTemplateColumns: `56px repeat(${vista === 'dia' ? boxes.length : colunasDias.length}, minmax(140px, 1fr))` }}>
                <span className="sticky top-0 bg-surface-2 border-b border-border" />
                {(vista === 'dia' ? boxes.map((b) => ({ k: b.id, t: b.nome })) : colunasDias.map((d) => ({ k: d, t: rotuloDia(d) }))).map((c) => (
                  <span key={c.k} className="px-2 py-2.5 text-[13.5px] font-semibold text-center bg-surface-2 border-b border-l border-border truncate">{c.t}</span>
                ))}
                <div className="relative" style={{ height: HORAS.length * ALTURA }}>
                  {HORAS.map((h) => <span key={h} className="absolute right-2 mono text-[11.5px] text-ink-3" style={{ top: (h - INICIO) * ALTURA + 2 }}>{String(h).padStart(2, '0')}:00</span>)}
                </div>
                {(vista === 'dia' ? boxes.map((b) => ({ k: b.id, centroId: b.id, data: dia })) : colunasDias.map((d) => ({ k: d, centroId: box, data: d }))).map((c) => (
                  <div key={c.k} className="relative border-l border-border" style={{ height: HORAS.length * ALTURA }}>
                    {HORAS.map((h) => (
                      <button key={h} type="button" onClick={() => setForm(novo(c.centroId, c.data, `${String(h).padStart(2, '0')}:00`))}
                        className="absolute inset-x-0 border-t border-border hover:bg-primary-soft focus-visible:bg-primary-soft transition-colors"
                        style={{ top: (h - INICIO) * ALTURA, height: ALTURA }} aria-label={`Marcar às ${h}:00 em ${c.data}`} />
                    ))}
                    {itens.filter((a) => a.centroId === c.centroId && local(a.inicio).data === c.data).map((a) => <Bloco key={a.id} a={a} onAbrir={abrir} compacto={vista === 'semana'} />)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {form && <Folha form={form} setForm={setForm} atual={atual} boxes={boxes.map((b) => ({ valor: b.id, rotulo: b.nome }))} onFechar={() => setForm(null)} onAbrirOS={(id) => navigate(`/ordens-servico/${id}`)} />}
    </>
  );
}

function Folha({ form, setForm, atual, boxes, onFechar, onAbrirOS }: { form: Form; setForm: (f: Form) => void; atual?: Agendamento; boxes: { valor: string; rotulo: string }[]; onFechar: () => void; onAbrirOS: (id: string) => void }) {
  const clientes = useClientes('');
  const colabs = useColaboradores();
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const mecanicos = useMemo(() => (colabs.data?.itens ?? []).filter((c) => c.ativo && c.alocacoes.some((a) => a.centroId === form.centroId)), [colabs.data, form.centroId]);
  const placaErro = form.placa && !placaValida(form.placa) ? 'Placa no formato ABC1D23 (Mercosul) ou ABC-1234.' : null;
  const fim = (() => { const [h, m] = form.hora.split(':').map(Number); const t = h! + m! / 60 + Number(form.duracaoHoras || 0); return t; })();
  const passa = fim > FIM;
  const valido = form.servico.trim() && form.centroId && form.data && form.hora && Number(form.duracaoHoras) > 0 && !placaErro && (form.avulso ? form.nomeCliente.trim() : form.clienteId);
  const inval = [['agendamentos'], ['planejamento'], ['painel']];
  const corpo = () => ({
    ...(form.avulso ? { nomeCliente: form.nomeCliente.trim() } : { clienteId: form.clienteId }),
    telefone: soDigitos(form.telefone) || undefined,
    placa: form.placa ? limparPlaca(form.placa) : undefined,
    veiculo: form.veiculo.trim() || undefined,
    servico: form.servico.trim(),
    centroId: form.centroId,
    colaboradorId: form.colaboradorId || undefined,
    inicio: new Date(`${form.data}T${form.hora}:00`).toISOString(),
    duracaoHoras: form.duracaoHoras,
    observacao: form.observacao.trim() || undefined
  });
  const salvar = useAcao(() => api(form.id ? `/agendamentos/${form.id}` : '/agendamentos', { method: form.id ? 'PATCH' : 'POST', body: corpo() }), {
    invalida: inval,
    sucesso: form.id ? 'Horário atualizado.' : `Marcado para ${rotuloDia(form.data)} às ${form.hora}. Um dia antes, vale confirmar com o cliente.`,
    onSuccess: onFechar
  });
  const acao = useAcao(({ rota, body }: { rota: string; body?: unknown }) => api<Agendamento>(`/agendamentos/${form.id}/${rota}`, { method: 'POST', body }), {
    invalida: [...inval, ['ordens-servico']],
    onSuccess: (r, v) => {
      if (v.rota === 'chegou' && r?.osId) onAbrirOS(r.osId);
      else onFechar();
    },
    sucesso: (_r, v) => ({ confirmar: 'Confirmado. O cliente vem.', chegou: 'Chegou! O box já pode receber.', 'nao-veio': 'Registrado que não veio. O horário ficou livre.', cancelar: 'Horário cancelado.' })[v.rota] ?? 'Feito.'
  });
  const enviar = () => {
    setTentou(true);
    setErro(null);
    if (!valido) return;
    salvar.mutate(undefined, { onError: (e) => setErro(mensagemAgenda(e)) });
  };
  const status = atual?.status;
  const aberto = !status || status === 'MARCADO' || status === 'CONFIRMADO';

  return (
    <Modal aberto onFechar={onFechar} largura={600} titulo={form.id ? 'Horário marcado' : 'Marcar horário'}
      rodape={
        <>
          {status && aberto && (
            <>
              <Button tamanho="sm" variante="perigo" icone={X} onClick={() => acao.mutate({ rota: 'cancelar' })}>Cancelar</Button>
              <Button tamanho="sm" icone={UserX} onClick={() => acao.mutate({ rota: 'nao-veio' })}>Não veio</Button>
              {status === 'MARCADO' && <Button tamanho="sm" icone={CalendarCheck2} onClick={() => acao.mutate({ rota: 'confirmar' })}>Confirmar</Button>}
              {form.avulso ? (
                <Button tamanho="sm" icone={DoorOpen} carregando={acao.isPending} onClick={() => acao.mutate({ rota: 'chegou' })}>Chegou</Button>
              ) : (
                <Button tamanho="sm" icone={DoorOpen} carregando={acao.isPending} onClick={() => acao.mutate({ rota: 'chegou', body: { abrirOs: true } })}>Chegou e abrir OS</Button>
              )}
            </>
          )}
          {aberto && <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>{form.id ? 'Salvar' : 'Marcar'}</Button>}
          {atual?.osId && <Button onClick={() => onAbrirOS(atual.osId!)}>Ver a OS</Button>}
        </>
      }>
      {status && aberto && form.avulso && <p className="m-0 text-[13.5px] text-ink-2">Cliente avulso: para abrir a OS na chegada, cadastre o cliente antes em Clientes.</p>}
      {status && <div className="flex gap-2 items-center"><Pill tom={STATUS[status][1]}>{STATUS[status][0]}</Pill>{!aberto && <span className="text-[13.5px] text-ink-2">Esse horário já foi encerrado.</span>}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-end gap-3 sm:col-span-2">
          <TextField className="flex-1" label="Placa" mono value={form.placa} onChange={(v) => set('placa', mascaraPlaca(v))} erro={placaErro} placeholder="ABC1D23" />
          {placaValida(form.placa) && <PlacaMercosul placa={limparPlaca(form.placa)} />}
        </div>
        <TextField className="sm:col-span-2" label="Veículo" value={form.veiculo} onChange={(v) => set('veiculo', v)} placeholder="Honda CG 160 2022" />
        <div className="sm:col-span-2">
          <Segmented<'c' | 'a'> label="Cliente" tamanho="sm" value={form.avulso ? 'a' : 'c'} onChange={(v) => set('avulso', v === 'a')} opcoes={[{ valor: 'c', rotulo: 'Cadastrado' }, { valor: 'a', rotulo: 'Avulso' }]} />
        </div>
        {form.avulso ? (
          <>
            <TextField label="Nome" value={form.nomeCliente} onChange={(v) => set('nomeCliente', v)} erro={tentou && !form.nomeCliente.trim() ? 'Como o cliente se chama?' : null} />
            <TextField label="Telefone" mono inputMode="tel" value={mascaraTelefone(form.telefone)} onChange={(v) => set('telefone', v)} placeholder="(47) 99999-0000" />
          </>
        ) : (
          <>
            <SelectField label="Cliente" value={form.clienteId} onChange={(v) => set('clienteId', v)} vazio="Escolha o cliente" erro={tentou && !form.clienteId ? 'Escolha o cliente ou marque como avulso.' : null}
              opcoes={(clientes.data?.itens ?? []).filter((c) => c.status === 'ATIVO' || c.id === form.clienteId).map((c) => ({ valor: c.id, rotulo: c.fantasia || c.nome }))} />
            <TextField label="Telefone" mono inputMode="tel" value={mascaraTelefone(form.telefone)} onChange={(v) => set('telefone', v)} hint="Para confirmar um dia antes." />
          </>
        )}
        <TextField className="sm:col-span-2" label="Serviço" required value={form.servico} onChange={(v) => set('servico', v)} placeholder="Revisão dos 10 mil km" erro={tentou && !form.servico.trim() ? 'O que vai ser feito?' : null} />
        <SelectField label="Box" value={form.centroId} onChange={(v) => setForm({ ...form, centroId: v, colaboradorId: '' })} opcoes={boxes} />
        <SelectField label="Mecânico" value={form.colaboradorId} onChange={(v) => set('colaboradorId', v)} vazio="Quem estiver livre" opcoes={mecanicos.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
        <TextField label="Dia" type="date" mono value={form.data} onChange={(v) => set('data', v)} />
        <SelectField label="Hora" value={form.hora} onChange={(v) => set('hora', v)} opcoes={SLOTS.map((s) => ({ valor: s, rotulo: s }))} />
        <NumberField label="Duração" sufixo="h" value={form.duracaoHoras} onChange={(v) => set('duracaoHoras', v)} hint={passa ? 'Passa das 18:00: o box fecha antes.' : `termina ${String(Math.floor(fim)).padStart(2, '0')}:${String(Math.round((fim % 1) * 60)).padStart(2, '0')}`} erro={tentou && !(Number(form.duracaoHoras) > 0) ? 'Quanto tempo leva?' : null} />
        <TextArea className="sm:col-span-2" label="Observação" value={form.observacao} onChange={(v) => set('observacao', v)} />
      </div>
      {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
      {form.duracaoHoras && <span className="text-caption text-ink-3">{num(form.duracaoHoras, 1)} h reservadas no box.</span>}
    </Modal>
  );
}
