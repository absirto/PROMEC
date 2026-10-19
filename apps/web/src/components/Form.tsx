import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';

export function FormHeader({ iniciais, cor, titulo, lead, pills, acoes, voltar }: { iniciais: string; cor: string; titulo: string; lead: ReactNode; pills?: ReactNode; acoes?: ReactNode; voltar: { to: string; rotulo: string } }) {
  return (
    <section className="card anim-subir p-5 flex flex-wrap gap-4 items-center" style={{ backgroundImage: 'linear-gradient(120deg, rgba(227,93,20,.07), transparent 40%)' }}>
      <Link to={voltar.to} className="basis-full inline-flex items-center gap-1.5 text-[13px] font-semibold no-underline">
        <ArrowLeft className="size-4" aria-hidden /> {voltar.rotulo}
      </Link>
      <span className="size-[68px] rounded-[20px] grid place-items-center text-white font-display text-[26px] font-bold flex-none" style={{ background: cor }} aria-hidden>
        {iniciais}
      </span>
      <div className="flex-[1_1_300px] flex flex-col gap-1 min-w-0">
        {pills && <div className="flex flex-wrap gap-2">{pills}</div>}
        <h1 className="m-0 text-[clamp(30px,4vw,40px)] font-bold leading-none break-words">{titulo}</h1>
        <span className="text-[14.5px] text-ink-2">{lead}</span>
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </section>
  );
}

export interface SecaoInfo { id: string; titulo: string; completa: boolean }

export function NavSecoes({ secoes }: { secoes: SecaoInfo[] }) {
  return (
    <nav aria-label="Seções do cadastro" className="hidden xl:flex flex-col gap-0.5 sticky top-24 w-[200px] flex-none">
      {secoes.map((s, i) => (
        <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-control text-[14px] text-ink-2 no-underline hover:bg-surface-1">
          <span className={`mono size-[22px] rounded-full grid place-items-center text-[11px] font-bold ${s.completa ? 'bg-ok text-white' : 'bg-surface-3 text-ink-2'}`}>
            {s.completa ? <Check className="size-3.5" aria-label="completa" /> : i + 1}
          </span>
          {s.titulo}
        </a>
      ))}
    </nav>
  );
}

export function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section id={id} className="card anim-subir p-5 sm:p-6 flex flex-col gap-4 scroll-mt-24" aria-labelledby={`${id}-t`}>
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-t`} className="m-0 text-[24px] font-bold">{titulo}</h2>
        {descricao && <span className="text-[13.5px] text-ink-3">{descricao}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-3.5">{children}</div>
    </section>
  );
}

export const span = (n: 2 | 3 | 4 | 6) => ({ 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 6: 'sm:col-span-6' })[n];
