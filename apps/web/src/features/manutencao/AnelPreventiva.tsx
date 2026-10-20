import { anelPreventiva, type SituacaoPreventiva, type TipoPlano } from './manutencao';

/** Anel de progresso da preventiva: quanto do intervalo já foi usado, na cor da situação. */
export function AnelPreventiva({ tipo, situacao, tamanho = 64, inativo }: { tipo: TipoPlano; situacao: SituacaoPreventiva; tamanho?: number; inativo?: boolean }) {
  const a = anelPreventiva(tipo, situacao);
  const r = 26;
  const c = 2 * Math.PI * r;
  const cor = inativo ? 'var(--pm-neutral)' : a.cor;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label={inativo ? 'Plano pausado' : `${a.rotulo} (${Math.round(a.fracao * 100)}% do intervalo)`} className="flex-none">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--pm-surface-3)" strokeWidth="7" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke={cor} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${a.fracao * c} ${c}`} transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)' }}
      />
      <text x="32" y="36.5" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--pm-text-1)" style={{ fontFamily: 'var(--pm-font-mono, monospace)' }}>
        {Math.round(Math.min(1, a.fracao) * 100)}%
      </text>
    </svg>
  );
}
