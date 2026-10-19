import type { ReactNode } from 'react';
import { Illustration, type Ilustracao } from './Illustrations';

interface Props {
  titulo: ReactNode;
  sobretitulo?: ReactNode;
  texto?: ReactNode;
  ilustracao?: Ilustracao;
  acoes?: ReactNode;
  children?: ReactNode;
  grande?: boolean;
}

export function HeroBand({ titulo, sobretitulo, texto, ilustracao = 'engrenagens', acoes, children, grande }: Props) {
  return (
    <section className={`hero anim-subir relative overflow-hidden ${grande ? 'rounded-[32px] p-6 sm:p-9' : 'rounded-[28px] p-5 sm:p-7'}`}>
      <Illustration tipo={ilustracao} className="absolute -right-6 top-1 w-[min(640px,62%)] h-auto opacity-90 max-sm:w-[90%] max-sm:opacity-40" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2 max-w-[680px]">
            {sobretitulo && <span className="text-sm font-semibold text-[#FFC08F]">{sobretitulo}</span>}
            <h1 className={`m-0 font-display font-bold leading-[.98] ${grande ? 'text-[clamp(38px,5vw,62px)]' : 'text-[clamp(32px,4vw,46px)]'}`}>{titulo}</h1>
            {texto && <p className="m-0 text-[16px] sm:text-[17px] text-[#D3E0EE]">{texto}</p>}
          </div>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function HeroKpi({ rotulo, valor, sub, destaque }: { rotulo: string; valor: ReactNode; sub?: ReactNode; destaque?: boolean }) {
  return destaque ? (
    <div className="glass rounded-[24px] px-5 py-4 text-ink-1">
      <span className="text-[13.5px] text-ink-2">{rotulo}</span>
      <span className="mono block text-[clamp(30px,3.4vw,52px)] font-bold tracking-[-.04em] leading-[1.05] whitespace-nowrap">{valor}</span>
      {sub && <span className="text-[13px] text-ink-2">{sub}</span>}
    </div>
  ) : (
    <div className="glass-dark rounded-[24px] px-5 py-4">
      <span className="text-[13.5px] text-[#D3E0EE]">{rotulo}</span>
      <span className="mono block text-[clamp(28px,3vw,38px)] font-bold tracking-[-.03em] leading-[1.15]">{valor}</span>
      {sub && <span className="text-caption text-[#D3E0EE]">{sub}</span>}
    </div>
  );
}
