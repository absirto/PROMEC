import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';

export interface Coluna<T> {
  chave: string;
  titulo: string;
  render: (l: T) => ReactNode;
  alinhar?: 'left' | 'right' | 'center';
  mono?: boolean;
  principal?: boolean;
  className?: string;
}

export function DataTable<T>({ colunas, linhas, chave, href, rotulo, rotuloLinha }: { colunas: Coluna<T>[]; linhas: T[]; chave: (l: T) => string; href?: (l: T) => string; rotulo: string; rotuloLinha?: (l: T) => string }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="rt" aria-label={rotulo}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" style={{ textAlign: c.alinhar ?? 'left' }}>
                {c.titulo}
              </th>
            ))}
            {href && <th scope="col" className="w-11"><span className="sr-only">Abrir</span></th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={chave(l)} data-link={!!href} onClick={href ? (e) => { if (!(e.target as HTMLElement).closest('a,button')) navigate(href(l)); } : undefined}>
              {colunas.map((c) => (
                <td
                  key={c.chave}
                  data-l={c.principal ? undefined : c.titulo}
                  data-principal={c.principal || undefined}
                  className={`${c.mono ? 'mono' : ''} ${c.className ?? ''}`}
                  style={{ textAlign: c.alinhar ?? 'left' }}
                >
                  {c.render(l)}
                </td>
              ))}
              {href && (
                <td data-abrir>
                  <a href={href(l)} onClick={(e) => { e.preventDefault(); navigate(href(l)); }} aria-label={`Abrir ${rotuloLinha?.(l) ?? ''}`} className="size-8 grid place-items-center rounded-control text-ink-3 hover:bg-surface-3">
                    <ChevronRight className="size-4" aria-hidden />
                  </a>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FiltroChips<T extends string>({ opcoes, valor, onChange, rotulo }: { opcoes: { valor: T; rotulo: string; n?: number }[]; valor: T; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const on = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.valor)}
            className={`h-9 px-3.5 rounded-full text-[13px] font-medium border transition duration-micro ${on ? 'bg-ink-1 text-surface-1 border-ink-1' : 'bg-surface-1 text-ink-2 border-border-strong hover:border-ink-3'}`}
          >
            {o.rotulo}
            {o.n !== undefined && <span className="mono ml-1.5 text-[12px] opacity-80">{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Busca({ valor, onChange, placeholder, rotulo = 'Buscar' }: { valor: string; onChange: (v: string) => void; placeholder: string; rotulo?: string }) {
  return (
    <label className="campo flex-[1_1_260px] max-w-[420px] !min-h-[42px] !rounded-full">
      <Search className="size-[18px] text-ink-3" aria-hidden />
      <span className="sr-only">{rotulo}</span>
      <input type="search" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="!h-[38px]" />
    </label>
  );
}
