import { useId } from 'react';
import { brl, mesNome, toNum } from '../../lib/format';
import { tetoEixo } from './manutencao';

/** Custo de manutenção por mês (barras) com as médias móveis de 6 e 12 meses e o valor do cadastro. */
export function GraficoCustos({ meses, media6, media12, cadastro, rotuloMedia = 'Média de 6 meses' }: { meses: { competencia: string; valor: string }[]; rotuloMedia?: string; media6: string; media12?: string; cadastro?: string }) {
  const id = useId();
  const W = 560, H = 200, L = 52, R = 8, T = 12, B = 26;
  const PW = W - L - R, PH = H - T - B;
  const max = tetoEixo(Math.max(1, ...meses.map((m) => toNum(m.valor)), toNum(media6), toNum(media12), toNum(cadastro)));
  const y = (v: number) => T + PH - (Math.min(v, max) / max) * PH;
  const sw = PW / Math.max(1, meses.length);
  const bw = Math.min(42, sw * 0.62);
  const linhas = [
    { k: 'm6', v: toNum(media6), cor: 'var(--pm-primary)', rotulo: rotuloMedia, dash: undefined as string | undefined },
    ...(media12 !== undefined ? [{ k: 'm12', v: toNum(media12), cor: 'var(--pm-run)', rotulo: 'Média de 12 meses', dash: '6 4' }] : []),
    ...(cadastro !== undefined ? [{ k: 'cad', v: toNum(cadastro), cor: 'var(--pm-text-3)', rotulo: 'No cadastro', dash: '2 3' }] : [])
  ];
  const resumo = `Custo de manutenção por mês: ${meses.map((m) => `${mesNome(m.competencia)} ${brl(m.valor)}`).join(', ')}. ${rotuloMedia} ${brl(media6)}${media12 !== undefined ? `, de 12 meses ${brl(media12)}` : ''}${cadastro !== undefined ? `, cadastro ${brl(cadastro)}` : ''}.`;
  return (
    <figure className="m-0 flex flex-col gap-2 min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-labelledby={`${id}-r`}>
        <title id={`${id}-r`}>{resumo}</title>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--pm-border)" strokeWidth="1" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="var(--pm-text-3)" className="mono">{brl(max * f).replace(/R\$\s?/, '').replace(/,00$/, '')}</text>
          </g>
        ))}
        {meses.map((m, i) => {
          const v = toNum(m.valor);
          const x = L + sw * i + (sw - bw) / 2;
          return (
            <g key={m.competencia}>
              <rect x={x} y={y(v)} width={bw} height={Math.max(0, T + PH - y(v))} rx="5" fill="var(--pm-chart-real)">
                <title>{`${mesNome(m.competencia)}: ${brl(v)}`}</title>
              </rect>
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--pm-text-3)">{mesNome(m.competencia).slice(0, 3)}</text>
            </g>
          );
        })}
        {linhas.map((l) => (
          <line key={l.k} x1={L} x2={W - R} y1={y(l.v)} y2={y(l.v)} stroke={l.cor} strokeWidth="2.25" strokeDasharray={l.dash} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: 'var(--pm-chart-real)' }} aria-hidden />Gasto real</span>
        {linhas.map((l) => (
          <span key={l.k} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke={l.cor} strokeWidth="2.5" strokeDasharray={l.dash} /></svg>
            {l.rotulo} <span className="mono">{brl(l.v)}</span>
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>Custo de manutenção por mês</caption>
        <thead><tr><th scope="col">Mês</th><th scope="col">Valor</th></tr></thead>
        <tbody>{meses.map((m) => <tr key={m.competencia}><td>{mesNome(m.competencia)}</td><td>{brl(m.valor)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
