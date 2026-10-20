import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageMinus, Undo2 } from 'lucide-react';
import { api, ApiError, msgErro } from '../../lib/api';
import type { Lista, Lote, Movimento, OrdemServico } from '../../lib/types';
import { brl, data, num, toNum } from '../../lib/format';
import { useAcao } from '../../lib/queries';
import { Card, CardHeader } from '../../components/Card';
import { Button, IconButton } from '../../components/Button';
import { NumberField, SelectField, TextField } from '../../components/Field';
import { ItemPicker, useItens } from '../../components/ItemPicker';
import { useToast } from '../../components/Toast';

const lista = <T,>(x: T[] | Lista<T> | undefined | null): T[] => (Array.isArray(x) ? x : x?.itens ?? []);

/** Baixa de material do estoque para a OS, ao custo médio, com estorno. */
export function ConsumosOS({ o, editavel }: { o: OrdemServico; editavel: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const itens = useItens();
  const movs = useQuery({ queryKey: ['estoque', 'movimentos', 'os', o.id], queryFn: () => api<Lista<Movimento>>('/estoque/movimentos', { query: { osId: o.id } }), enabled: !o.consumos });
  const [c, setC] = useState({ itemId: '', quantidade: '', loteId: '', custoId: '', justificativa: '' });
  const [pedeJust, setPedeJust] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const item = itens.data?.find((i) => i.id === c.itemId);
  const lotes = useQuery({ queryKey: ['estoque', 'lotes', c.itemId], queryFn: () => api<Lote[] | Lista<Lote>>('/estoque/lotes', { query: { itemId: c.itemId } }), enabled: !!item?.rastreavel, select: lista });
  const aplicar = (os: OrdemServico) => { if (os?.operacoes && os.resultado) qc.setQueryData(['ordens-servico', o.id], os); };
  const inval = [['ordens-servico'], ['estoque'], ['itens']];
  const consumir = useAcao(() => api<OrdemServico>(`/ordens-servico/${o.id}/consumos`, { method: 'POST', body: { itemId: c.itemId, quantidade: c.quantidade, loteId: c.loteId || undefined, custoId: c.custoId || undefined, justificativa: c.justificativa.trim() || undefined } }), {
    invalida: inval,
    sucesso: item ? `Baixa de ${num(c.quantidade, 2)} ${item.unidadeConsumo} feita ao custo médio de ${brl(item.custoMedio)}. O real da OS já mudou.` : 'Baixa feita.',
    onSuccess: (os) => { aplicar(os); setPedeJust(false); setC({ itemId: '', quantidade: '', loteId: '', custoId: '', justificativa: '' }); }
  });
  const estornar = async (m: Movimento) => {
    try {
      const os = await api<OrdemServico>(`/ordens-servico/${o.id}/consumos/${m.id}`, { method: 'DELETE' });
      aplicar(os);
      inval.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast('Consumo estornado. O material voltou para o estoque.', 'ok');
    } catch (e) {
      toast(e instanceof ApiError && e.codigo === 'JA_ESTORNADO' ? 'Esse consumo já foi estornado.' : msgErro(e), 'bad');
    }
  };
  const enviar = () => {
    setErro(null);
    consumir.mutate(undefined, {
      onError: (e) => setErro(e instanceof ApiError && e.codigo === 'SALDO_INSUFICIENTE' ? 'Não tem tudo isso disponível. Parte pode estar reservada para outra OS.'
        : e instanceof ApiError && e.codigo === 'LOTE_OBRIGATORIO' ? 'Item rastreável: escolha o lote que foi para a máquina.'
          : e instanceof ApiError && e.codigo === 'ITEM_DE_CENTRO' ? 'Insumo e ferramenta geral não entram na OS: eles vão contra o centro de trabalho, pelo estoque (saída para centro).'
          : e instanceof ApiError && e.codigo === 'JUSTIFICATIVA_OBRIGATORIA' ? (setPedeJust(true), `${e.message}`) : msgErro(e))
    });
  };
  const consumos = (o.consumos ?? movs.data?.itens ?? []).filter((m) => m.tipo === 'SAIDA_OS');
  const valido = c.itemId && toNum(c.quantidade) > 0 && (!item?.rastreavel || c.loteId) && (!pedeJust || c.justificativa.trim());
  const prev = item ? toNum(c.quantidade) * toNum(item.custoMedio) : 0;

  return (
    <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-consumos">
      <CardHeader id="h-consumos" titulo="Material do estoque" sub="Baixa ao custo médio do momento; o valor entra no real da OS." />
      {consumos.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col">
          {consumos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-border first:border-0">
              <span className="flex-[2_1_200px] min-w-0 flex flex-col">
                <span className="font-medium text-[14.5px]">{m.item.descricao}</span>
                <span className="text-caption text-ink-3">{data(m.data)}{m.lote ? ` · lote ${typeof m.lote === 'string' ? m.lote : m.lote.codigo}` : ''}</span>
              </span>
              <span className={`mono text-[13.5px] ${m.estornado ? 'line-through text-ink-3' : ''}`}>{num(Math.abs(toNum(m.quantidade)), 2)} {m.item.unidade ?? ''} · <strong>{brl(Math.abs(toNum(m.valor)))}</strong></span>
              {m.estornado && <span className="text-caption text-ink-3">estornado</span>}
              {editavel && !m.estornado && <IconButton icone={Undo2} rotulo={`Estornar ${m.item.descricao}`} onClick={() => estornar(m)} className="size-9" />}
            </li>
          ))}
        </ul>
      )}
      {consumos.length === 0 && <p className="m-0 text-[14px] text-ink-2">Nada baixado do estoque ainda.</p>}
      {(o.reservas ?? []).filter((r) => toNum(r.pendente) > 0).map((r) => (
        <p key={r.id} className="m-0 text-[13.5px] text-ink-2">Reservado para esta OS: <strong className="mono">{num(r.pendente, 2)} {r.unidade ?? ''}</strong> de {r.descricao} ainda a consumir.</p>
      ))}
      {editavel && (
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3 p-3.5 rounded-field bg-surface-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13.5px] font-medium text-ink-2">Item</span>
            <ItemPicker value={c.itemId} onChange={(id) => setC({ ...c, itemId: id, loteId: '' })} />
          </label>
          {item?.rastreavel && (
            <SelectField label="Lote" value={c.loteId} onChange={(v) => setC({ ...c, loteId: v })} vazio="Escolha o lote"
              opcoes={(lotes.data ?? []).filter((l) => toNum(l.saldo) > 0).map((l) => ({ valor: l.id, rotulo: `${l.codigo} · saldo ${num(l.saldo, 2)}${l.certificado?.corrida ? ` · corrida ${l.certificado.corrida}` : ''}` }))} />
          )}
          <NumberField label="Quantidade" sufixo={item?.unidadeConsumo} value={c.quantidade} onChange={(v) => setC({ ...c, quantidade: v })}
            hint={item ? `disponível ${num(item.saldo?.disponivel ?? 0, 2)} · ${prev > 0 ? `vai custar ${brl(prev)}` : `${brl(item.custoMedio)}/${item.unidadeConsumo}`}` : undefined} />
          {o.custos.length > 0 && (
            <SelectField className={item?.rastreavel ? 'sm:col-span-2' : ''} label="Lançar em qual custo" value={c.custoId} onChange={(v) => setC({ ...c, custoId: v })} vazio="O custo de material desse item" opcoes={o.custos.map((x) => ({ valor: x.id, rotulo: x.descricao }))} />
          )}
          {pedeJust && <TextField className="sm:col-span-2" label="Por que passou do orçado?" value={c.justificativa} onChange={(v) => setC({ ...c, justificativa: v })} placeholder="Ex.: refugo de 2 peças no setup" />}
          {erro && <p role="alert" className="m-0 sm:col-span-2 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
          <Button icone={PackageMinus} className="self-end justify-self-start" disabled={!valido} carregando={consumir.isPending} onClick={enviar}>Dar baixa</Button>
        </div>
      )}
    </Card>
  );
}
