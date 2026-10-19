import type { HTMLAttributes, ReactNode } from 'react';
import { gearPath } from './Illustrations';

/** Vidro sempre sobre uma placa colorida (laranja → azul com engrenagens), para ter o que refratar. */
export function GlassPanel({ children, className = '', placa = 'fagulha', ...rest }: HTMLAttributes<HTMLElement> & { children: ReactNode; placa?: 'fagulha' | 'aco' }) {
  const fundo =
    placa === 'fagulha'
      ? 'linear-gradient(150deg, #F08A3E 0%, #E35D14 35%, #1D4E7A 100%)'
      : 'linear-gradient(150deg, #2A6AA3 0%, #15395A 70%, #E35D14 140%)';
  return (
    <aside className={`relative rounded-panel p-2.5 overflow-hidden ${className}`} style={{ background: fundo }} {...rest}>
      <svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 size-full">
        <path className="anim-girar" d={gearPath(360, 90, 150, 20, 20)} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth={3} />
        <path d={gearPath(60, 640, 80, 12, 14)} fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.3)" strokeWidth={2} />
        <g stroke="#FFD08A" strokeWidth={2} strokeLinecap="round" opacity={0.8} className="anim-pulsar">
          <path d="M330 600l30-24M326 612l40-2M334 590l14-34M318 620l-10 30" />
        </g>
      </svg>
      <div className="glass relative rounded-card p-5 flex flex-col gap-4">{children}</div>
    </aside>
  );
}
