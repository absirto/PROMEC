import { pct, toNum } from '../lib/format';

/** Régua de margem: vermelha até o mínimo, amarela até o alvo, verde depois. */
export function MarginRuler({ efetiva, minima, alvo }: { efetiva: string | number; minima: string | number; alvo: string | number }) {
  const e = toNum(efetiva), mn = toNum(minima), al = toNum(alvo);
  const escala = Math.max(0.4, al * 2, e * 1.1);
  const p = (v: number) => Math.max(0, Math.min(100, (v / escala) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative h-2.5 rounded-full"
        style={{ background: `linear-gradient(90deg, var(--pm-bad) 0 ${p(mn)}%, var(--pm-signal) ${p(mn)}% ${p(al)}%, var(--pm-ok) ${p(al)}% 100%)` }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.round(escala * 100)}
        aria-valuenow={Math.round(e * 1000) / 10}
        aria-label={`Margem efetiva ${pct(e)}; mínimo ${pct(mn)}, alvo ${pct(al)}`}
      >
        <span
          className="absolute -top-1.5 w-1.5 h-[22px] -ml-[3px] rounded-[3px] bg-ink-1 transition-[left] duration-panel ease-promec"
          style={{ left: `${p(e)}%`, boxShadow: '0 0 0 3px var(--pm-surface-1)' }}
        />
      </div>
      <div className="relative h-4 text-[11.5px] text-ink-3 mono">
        <span className="absolute -translate-x-full pr-1 whitespace-nowrap" style={{ left: `${p(mn)}%` }}>mín {pct(mn, 0)}</span>
        <span className="absolute pl-1 whitespace-nowrap" style={{ left: `${p(al)}%` }}>alvo {pct(al, 0)}</span>
      </div>
    </div>
  );
}
