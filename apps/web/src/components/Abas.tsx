import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Abas em cápsula com a aba atual na URL (?aba=), para voltar e compartilhar o link. */
export function useAba<T extends string>(padrao: T, validas: readonly T[]) {
  const [sp, setSp] = useSearchParams();
  const atual = sp.get('aba') as T | null;
  const aba = atual && validas.includes(atual) ? atual : padrao;
  const setAba = (a: T) => {
    const n = new URLSearchParams(sp);
    n.set('aba', a);
    setSp(n, { replace: true });
  };
  return [aba, setAba] as const;
}

export function Abas<T extends string>({ abas, valor, onChange, rotulo }: { abas: { valor: T; rotulo: ReactNode; n?: number }[]; valor: T; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex flex-wrap gap-1 p-1 rounded-full bg-surface-3 self-start max-w-full overflow-x-auto">
      {abas.map((a) => {
        const on = a.valor === valor;
        return (
          <button
            key={a.valor}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(a.valor)}
            className={`h-9 px-4 rounded-full text-[13.5px] font-medium whitespace-nowrap transition duration-micro ${on ? 'bg-ink-1 text-surface-1' : 'text-ink-2 hover:text-ink-1'}`}
          >
            {a.rotulo}
            {a.n !== undefined && a.n > 0 && <span className="mono ml-1.5 text-[12px] opacity-80">{a.n}</span>}
          </button>
        );
      })}
    </div>
  );
}
