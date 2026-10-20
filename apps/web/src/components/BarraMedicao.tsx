import { barraMedicao } from '../features/suprimentos/sup';
import { num, toNum } from '../lib/format';

/** Faixa de tolerância com marcador do valor medido; verde dentro, vermelho fora. */
export function BarraMedicao({ nominal, tolInferior, tolSuperior, medido, unidade = 'mm' }: { nominal: string; tolInferior: string; tolSuperior: string; medido: string; unidade?: string }) {
  const casas = Math.max(2, ...[tolInferior, tolSuperior].map((t) => (String(t ?? '').split('.')[1]?.length ?? 0)));
  let b: ReturnType<typeof barraMedicao> | null = null;
  try {
    b = medido === '' ? null : barraMedicao({ nominal, tolInferior, tolSuperior, medido });
  } catch {
    b = null;
  }
  const min = toNum(nominal) + toNum(tolInferior), max = toNum(nominal) + toNum(tolSuperior);
  const faixaI = (0.25 / 1.5) * 100, faixaF = (1.25 / 1.5) * 100;
  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="relative h-3 rounded-full bg-bad-soft" role="img"
        aria-label={b ? `Medido ${num(medido, casas)} ${unidade}: ${b.conforme ? 'dentro' : 'fora'} da faixa de ${num(min, casas)} a ${num(max, casas)}` : `Faixa de ${num(min, casas)} a ${num(max, casas)} ${unidade}`}>
        <span className="absolute inset-y-0 bg-ok-soft border-x-2 border-ok" style={{ left: `${faixaI}%`, width: `${faixaF - faixaI}%` }} />
        {b && (
          <span className={`absolute -top-1.5 w-1.5 h-6 -ml-[3px] rounded-[3px] transition-[left] duration-panel ease-promec ${b.conforme ? 'bg-ok' : 'bg-bad'}`}
            style={{ left: `${b.marcador}%`, boxShadow: '0 0 0 2px var(--pm-surface-1)' }} />
        )}
      </div>
      <div className="relative h-4 mono text-[11px] text-ink-3">
        <span className="absolute -translate-x-1/2" style={{ left: `${faixaI}%` }}>{num(min, casas)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${faixaF}%` }}>{num(max, casas)}</span>
      </div>
    </div>
  );
}
