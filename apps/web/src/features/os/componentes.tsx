import { Check } from 'lucide-react';
import { Pill } from '../../components/Pill';
import type { Ilustracao } from '../../components/Illustrations';
import type { Segmento, StatusOS } from '../../lib/types';
import { desvioBadge, etapaOS, FLUXO_OS, STATUS_OS } from './os';

export const ilustracaoSegmento: Record<Segmento, Ilustracao> = { USINAGEM: 'torno', OFICINA: 'elevador', CALDEIRARIA: 'solda' };

export function StatusOSPill({ status }: { status: StatusOS }) {
  const e = STATUS_OS[status];
  if (!e) return <Pill>{status}</Pill>;
  if (e.variante === 'solido')
    return (
      <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-caption font-semibold whitespace-nowrap bg-ok text-surface-1">
        <e.icone className="size-3.5" aria-hidden /> {e.rotulo}
      </span>
    );
  if (e.variante === 'contorno')
    return (
      <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-caption font-semibold whitespace-nowrap text-ok border-[1.5px] border-ok">
        <e.icone className="size-3.5" aria-hidden /> {e.rotulo}
      </span>
    );
  return (
    <Pill tom={e.tom} icone={e.variante === 'pulsando' ? undefined : e.icone} className={e.variante === 'riscado' ? 'line-through' : ''}>
      {e.variante === 'pulsando' && <span className="size-2 rounded-full bg-run anim-pulsar" aria-hidden />}
      {e.rotulo}
    </Pill>
  );
}

export function DesvioBadge({ desvio, retrabalho }: { desvio: string | number; retrabalho?: boolean }) {
  if (retrabalho) return <Pill tom="bad">retrabalho</Pill>;
  const b = desvioBadge(desvio);
  return <Pill tom={b.tom} titulo="Desvio projetado sobre o orçado (tolerância de 20%)"><span className="mono">{b.rotulo}</span></Pill>;
}

export function StepperOS({ status }: { status: StatusOS }) {
  const atual = etapaOS(status);
  const cancelada = status === 'CANCELADA';
  return (
    <ol className="m-0 p-0 list-none flex flex-wrap gap-x-1 gap-y-2 items-center" aria-label="Etapas da OS">
      {FLUXO_OS.map((s, i) => {
        const feito = !cancelada && i < atual;
        const agora = !cancelada && i === atual;
        return (
          <li key={s} className="flex items-center gap-1" aria-current={agora ? 'step' : undefined}>
            <span
              className={`inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full text-[12.5px] font-semibold ${
                agora ? 'bg-white text-steel-3' : feito ? 'bg-white/20 text-white' : 'bg-white/5 text-[#B8C9DA]'
              }`}
            >
              <span className={`size-6 rounded-full grid place-items-center mono text-[11px] ${agora ? 'bg-primary text-white' : feito ? 'bg-[#3DD598] text-[#0B1D2E]' : 'bg-white/10'}`}>
                {feito ? <Check className="size-3.5" aria-label="feito" /> : i + 1}
              </span>
              {status === 'PAUSADA' && agora ? 'Pausada' : STATUS_OS[s].rotulo}
            </span>
            {i < FLUXO_OS.length - 1 && <span className="w-3 h-px bg-white/30" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** Par orçado × real: orçado sempre cinza, real sempre azul-aço. */
export function BarrasOrcadoReal({ orcado, real, projetado, rotulo }: { orcado: number; real: number; projetado?: number; rotulo: string }) {
  const max = Math.max(orcado, real, projetado ?? 0, 0.0001);
  return (
    <div className="flex flex-col gap-1" role="img" aria-label={rotulo}>
      <span className="h-2 rounded-full bg-surface-3 overflow-hidden"><span className="anim-crescer block h-full rounded-full bg-chart-orcado" style={{ width: `${(orcado / max) * 100}%` }} /></span>
      <span className="h-2 rounded-full bg-surface-3 overflow-hidden relative">
        {projetado !== undefined && <span className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-chart-real" style={{ width: `${(projetado / max) * 100}%` }} />}
        <span className="anim-crescer relative block h-full rounded-full bg-chart-real" style={{ width: `${(real / max) * 100}%` }} />
      </span>
    </div>
  );
}

export function PlacaMercosul({ placa }: { placa: string }) {
  const p = placa.toUpperCase();
  return (
    <span className="inline-flex flex-col w-[150px] rounded-[8px] border-2 border-[#1E1B16] bg-white overflow-hidden shadow-1" role="img" aria-label={`Placa ${p}`}>
      <span className="h-[18px] bg-[#1D4E9A] text-white text-[10px] font-bold tracking-normal flex items-center justify-center">BRASIL</span>
      <span className="mono text-[26px] font-bold text-[#1E1B16] text-center leading-[1.25]">{p.length === 7 ? `${p.slice(0, 3)}${p.slice(3)}` : p}</span>
    </span>
  );
}
