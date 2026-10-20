import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { toNum } from '../../lib/format';
import { useAcao, useCentros } from '../../lib/queries';
import { Button, IconButton } from '../../components/Button';
import { NumberField, Segmented, SelectField, TextField, Toggle } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { limparChecklist, moverItem, TIPO_PLANO, type Plano, type TipoPlano } from './manutencao';
import { INVAL_MANUTENCAO } from './queries';

/** Criar ou editar um plano preventivo, com o checklist que vira a lista de conferência da ordem. */
export function PlanoForm({ plano, centroId, onFechar }: { plano?: Plano | null; centroId?: string; onFechar: () => void }) {
  const novo = !plano;
  const centros = useCentros();
  const [f, setF] = useState({
    centroId: plano?.centroId ?? centroId ?? '',
    nome: plano?.nome ?? '',
    tipo: (plano?.tipo ?? 'HORAS') as TipoPlano,
    intervaloHoras: plano?.intervaloHoras ?? '',
    intervaloDias: plano?.intervaloDias != null ? String(plano.intervaloDias) : '',
    duracaoHoras: plano?.duracaoHoras ?? '4',
    ultimaExecucao: plano?.ultimaExecucao ?? '',
    ativo: plano?.ativo ?? true,
    checklist: plano?.checklist?.length ? [...plano.checklist] : ['']
  });
  const [tentou, setTentou] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const erros = {
    centroId: !f.centroId ? 'Escolha o centro que recebe a preventiva.' : null,
    nome: !f.nome.trim() ? 'Dê um nome que diga o que se faz, como “Preventiva 500 h — lubrificação”.' : null,
    intervalo:
      f.tipo === 'HORAS'
        ? toNum(f.intervaloHoras) <= 0 ? 'Informe de quantas em quantas horas de uso.' : null
        : !(Math.round(toNum(f.intervaloDias)) >= 1) ? 'Informe de quantos em quantos dias.' : null
  };
  const salvar = useAcao(
    () => {
      const corpo = {
        nome: f.nome.trim(),
        tipo: f.tipo,
        ...(f.tipo === 'HORAS' ? { intervaloHoras: f.intervaloHoras } : { intervaloDias: Math.round(toNum(f.intervaloDias)) }),
        duracaoHoras: f.duracaoHoras || '0',
        checklist: limparChecklist(f.checklist),
        ativo: f.ativo,
        ...(f.ultimaExecucao && (novo || f.ultimaExecucao !== plano?.ultimaExecucao) ? { ultimaExecucao: f.ultimaExecucao } : {})
      };
      return novo ? api<Plano>('/manutencao/planos', { method: 'POST', body: { ...corpo, centroId: f.centroId } }) : api<Plano>(`/manutencao/planos/${plano!.id}`, { method: 'PATCH', body: corpo });
    },
    { invalida: INVAL_MANUTENCAO, sucesso: (p) => (novo ? `Plano criado. A ordem abre sozinha quando “${p.nome}” ficar próxima.` : 'Plano atualizado.'), onSuccess: onFechar }
  );
  const enviar = (e?: FormEvent) => {
    e?.preventDefault();
    setTentou(true);
    if (Object.values(erros).some(Boolean)) return;
    salvar.mutate(undefined);
  };
  const ck = f.checklist;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={novo ? 'Novo plano preventivo' : `Editar ${plano!.nome}`}
      largura={640}
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={() => enviar()}>{novo ? 'Criar plano' : 'Salvar'}</Button></>}
    >
      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        {novo && !centroId && (
          <SelectField label="Centro" required value={f.centroId} onChange={(v) => set('centroId', v)} vazio={centros.isLoading ? 'Carregando…' : 'Escolha o centro'}
            opcoes={(centros.data?.itens ?? []).filter((c) => c.status !== 'desativado').map((c) => ({ valor: c.id, rotulo: c.nome }))} erro={tentou ? erros.centroId : null} />
        )}
        <TextField label="Nome do plano" required value={f.nome} onChange={(v) => set('nome', v)} placeholder="Preventiva 500 h — lubrificação e folgas" erro={tentou ? erros.nome : null} />
        <Segmented<TipoPlano> label="Quando vence" value={f.tipo} onChange={(v) => set('tipo', v)} opcoes={(Object.keys(TIPO_PLANO) as TipoPlano[]).map((t) => ({ valor: t, rotulo: TIPO_PLANO[t] }))} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {f.tipo === 'HORAS' ? (
            <NumberField label="A cada" sufixo="h de uso" value={f.intervaloHoras} onChange={(v) => set('intervaloHoras', v)} erro={tentou ? erros.intervalo : null} hint="Conta as horas apontadas nas OS do centro." />
          ) : (
            <NumberField label="A cada" sufixo="dias" value={f.intervaloDias} onChange={(v) => set('intervaloDias', v)} erro={tentou ? erros.intervalo : null} />
          )}
          <NumberField label="Duração da parada" sufixo="h" value={f.duracaoHoras} onChange={(v) => set('duracaoHoras', v)} />
          <TextField label="Última execução" type="date" value={f.ultimaExecucao} onChange={(v) => set('ultimaExecucao', v)}
            hint={novo ? 'Deixe vazio se nunca foi feita: o contador começa hoje.' : 'Mudar a data zera o contador a partir dela.'} />
        </div>

        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
          <legend className="text-[13.5px] font-medium text-ink-2 mb-1.5">Checklist</legend>
          <p className="m-0 text-caption text-ink-3">Quem executar marca item por item ao concluir a ordem.</p>
          <ol className="m-0 p-0 list-none flex flex-col gap-2">
            {ck.map((item, i) => (
              <li key={i} className="flex items-center gap-1 min-w-0">
                <span className="mono text-caption text-ink-3 w-6 text-right flex-none" aria-hidden>{i + 1}.</span>
                <div className="campo flex-1 min-w-0">
                  <input aria-label={`Item ${i + 1} do checklist`} value={item} placeholder="Trocar óleo do cabeçote" onChange={(e) => set('checklist', ck.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); set('checklist', [...ck.slice(0, i + 1), '', ...ck.slice(i + 1)]); } }} />
                </div>
                <IconButton icone={ArrowUp} rotulo={`Subir item ${i + 1}`} disabled={i === 0} className="disabled:opacity-30" onClick={() => set('checklist', moverItem(ck, i, -1))} />
                <IconButton icone={ArrowDown} rotulo={`Descer item ${i + 1}`} disabled={i === ck.length - 1} className="disabled:opacity-30 max-sm:hidden" onClick={() => set('checklist', moverItem(ck, i, 1))} />
                <IconButton icone={Trash2} rotulo={`Tirar item ${i + 1}`} onClick={() => set('checklist', ck.length === 1 ? [''] : ck.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ol>
          <Button tamanho="sm" icone={Plus} className="self-start" onClick={() => set('checklist', [...ck, ''])}>Incluir item</Button>
        </fieldset>
        <Toggle label="Plano ativo" descricao="Pausado, não gera ordem nem entra nos alertas." value={f.ativo} onChange={(v) => set('ativo', v)} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
