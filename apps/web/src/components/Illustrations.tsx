import type { SVGProps } from 'react';

export function gearPath(cx: number, cy: number, R: number, n: number, h: number) {
  const st = (2 * Math.PI) / n;
  let d = '';
  for (let k = 0; k < n; k++) {
    const a = k * st;
    [[R - h, a], [R, a + st * 0.18], [R, a + st * 0.42], [R - h, a + st * 0.6]].forEach(([r, ang], j) => {
      d += `${k === 0 && j === 0 ? 'M' : 'L'}${(cx + r! * Math.cos(ang!)).toFixed(1)} ${(cy + r! * Math.sin(ang!)).toFixed(1)}`;
    });
  }
  return `${d}Z`;
}

export type Ilustracao = 'torno' | 'engrenagens' | 'paquimetro' | 'solda' | 'prancheta' | 'equipe' | 'cofre' | 'elevador';

const traco = { fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const FAGULHA = '#FF8A3D';

function Torno() {
  return (
    <>
      <g>
        <rect x="40" y="168" width="560" height="24" rx="3" />
        <rect x="40" y="58" width="132" height="110" rx="8" />
        <rect x="172" y="78" width="28" height="78" rx="5" />
        <path d="M212 100h96v34h-96M308 106h60v22h-60M368 110h34v14h-34M402 117l18-9v18z" />
        <rect x="420" y="94" width="76" height="74" rx="6" />
        <rect x="286" y="148" width="128" height="20" rx="3" />
        <rect x="322" y="128" width="44" height="20" rx="3" />
        <path d="M78 192v40M562 192v40" />
      </g>
      <path d="M344 128l-10-10h10z" fill={FAGULHA} stroke={FAGULHA} />
      <path d="M336 116l-8-10M342 114l2-12M330 120l-12-4" stroke={FAGULHA} className="anim-pulsar" />
      <path className="anim-girar" d={gearPath(590, 46, 52, 14, 9)} />
    </>
  );
}

function Engrenagens() {
  return (
    <>
      <path className="anim-girar" d={gearPath(470, 110, 86, 18, 14)} />
      <circle cx="470" cy="110" r="28" />
      <path className="anim-girar" style={{ animationDirection: 'reverse' }} d={gearPath(330, 160, 52, 12, 10)} />
      <circle cx="330" cy="160" r="16" />
      <path d={gearPath(580, 210, 34, 10, 8)} />
      <path d="M60 200h180M60 200v-60h120v60M90 140v-30h60v30" />
      <path d="M180 120l12-14M186 128l18-4M176 112l2-18" stroke={FAGULHA} className="anim-pulsar" />
    </>
  );
}

function Paquimetro() {
  const ticks = Array.from({ length: 30 }, (_, i) => `M${70 + i * 15} 96v${i % 5 === 0 ? 14 : 8}`).join('');
  return (
    <>
      <rect x="60" y="80" width="480" height="30" rx="3" />
      <path d={ticks} strokeWidth={1.4} />
      <path d="M66 110v90l26-14V110M66 80V50h18v30" />
      <rect x="250" y="70" width="96" height="50" rx="6" />
      <path d="M260 120v80l22-14v-66" />
      <path d="M560 60h40v60h-40z" />
      <path d="M280 186h30" stroke={FAGULHA} />
      <path className="anim-girar" d={gearPath(560, 200, 40, 12, 8)} />
    </>
  );
}

function Solda() {
  return (
    <>
      <path d="M80 200h460M120 200l60-40h320l-40 40" />
      <path d="M330 160l-70-120M260 40l-30-10M250 60l-40 6" />
      <circle cx="330" cy="160" r="6" fill={FAGULHA} stroke={FAGULHA} />
      <path d="M330 160l24-22M330 160l30 -2M330 160l20 18M330 160l-6 -30M330 160l-26 -12" stroke={FAGULHA} className="anim-pulsar" />
      <path d="M180 168c20-6 40 6 60 0s40 6 60 0" stroke={FAGULHA} strokeWidth={2.6} />
      <path className="anim-girar" d={gearPath(560, 60, 44, 12, 8)} />
    </>
  );
}

function Prancheta() {
  return (
    <>
      <rect x="320" y="30" width="200" height="200" rx="12" />
      <path d="M380 30v-12h80v12M350 80h140M350 112h140M350 144h90M350 176h60" />
      <path d="M440 186l20 18 40-46" stroke={FAGULHA} />
      <path d="M60 210h220M90 210V120h40v90M150 210V90h40v120M210 210V140h40v70" />
      <path className="anim-girar" d={gearPath(590, 60, 40, 12, 8)} />
    </>
  );
}

function Equipe() {
  return (
    <>
      <circle cx="380" cy="90" r="32" />
      <path d="M340 70c0-30 80-30 80 0M332 74h96" />
      <path d="M320 220c0-50 30-80 60-80s60 30 60 80" />
      <circle cx="500" cy="110" r="24" />
      <path d="M460 220c0-40 20-66 40-66s40 26 40 66" />
      <path d="M120 200l90-90M200 100l24-24 16 16-24 24M110 190l-14 30 30-14" />
      <path d="M222 82l10-10" stroke={FAGULHA} />
      <path className="anim-girar" d={gearPath(600, 50, 36, 10, 7)} />
    </>
  );
}

function Cofre() {
  return (
    <>
      <rect x="330" y="40" width="200" height="170" rx="14" />
      <circle cx="430" cy="125" r="42" />
      <path d="M430 83v16M430 151v16M388 125h16M456 125h16" />
      <path d="M350 210v18M510 210v18" />
      <path d="M80 200h200M110 200v-36h40v36M170 200v-60h40v60M230 200v-90" />
      <path d="M232 104l8-14M226 100l-12-6" stroke={FAGULHA} />
      <path className="anim-girar" d={gearPath(600, 60, 36, 10, 7)} />
    </>
  );
}

function Elevador() {
  return (
    <>
      <path d="M60 230h520M110 230V40M530 230V40M100 40h20M520 40h20" />
      <path d="M110 150h420M110 162h420" />
      <path d="M150 150l20-24M490 150l-20-24" />
      <circle cx="240" cy="110" r="30" />
      <circle cx="400" cy="110" r="30" />
      <circle cx="240" cy="110" r="6" />
      <circle cx="400" cy="110" r="6" />
      <path d="M240 110l50-40h50l30 20M290 70l-10-20h-20M340 70l20 40M360 110h40M300 90h40" />
      <path d="M352 52h22l8 8" />
      <path d="M420 200l14-10M428 210l18-4" stroke={FAGULHA} className="anim-pulsar" />
      <path className="anim-girar" d={gearPath(600, 60, 36, 10, 7)} />
    </>
  );
}

const MAPA: Record<Ilustracao, () => JSX.Element> = {
  elevador: Elevador,
  torno: Torno,
  engrenagens: Engrenagens,
  paquimetro: Paquimetro,
  solda: Solda,
  prancheta: Prancheta,
  equipe: Equipe,
  cofre: Cofre
};

export function Illustration({ tipo, cor = 'rgba(255,255,255,.28)', ...rest }: { tipo: Ilustracao; cor?: string } & SVGProps<SVGSVGElement>) {
  const C = MAPA[tipo];
  return (
    <svg viewBox="0 0 640 250" aria-hidden="true" stroke={cor} {...traco} {...rest}>
      <C />
    </svg>
  );
}

export function LogoProMEC({ className = 'size-10' }: { className?: string }) {
  return (
    <span className={`rounded-control grid place-items-center bg-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_16px_rgba(227,93,20,.45)] flex-none ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden>
        <path d={gearPath(12, 12, 10, 8, 2.5)} />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}
