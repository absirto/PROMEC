import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

type TomToast = 'ok' | 'bad' | 'info' | 'warn';
interface Item { id: number; tom: TomToast; texto: ReactNode }

const Ctx = createContext<(texto: ReactNode, tom?: TomToast) => void>(() => {});
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([]);
  const fechar = useCallback((id: number) => setItens((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (texto: ReactNode, tom: TomToast = 'ok') => {
      const id = ++seq;
      setItens((xs) => [...xs.slice(-3), { id, tom, texto }]);
      window.setTimeout(() => fechar(id), tom === 'bad' ? 8000 : 5000);
    },
    [fechar]
  );
  const icone = { ok: CheckCircle2, bad: XCircle, info: Info, warn: TriangleAlert };
  const cor = { ok: 'text-ok', bad: 'text-bad', info: 'text-info', warn: 'text-warn' };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[400px] flex flex-col gap-2 pointer-events-none">
        {itens.map((t) => {
          const I = icone[t.tom];
          return (
            <div key={t.id} role={t.tom === 'bad' ? 'alert' : 'status'} className="glass anim-subir pointer-events-auto rounded-[18px] px-4 py-3 flex items-start gap-3 text-ink-1">
              <I className={`size-5 mt-0.5 flex-none ${cor[t.tom]}`} aria-hidden />
              <span className="flex-1 text-[14px]">{t.texto}</span>
              <button type="button" onClick={() => fechar(t.id)} aria-label="Fechar aviso" className="size-7 grid place-items-center rounded-md hover:bg-surface-3 text-ink-3 relative">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
