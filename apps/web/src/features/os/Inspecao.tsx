import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ListChecks, X } from 'lucide-react';
import { avaliarMedicao } from '@promec/motor';
import { api } from '../../lib/api';
import type { ItemPlano, OrdemServico, PlanoInspecao } from '../../lib/types';
import { num, toNum } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { Button, IconButton } from '../../components/Button';
import { DecimalInput, Segmented, Select, TextArea, TextField } from '../../components/Field';
import { BarraMedicao } from '../../components/BarraMedicao';
import { Pill } from '../../components/Pill';
import { useAuth } from '../../lib/auth';

interface Linha { planoItemId?: string; item?: ItemPlano; descricao: string; medido: string; conforme: boolean }

/** Conforme do item: dimensional pela faixa de tolerância (avaliarMedicao), os demais pelo inspetor. */
export function conformeDe(l: Linha): boolean | null {
  if (l.item?.tipo === 'DIMENSIONAL') {
    if (l.medido === '') return null;
    try {
      return avaliarMedicao({ nominal: l.item.nominal ?? '0', tolInferior: l.item.tolInferior ?? '0', tolSuperior: l.item.tolSuperior ?? '0', medido: l.medido }).conforme;
    } catch {
      return null;
    }
  }
  return l.conforme;
}

export function InspecaoDialog({ o, aberto, onFechar, onEnviar, enviando, padrao }: {
  o: OrdemServico; aberto: boolean; onFechar: () => void; enviando: boolean; padrao: string[];
  onEnviar: (body: unknown) => void;
}) {
  const { usuario } = useAuth();
  const buscado = useQuery({ queryKey: ['qualidade', 'planos', o.planoInspecaoId], queryFn: () => api<PlanoInspecao>(`/qualidade/planos/${o.planoInspecaoId}`), enabled: aberto && !o.planoInspecao && !!o.planoInspecaoId });
  const plano = { data: o.planoInspecao ?? buscado.data };
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [inspetor, setInspetor] = useState('');
  const [obs, setObs] = useState('');
  const [centro, setCentro] = useState('');
  useEffect(() => {
    if (!aberto) return;
    setInspetor(usuario?.nome ?? '');
    setObs('');
    setCentro(o.operacoes[o.operacoes.length - 1]?.centroId ?? '');
    setLinhas(plano.data
      ? plano.data.itens.map((it) => ({ planoItemId: it.id, item: it, descricao: it.descricao, medido: '', conforme: true }))
      : padrao.map((descricao) => ({ descricao, medido: '', conforme: true })));
  }, [aberto, plano.data, o.operacoes, padrao, usuario?.nome]);

  const estados = linhas.map(conformeDe);
  const pendentes = estados.filter((c) => c === null).length;
  const aprovada = pendentes === 0 && estados.every(Boolean);
  const reprovando = pendentes === 0 && !aprovada;
  const centros = [...new Map(o.operacoes.map((x) => [x.centroId, x.centroNome])).entries()].map(([valor, rotulo]) => ({ valor, rotulo }));
  const set = (i: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const enviar = () =>
    onEnviar({
      aprovada,
      inspetor: inspetor.trim(),
      itens: linhas.filter((l) => l.descricao.trim()).map((l, i) => ({ planoItemId: l.planoItemId, descricao: l.descricao, medido: l.medido || undefined, conforme: estados[i] ?? false })),
      observacao: obs.trim() || undefined,
      ...(reprovando && centro ? { centroRetrabalhoId: centro } : {})
    });

  return (
    <Modal aberto={aberto} onFechar={onFechar} largura={720} titulo="Inspeção"
      rodape={<><Button onClick={onFechar}>Voltar</Button>
        <Button variante={reprovando ? 'perigo' : 'primario'} icone={reprovando ? X : Check} carregando={enviando}
          disabled={linhas.length === 0 || pendentes > 0 || !inspetor.trim()} onClick={enviar}>
          {pendentes > 0 ? `Faltam ${pendentes} ${pendentes === 1 ? 'medida' : 'medidas'}` : reprovando ? 'Reprovar e abrir retrabalho' : 'Aprovar e concluir'}
        </Button></>}>
      {plano.data ? <p className="m-0 text-[14px] text-ink-2">Plano <strong>{plano.data.nome}</strong> · versão {plano.data.versao ?? o.planoVersao}. As medidas dimensionais se julgam sozinhas pela tolerância.</p>
        : <p className="m-0 text-[14px] text-ink-2">Esta OS não tem plano de inspeção. Use os itens abaixo ou ajuste à mão.</p>}
      <ul className="m-0 p-0 list-none flex flex-col gap-2" aria-label="Itens da inspeção">
        {linhas.map((l, i) => {
          const c = estados[i];
          const dim = l.item?.tipo === 'DIMENSIONAL';
          return (
            <li key={i} className={`flex flex-wrap items-end gap-3 p-3 rounded-field border ${c === false ? 'border-bad bg-bad-soft' : 'border-border bg-surface-2'}`}>
              {l.item ? (
                <span className="flex-[2_1_200px] min-w-0 flex flex-col">
                  <span className="font-medium">{l.descricao}</span>
                  <span className="text-caption text-ink-3">
                    {l.item.tipo.toLowerCase()}
                    {dim && ` · ${num(l.item.nominal, 3)} ${l.item.tolInferior && toNum(l.item.tolInferior) !== 0 ? num(l.item.tolInferior, 3) : '0'}/+${num(l.item.tolSuperior, 3)} ${l.item.unidade ?? 'mm'}`}
                    {l.item.instrumento ? ` · ${l.item.instrumento}` : ''}
                  </span>
                </span>
              ) : (
                <TextField className="flex-[2_1_200px]" label="Item" value={l.descricao} onChange={(v) => set(i, { descricao: v })} />
              )}
              {dim ? (
                <>
                  <label className="flex flex-col gap-1 w-[130px]">
                    <span className="text-[12.5px] font-medium text-ink-2">Medido</span>
                    <span className="campo !min-h-[40px] !px-3 !rounded-control"><DecimalInput value={l.medido} onChange={(v) => set(i, { medido: v })} className="text-right !h-9" aria-label={`Medido em ${l.descricao}`} /><span className="un">{l.item?.unidade ?? 'mm'}</span></span>
                  </label>
                  <div className="flex-[2_1_200px]"><BarraMedicao nominal={l.item!.nominal ?? '0'} tolInferior={l.item!.tolInferior ?? '0'} tolSuperior={l.item!.tolSuperior ?? '0'} medido={l.medido} unidade={l.item!.unidade ?? 'mm'} /></div>
                  <span aria-live="polite">{c === null ? <Pill>a medir</Pill> : c ? <Pill tom="ok">Conforme</Pill> : <Pill tom="bad">Fora da tolerância</Pill>}</span>
                </>
              ) : (
                <Segmented<'s' | 'n'> label={`Conforme: ${l.descricao}`} ocultarRotulo tamanho="sm" value={l.conforme ? 's' : 'n'} onChange={(v) => set(i, { conforme: v === 's' })} opcoes={[{ valor: 's', rotulo: 'Conforme' }, { valor: 'n', rotulo: 'Não conforme' }]} />
              )}
              {!l.item && <IconButton icone={X} rotulo={`Tirar ${l.descricao}`} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} />}
            </li>
          );
        })}
      </ul>
      {!plano.data && <Button tamanho="sm" variante="terciario" icone={ListChecks} className="self-start" onClick={() => setLinhas((ls) => [...ls, { descricao: '', medido: '', conforme: true }])}>Adicionar item</Button>}
      <div className={`p-3 rounded-field text-[14px] font-semibold ${pendentes ? 'bg-surface-2' : aprovada ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`} aria-live="polite">
        {pendentes ? 'Preencha as medidas para o resultado aparecer.' : aprovada ? 'Tudo conforme: a OS vai para concluída.' : 'Há item fora: a OS volta para retrabalho e abre uma não-conformidade.'}
      </div>
      <TextField label="Inspetor" value={inspetor} onChange={setInspetor} />
      {reprovando && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-medium text-ink-2">Onde vai ser o retrabalho</span>
          <Select value={centro} onChange={setCentro} opcoes={centros} vazio="O último centro do roteiro" />
        </label>
      )}
      <TextArea label={reprovando ? 'O que deu errado?' : 'Observação'} hint={reprovando ? 'Se deixar em branco, a NC sai com as medidas fora da faixa.' : undefined} value={obs} onChange={setObs} />
    </Modal>
  );
}
