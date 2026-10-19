import { ChevronLeft, ChevronRight } from 'lucide-react';
import { competenciaLonga, somarMes } from '../lib/format';

export function CompetenciaPicker({ valor, onChange, escuro }: { valor: string; onChange: (c: string) => void; escuro?: boolean }) {
  const btn = `size-9 grid place-items-center rounded-full transition ${escuro ? 'hover:bg-white/20' : 'hover:bg-surface-3'}`;
  return (
    <div className={`inline-flex items-center gap-1 h-11 px-1 rounded-full ${escuro ? 'glass-dark' : 'bg-surface-1 border border-border-strong'}`} role="group" aria-label="Competência">
      <button type="button" className={btn} onClick={() => onChange(somarMes(valor, -1))} aria-label="Mês anterior">
        <ChevronLeft className="size-[18px]" aria-hidden />
      </button>
      <span className="relative min-w-[150px] text-center text-[14px] font-semibold" aria-live="polite">
        {competenciaLonga(valor)}
      </span>
      <button type="button" className={btn} onClick={() => onChange(somarMes(valor, 1))} aria-label="Próximo mês">
        <ChevronRight className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}
