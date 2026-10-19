import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, type LucideIcon } from 'lucide-react';

export type Variante = 'primario' | 'secundario' | 'terciario' | 'perigo' | 'vidro';
type Tamanho = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition duration-micro ease-promec active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none no-underline';
const variantes: Record<Variante, string> = {
  primario:
    'bg-primary-fill text-primary-on shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_16px_rgba(227,93,20,.35)] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_10px_22px_rgba(227,93,20,.4)]',
  secundario: 'bg-surface-1 text-ink-1 border border-border-strong hover:shadow-1 hover:-translate-y-px',
  terciario: 'bg-transparent text-ink-1 hover:bg-surface-3',
  perigo: 'bg-surface-1 text-bad border border-bad hover:bg-bad-soft',
  vidro: 'glass-dark text-white hover:bg-white/20'
};
const tamanhos: Record<Tamanho, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-[18px] text-sm min-h-target',
  lg: 'h-[52px] px-6 text-[15px]'
};

export const classeBotao = (v: Variante = 'secundario', t: Tamanho = 'md', extra = '') => `${base} ${variantes[v]} ${tamanhos[t]} ${extra}`;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: LucideIcon;
  carregando?: boolean;
  to?: string;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variante = 'secundario', tamanho = 'md', icone: Icone, carregando, to, className = '', children, type = 'button', disabled, ...rest },
  ref
) {
  const conteudo = (
    <>
      {carregando ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : Icone && <Icone className="size-[18px]" strokeWidth={1.75} aria-hidden />}
      {children}
    </>
  );
  const cls = classeBotao(variante, tamanho, className);
  if (to) return <Link to={to} className={cls}>{conteudo}</Link>;
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || carregando} aria-busy={carregando || undefined} {...rest}>
      {conteudo}
    </button>
  );
});

export function IconButton({ icone: Icone, rotulo, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icone: LucideIcon; rotulo: string }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} className={`inline-grid place-items-center size-11 rounded-control text-ink-2 hover:bg-surface-3 transition ${className}`} {...rest}>
      <Icone className="size-[18px]" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
