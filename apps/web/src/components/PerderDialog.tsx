import { useEffect, useState } from 'react';
import { ThumbsDown } from 'lucide-react';
import { brl, pct, toNum } from '../lib/format';
import { Modal } from './Modal';
import { Button } from './Button';
import { NumberField, Segmented, TextArea, TextField } from './Field';

export type MotivoPerda = 'PRECO' | 'PRAZO' | 'CONCORRENTE' | 'DESISTENCIA' | 'OUTRO';
export const MOTIVOS_PERDA: Record<MotivoPerda, string> = { PRECO: 'Preço', PRAZO: 'Prazo', CONCORRENTE: 'Fechou com outro', DESISTENCIA: 'Desistiu', OUTRO: 'Outro' };
export interface CorpoPerda { motivo: MotivoPerda; concorrente?: string; precoAceito?: string; observacao?: string }

/** Perda de oportunidade ou recusa de orçamento: o motivo e, se foi preço, quanto o cliente aceitaria pagar. */
export function PerderDialog({ aberto, onFechar, titulo, precoOfertado, onConfirmar, enviando, erro }: {
  aberto: boolean; onFechar: () => void; titulo: string; precoOfertado?: string | number | null; onConfirmar: (b: CorpoPerda) => void; enviando?: boolean; erro?: string | null;
}) {
  const [f, setF] = useState({ motivo: 'PRECO' as MotivoPerda, concorrente: '', precoAceito: '', observacao: '' });
  const [tentou, setTentou] = useState(false);
  useEffect(() => { if (aberto) { setF({ motivo: 'PRECO', concorrente: '', precoAceito: '', observacao: '' }); setTentou(false); } }, [aberto]);
  const faltaPreco = f.motivo === 'PRECO' && !(toNum(f.precoAceito) > 0);
  const razao = toNum(precoOfertado) > 0 && toNum(f.precoAceito) > 0 ? toNum(f.precoAceito) / toNum(precoOfertado) : null;
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={titulo}
      rodape={<><Button onClick={onFechar}>Voltar</Button><Button variante="perigo" icone={ThumbsDown} carregando={enviando}
        onClick={() => { setTentou(true); if (!faltaPreco) onConfirmar({ motivo: f.motivo, concorrente: f.concorrente.trim() || undefined, precoAceito: f.motivo === 'PRECO' ? String(toNum(f.precoAceito)) : undefined, observacao: f.observacao.trim() || undefined }); }}>Registrar perda</Button></>}>
      <p className="m-0 text-ink-2 text-[14px]">Saber por que perdeu é o que ajusta o próximo preço. Leva 10 segundos.</p>
      <Segmented<MotivoPerda> label="Por que não fechou?" tamanho="sm" value={f.motivo} onChange={(v) => setF({ ...f, motivo: v })} opcoes={(Object.keys(MOTIVOS_PERDA) as MotivoPerda[]).map((k) => ({ valor: k, rotulo: MOTIVOS_PERDA[k] }))} />
      {f.motivo === 'PRECO' && (
        <NumberField label="Quanto o cliente aceitaria pagar?" prefixo="R$" value={f.precoAceito} onChange={(v) => setF({ ...f, precoAceito: v })}
          erro={tentou && faltaPreco ? 'Com motivo preço, diga o valor que fecharia. É o que mostra se a margem tem folga.' : null}
          hint={razao !== null ? `${pct(razao)} do ofertado (${brl(precoOfertado)})` : precoOfertado ? `Ofertado: ${brl(precoOfertado)}` : undefined} />
      )}
      {(f.motivo === 'CONCORRENTE' || f.motivo === 'PRECO') && <TextField label="Concorrente (se souber)" value={f.concorrente} onChange={(v) => setF({ ...f, concorrente: v })} />}
      <TextArea label="Observação" value={f.observacao} onChange={(v) => setF({ ...f, observacao: v })} />
      {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
    </Modal>
  );
}
