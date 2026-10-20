import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Siren, TriangleAlert } from 'lucide-react';
import { api } from '../../lib/api';
import type { OSResumo } from '../../lib/types';
import { useAcao, useCentros } from '../../lib/queries';
import { Button } from '../../components/Button';
import { SelectField, TextArea, TextField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Carregando } from '../../components/EmptyState';
import { agoraLocal, lista, osPrevistasNaQuebra, type Ordem } from './manutencao';
import { INVAL_MANUTENCAO } from './queries';

type Apont = { centroId?: string; os?: { id: string; numero: string; titulo?: string; status?: string } | null };

/** Registrar quebra: dados, confirmação com faixa de perigo listando as OS que vão pausar, e o resultado. */
export function RegistrarQuebra({ centroId, onFechar, onAbrirOrdem }: { centroId?: string; onFechar: () => void; onAbrirOrdem: (id: string) => void }) {
  const centros = useCentros();
  const [f, setF] = useState({ centroId: centroId ?? '', descricao: '', inicio: agoraLocal() });
  const [passo, setPasso] = useState<'dados' | 'confirmar' | 'feito'>('dados');
  const [tentou, setTentou] = useState(false);
  const [criada, setCriada] = useState<Ordem | null>(null);
  const centro = centros.data?.itens.find((c) => c.id === f.centroId);
  const conferir = passo === 'confirmar';
  const abertos = useQuery({ queryKey: ['ordens-servico', 'apontamentos-abertos'], queryFn: () => api<unknown>('/ordens-servico/apontamentos/abertos').then(lista<Apont>), enabled: conferir, retry: false });
  const emExec = useQuery({ queryKey: ['ordens-servico', 'lista-quebra', 'EM_EXECUCAO'], queryFn: () => api<unknown>('/ordens-servico', { query: { status: 'EM_EXECUCAO' } }).then(lista<OSResumo>), enabled: conferir, retry: false });
  const previstas = centro ? osPrevistasNaQuebra(centro, abertos.data ?? [], (emExec.data ?? []).map((o) => ({ ...o, centroAtual: typeof o.centroAtual === 'string' ? o.centroAtual : (o.centroAtual as { nome?: string } | null)?.nome ?? null }))) : [];
  const registrar = useAcao(() => api<Ordem>('/manutencao/quebras', { method: 'POST', body: { centroId: f.centroId, descricao: f.descricao.trim(), inicio: f.inicio || undefined } }), {
    invalida: [...INVAL_MANUTENCAO, ['ordens-servico']],
    sucesso: (o) => `Quebra registrada. Corretiva ${o.numero} aberta e o centro está parado.`,
    onSuccess: (o) => { setCriada(o); setPasso('feito'); }
  });
  const erros = { centroId: !f.centroId ? 'Escolha o centro que quebrou.' : null, descricao: f.descricao.trim().length < 3 ? 'Conte o que aconteceu, como “Spindle travou”.' : null };

  if (passo === 'feito' && criada) {
    const afetadas = Array.isArray(criada.osAfetadas) ? criada.osAfetadas : [];
    return (
      <Modal aberto onFechar={onFechar} titulo="Quebra registrada" rodape={<><Button onClick={onFechar}>Fechar</Button><Button variante="primario" onClick={() => onAbrirOrdem(criada.id)}>Abrir {criada.numero}</Button></>}>
        <p className="m-0 text-ink-2">A corretiva <strong className="mono text-ink-1">{criada.numero}</strong> já está em execução no {criada.centroNome ?? 'centro'}, e a parada vale desde o início informado. Ao concluir a ordem, a parada fecha e as horas paradas são gravadas.</p>
        {afetadas.length ? (
          <div className="p-3 rounded-field bg-warn-soft flex flex-col gap-1.5">
            <strong className="text-[14px]">OS pausadas por quebra</strong>
            <ul className="m-0 p-0 list-none flex flex-wrap gap-3">{afetadas.map((a) => <li key={a.id}><Link to={`/ordens-servico/${a.id}`} className="mono font-medium">{a.numero}</Link></li>)}</ul>
          </div>
        ) : <p className="m-0 text-[14px] text-ink-2">Nenhuma OS estava rodando no centro.</p>}
      </Modal>
    );
  }

  if (conferir) {
    const carregando = abertos.isLoading || emExec.isLoading;
    const semConferir = abertos.isError && emExec.isError;
    return (
      <Modal aberto onFechar={onFechar} faixa titulo={`Parar o ${centro?.nome ?? 'centro'}?`}
        rodape={<><Button icone={ArrowLeft} onClick={() => setPasso('dados')}>Voltar</Button><Button variante="primario" icone={Siren} carregando={registrar.isPending} onClick={() => registrar.mutate(undefined)}>Registrar quebra</Button></>}>
        <p className="m-0 text-ink-2">Abre uma corretiva já em execução e marca o centro como parado desde <span className="mono">{f.inicio.replace('T', ' ').split(' ').map((x, i) => (i === 0 ? x.split('-').reverse().join('/') : x)).join(' ')}</span>. O planejamento deixa de contar com ele até a ordem ser concluída.</p>
        {carregando ? <Carregando linhas={2} rotulo="Conferindo OS em andamento" /> : semConferir ? (
          <p className="m-0 p-3 rounded-field bg-surface-2 text-[14px]">Não deu para conferir as OS em andamento agora. As que estiverem rodando neste centro serão pausadas com motivo quebra.</p>
        ) : previstas.length ? (
          <div className="p-3 rounded-field bg-warn-soft flex flex-col gap-1.5">
            <strong className="text-[14px] flex items-center gap-2"><TriangleAlert className="size-4 text-warn" aria-hidden />{previstas.length === 1 ? 'Esta OS vai ser pausada' : `Estas ${previstas.length} OS vão ser pausadas`}</strong>
            <ul className="m-0 pl-5 text-[14px]">{previstas.map((o) => <li key={o.id}><span className="mono font-medium">{o.numero}</span>{o.titulo && ` · ${o.titulo}`}</li>)}</ul>
            <span className="text-caption text-ink-2">Quem acompanha as OS recebe o aviso.</span>
          </div>
        ) : <p className="m-0 p-3 rounded-field bg-surface-2 text-[14px]">Nenhuma OS rodando neste centro agora. Nada vai ser pausado.</p>}
      </Modal>
    );
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Registrar quebra"
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" icone={Siren} onClick={() => { setTentou(true); if (!erros.centroId && !erros.descricao) setPasso('confirmar'); }}>Continuar</Button></>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setTentou(true); if (!erros.centroId && !erros.descricao) setPasso('confirmar'); }} noValidate>
        {!centroId && (
          <SelectField label="Centro" required value={f.centroId} onChange={(v) => setF({ ...f, centroId: v })} vazio={centros.isLoading ? 'Carregando…' : 'Escolha o centro'}
            opcoes={(centros.data?.itens ?? []).filter((c) => c.status !== 'desativado').map((c) => ({ valor: c.id, rotulo: c.nome }))} erro={tentou ? erros.centroId : null} />
        )}
        <TextArea label="O que aconteceu" value={f.descricao} onChange={(v) => setF({ ...f, descricao: v })} hint={tentou && erros.descricao ? <span className="text-bad font-medium">{erros.descricao}</span> : 'Ex.: spindle travou com ruído no rolamento.'} />
        <TextField label="Desde quando" type="datetime-local" value={f.inicio} onChange={(v) => setF({ ...f, inicio: v })} hint="Vale como início da parada." />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
