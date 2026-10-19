import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, as: Tag = 'section', ...rest }: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ titulo, sub, acao, id }: { titulo: ReactNode; sub?: ReactNode; acao?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col min-w-0">
        <h2 id={id} className="m-0 font-sans text-headline">{titulo}</h2>
        {sub && <span className="text-[13px] text-ink-3">{sub}</span>}
      </div>
      {acao}
    </div>
  );
}

export function Kpi({ rotulo, valor, sub, icone, tom = 'steel' }: { rotulo: string; valor: ReactNode; sub?: ReactNode; icone?: ReactNode; tom?: 'steel' | 'ok' | 'warn' | 'bad' | 'primary' }) {
  const bg = { steel: 'bg-steel-soft text-steel', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', primary: 'bg-primary-soft text-primary-text' }[tom];
  return (
    <div className="card p-3.5 flex items-center gap-3">
      {icone && <span className={`size-10 rounded-control grid place-items-center flex-none ${bg}`}>{icone}</span>}
      <span className="flex flex-col leading-tight min-w-0">
        <span className="mono text-[22px] font-bold">{valor}</span>
        <span className="text-[13px] text-ink-2">{rotulo}</span>
        {sub && <span className="text-caption text-ink-3">{sub}</span>}
      </span>
    </div>
  );
}
