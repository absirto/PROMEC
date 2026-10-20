import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, TriangleAlert } from 'lucide-react';
import { api, msgErro } from '../../lib/api';
import type { Promessa } from '../../lib/types';
import { data, pct, toNum } from '../../lib/format';
import { Card, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { tomOcupacao } from '../planejamento/plano';
import type { LinhaForm } from './LinhaEditor';

/** Horas por centro do roteiro, do mesmo jeito que o planejamento lê o orçamento. */
export function roteiroDasLinhas(linhas: LinhaForm[], lote: number) {
  const ops: { centroId: string; horas: string }[] = [];
  for (const l of linhas) {
    if (l.tipo === 'operacao' && l.centroId) {
      const h = toNum(l.setupHorasPorLote) + toNum(l.cicloHorasPorPeca) * lote;
      if (h > 0) ops.push({ centroId: l.centroId, horas: String(h) });
    } else if (l.tipo === 'maoDeObra' && l.centroId) {
      const fator = l.fatorDificuldade === undefined || l.fatorDificuldade === '' ? 1 : toNum(l.fatorDificuldade);
      const h = toNum(l.tempoPadraoHoras) * fator * ((l.base ?? 'lote') === 'peca' ? lote : 1);
      if (h > 0) ops.push({ centroId: l.centroId, horas: String(h) });
    }
  }
  return ops;
}

export function CartaoPrazo({ linhas, lote, promessaSalva, usarSalva, prazo, onPrazo, editavel }: {
  linhas: LinhaForm[]; lote: number; promessaSalva?: Promessa | null; usarSalva: boolean; prazo: string; onPrazo: (d: string) => void; editavel: boolean;
}) {
  const roteiro = useMemo(() => roteiroDasLinhas(linhas, lote), [linhas, lote]);
  const chaveAgora = JSON.stringify(roteiro);
  const [chave, setChave] = useState(chaveAgora);
  useEffect(() => {
    const t = window.setTimeout(() => setChave(chaveAgora), 700);
    return () => window.clearTimeout(t);
  }, [chaveAgora]);
  const q = useQuery({
    queryKey: ['promessa', chave],
    queryFn: () => api<Promessa>('/planejamento/promessa', { method: 'POST', body: { operacoes: JSON.parse(chave) } }),
    enabled: !(usarSalva && promessaSalva) && JSON.parse(chave).length > 0,
    staleTime: 60_000,
    placeholderData: (p) => p
  });
  const p = usarSalva && promessaSalva ? promessaSalva : q.data;
  const calculando = chave !== chaveAgora || q.isFetching;
  const tom = p ? tomOcupacao(p.ocupacaoMaxima) : 'ok';

  return (
    <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-prazo">
      <CardHeader id="h-prazo" titulo="Prazo" sub="Com a fila de hoje e a capacidade real das máquinas." />
      {roteiro.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-2">Coloque as operações com a máquina para o ProMEC calcular a data mais cedo.</p>
      ) : q.isError && !p ? (
        <p role="alert" className="m-0 text-[14px] text-bad">{msgErro(q.error)}</p>
      ) : p ? (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3" aria-live="polite" aria-busy={calculando}>
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-2">Dá para entregar em</span>
            <span className={`mono text-[30px] font-bold leading-tight ${calculando ? 'opacity-50' : ''}`}>{p.fim ? data(p.fim) : 'não cabe no horizonte'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-2">Ocupação no período</span>
            <span className={`mono text-[18px] font-bold ${tom === 'bad' ? 'text-bad' : tom === 'warn' ? 'text-warn' : 'text-ok'}`}>{pct(p.ocupacaoMaxima, 0)}</span>
          </div>
          {editavel && p.fim && prazo !== p.fim && <Button tamanho="sm" icone={CalendarCheck2} onClick={() => onPrazo(p.fim!)}>Usar esta data</Button>}
        </div>
      ) : (
        <p className="m-0 text-[14px] text-ink-3">Calculando…</p>
      )}
      {p?.sobrecarga && (
        <p className="m-0 flex gap-2 items-start p-3 rounded-field bg-warn-soft text-[14px]">
          <TriangleAlert className="size-4 text-warn mt-0.5 flex-none" aria-hidden />
          Uma das máquinas passa de 90% nessa janela. Prometa com folga ou converse com a produção antes de enviar.
        </p>
      )}
      <TextField label="Prazo prometido ao cliente" type="date" mono value={prazo} onChange={onPrazo} disabled={!editavel} hint={prazo ? `Vai no orçamento e vira o prazo da OS: ${data(prazo)}.` : 'Ainda sem data prometida.'} className="max-w-[320px]" />
    </Card>
  );
}
