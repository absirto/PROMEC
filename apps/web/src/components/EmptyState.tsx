import type { ReactNode } from 'react';
import { CloudOff, RotateCw } from 'lucide-react';
import { Illustration, type Ilustracao } from './Illustrations';
import { Button } from './Button';
import { msgErro } from '../lib/api';

export function EmptyState({ titulo, texto, ilustracao = 'prancheta', acao }: { titulo: string; texto?: ReactNode; ilustracao?: Ilustracao; acao?: ReactNode }) {
  return (
    <div className="py-12 px-6 flex flex-col items-center gap-3.5 text-center">
      <Illustration tipo={ilustracao} cor="var(--pm-steel)" className="w-60 max-w-full h-auto" />
      <h2 className="m-0 text-[28px] font-bold leading-tight">{titulo}</h2>
      {texto && <p className="m-0 max-w-[460px] text-ink-2">{texto}</p>}
      {acao && <div className="flex flex-wrap gap-2 justify-center">{acao}</div>}
    </div>
  );
}

export function Carregando({ linhas = 5, rotulo = 'Carregando' }: { linhas?: number; rotulo?: string }) {
  return (
    <div role="status" aria-label={rotulo} className="flex flex-col gap-3 p-4">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="skeleton size-9 rounded-control flex-none" />
          <span className="skeleton h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
        </div>
      ))}
      <span className="sr-only">{rotulo}…</span>
    </div>
  );
}

export function ErroEstado({ erro, tentar }: { erro: unknown; tentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 text-center py-10 px-6">
      <span className="size-14 rounded-card bg-bad-soft text-bad grid place-items-center">
        <CloudOff className="size-7" aria-hidden />
      </span>
      <h2 className="m-0 text-[24px] font-bold">Não deu para carregar agora</h2>
      <p className="m-0 max-w-[460px] text-ink-2">{msgErro(erro)}</p>
      {tentar && (
        <Button icone={RotateCw} onClick={tentar}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function Aviso({ tom = 'warn', titulo, children, faixa, acao }: { tom?: 'warn' | 'bad' | 'info' | 'ok'; titulo?: ReactNode; children?: ReactNode; faixa?: boolean; acao?: ReactNode }) {
  const cls = { warn: 'bg-warn-soft text-ink-1', bad: 'bg-bad-soft text-ink-1', info: 'bg-info-soft text-ink-1', ok: 'bg-ok-soft text-ink-1' }[tom];
  return (
    <div role={tom === 'bad' ? 'alert' : 'status'} className={`rounded-[18px] overflow-hidden ${cls}`}>
      {faixa && <div className="hazard h-2" aria-hidden />}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-[200px] flex flex-col gap-0.5 text-[14px]">
          {titulo && <strong className="font-semibold">{titulo}</strong>}
          {children != null && children !== false && <div>{children}</div>}
        </div>
        {acao}
      </div>
    </div>
  );
}
