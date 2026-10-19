import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ aberto, onFechar, titulo, children, rodape, faixa, largura = 520 }: { aberto: boolean; onFechar: () => void; titulo: ReactNode; children: ReactNode; rodape?: ReactNode; faixa?: boolean; largura?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const foco = () => el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (foco()?.[1] ?? foco()?.[0])?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'Tab') {
        const f = foco();
        if (!f?.length) return;
        const primeiro = f[0]!, ultimo = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      anterior?.focus();
    };
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 grid place-items-end sm:place-items-center p-0 sm:p-4 bg-[rgba(20,16,10,.45)]" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className="anim-subir w-full bg-surface-1 rounded-t-sheet sm:rounded-panel shadow-3 overflow-hidden max-h-[92vh] flex flex-col" style={{ maxWidth: largura }}>
        {faixa && <div className="hazard h-2.5 flex-none" aria-hidden />}
        <div className="flex items-start gap-3 px-6 pt-5 pb-2">
          <h2 id={id} className="m-0 flex-1 text-[26px] font-bold leading-tight">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="size-10 grid place-items-center rounded-control hover:bg-surface-3 text-ink-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="px-6 pb-4 overflow-y-auto flex flex-col gap-3">{children}</div>
        {rodape && <div className="px-6 py-4 border-t border-border flex flex-wrap justify-end gap-2 bg-surface-2">{rodape}</div>}
      </div>
    </div>,
    document.body
  );
}
