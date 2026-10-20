import { Star } from 'lucide-react';
import { num, toNum } from '../lib/format';

/** Avaliação de 0 a 5 em estrelas (preenchimento parcial) com o número ao lado. */
export function Estrelas({ valor, tamanho = 16 }: { valor: string | number | null | undefined; tamanho?: number }) {
  const v = Math.max(0, Math.min(5, toNum(valor)));
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`Avaliação ${num(v, 1)} de 5`}>
      <span className="relative inline-flex">
        <span className="inline-flex text-border-strong">
          {Array.from({ length: 5 }, (_, i) => <Star key={i} style={{ width: tamanho, height: tamanho }} aria-hidden />)}
        </span>
        <span className="absolute inset-0 inline-flex overflow-hidden text-signal" style={{ width: `${(v / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, i) => <Star key={i} className="flex-none fill-current" style={{ width: tamanho, height: tamanho }} aria-hidden />)}
        </span>
      </span>
      <span className="mono text-[13px] font-semibold">{num(v, 1)}</span>
    </span>
  );
}
