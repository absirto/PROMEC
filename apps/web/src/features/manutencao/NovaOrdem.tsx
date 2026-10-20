import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAcao, useCentros } from '../../lib/queries';
import { Button } from '../../components/Button';
import { Segmented, SelectField, TextArea, TextField, Toggle } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { TIPO_ORDEM, type Ordem, type Plano, type TipoOrdem } from './manutencao';
import { INVAL_MANUTENCAO, useFornecedores } from './queries';

/** Nova ordem manual (preventiva ou corretiva), opcionalmente ligada a um plano. */
export function NovaOrdem({ centroId, planos = [], onFechar, onCriada }: { centroId?: string; planos?: Plano[]; onFechar: () => void; onCriada?: (o: Ordem) => void }) {
  const centros = useCentros();
  const [f, setF] = useState({ centroId: centroId ?? '', tipo: 'PREVENTIVA' as TipoOrdem, planoId: '', descricao: '', prevista: '', bloqueiaAgenda: true, execucao: 'INTERNA', fornecedorId: '' });
  const [tentou, setTentou] = useState(false);
  const forn = useFornecedores(f.execucao === 'EXTERNA');
  const planosDoCentro = planos.filter((p) => p.centroId === f.centroId && p.ativo);
  const erros = {
    centroId: !f.centroId ? 'Escolha o centro.' : null,
    descricao: !f.descricao.trim() ? 'Descreva o serviço.' : null,
    prevista: f.bloqueiaAgenda && !f.prevista ? 'Para bloquear a agenda, informe o dia previsto.' : null
  };
  const criar = useAcao(
    () => api<Ordem>('/manutencao/ordens', {
      method: 'POST',
      body: {
        centroId: f.centroId, tipo: f.tipo, descricao: f.descricao.trim(), prevista: f.prevista || undefined, bloqueiaAgenda: !!f.prevista && f.bloqueiaAgenda,
        execucao: f.execucao, fornecedorId: f.execucao === 'EXTERNA' && f.fornecedorId ? f.fornecedorId : undefined, planoId: f.tipo === 'PREVENTIVA' && f.planoId ? f.planoId : undefined
      }
    }),
    { invalida: INVAL_MANUTENCAO, sucesso: (o) => `${o.numero} aberta.${o.bloqueiaAgenda ? ' O dia previsto já aparece como parada no planejamento.' : ''}`, onSuccess: (o) => { onFechar(); onCriada?.(o); } }
  );
  const enviar = (e?: FormEvent) => {
    e?.preventDefault();
    setTentou(true);
    if (Object.values(erros).some(Boolean)) return;
    criar.mutate(undefined);
  };
  return (
    <Modal aberto onFechar={onFechar} titulo="Nova ordem de manutenção" largura={600}
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" icone={Plus} carregando={criar.isPending} onClick={() => enviar()}>Abrir ordem</Button></>}>
      <form className="flex flex-col gap-3" onSubmit={enviar} noValidate>
        {!centroId && (
          <SelectField label="Centro" required value={f.centroId} onChange={(v) => setF({ ...f, centroId: v, planoId: '' })} vazio={centros.isLoading ? 'Carregando…' : 'Escolha o centro'}
            opcoes={(centros.data?.itens ?? []).filter((c) => c.status !== 'desativado').map((c) => ({ valor: c.id, rotulo: c.nome }))} erro={tentou ? erros.centroId : null} />
        )}
        <Segmented<TipoOrdem> label="Tipo" value={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} opcoes={(Object.keys(TIPO_ORDEM) as TipoOrdem[]).map((t) => ({ valor: t, rotulo: TIPO_ORDEM[t] }))} />
        {f.tipo === 'PREVENTIVA' && planosDoCentro.length > 0 && (
          <SelectField label="Plano" value={f.planoId} onChange={(v) => setF({ ...f, planoId: v, descricao: f.descricao || planosDoCentro.find((p) => p.id === v)?.nome || '' })} vazio="Sem plano (avulsa)"
            opcoes={planosDoCentro.map((p) => ({ valor: p.id, rotulo: p.nome }))} hint="Ligada ao plano, concluir zera o contador e traz o checklist." />
        )}
        <TextArea label="Serviço" value={f.descricao} onChange={(v) => setF({ ...f, descricao: v })} hint={tentou && erros.descricao ? <span className="text-bad font-medium">{erros.descricao}</span> : undefined} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Dia previsto" type="date" value={f.prevista} onChange={(v) => setF({ ...f, prevista: v })} erro={tentou ? erros.prevista : null} />
          <Segmented label="Execução" value={f.execucao} onChange={(v) => setF({ ...f, execucao: v })} opcoes={[{ valor: 'INTERNA', rotulo: 'Interna' }, { valor: 'EXTERNA', rotulo: 'Externa' }]} />
        </div>
        {f.execucao === 'EXTERNA' && (
          <SelectField label="Fornecedor" value={f.fornecedorId} onChange={(v) => setF({ ...f, fornecedorId: v })} vazio={forn.isLoading ? 'Carregando…' : 'Definir depois'} opcoes={(forn.data ?? []).map((x) => ({ valor: x.id, rotulo: x.fantasia || x.nome }))} />
        )}
        <Toggle label="Bloquear a agenda no dia" descricao="Cria a parada do centro no dia previsto; o planejamento tira essa capacidade." value={f.bloqueiaAgenda} onChange={(v) => setF({ ...f, bloqueiaAgenda: v })} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
