import type { ReactNode } from 'react';
import {
  Ban, CheckCircle2, CircleDashed, CircleDot, Clock, FileEdit, Handshake, Hourglass, Lock, Send, ShieldAlert, ThumbsDown, ThumbsUp, TrendingDown, TriangleAlert, Wrench, XCircle, type LucideIcon
} from 'lucide-react';
import type { SituacaoMargem, StatusCentro } from '@promec/motor';
import type { StatusCliente, StatusOrcamento, StatusTabela } from '../lib/types';

export type Tom = 'ok' | 'warn' | 'bad' | 'info' | 'run' | 'neutral' | 'primary' | 'steel';

const tons: Record<Tom, string> = {
  ok: 'text-ok bg-ok-soft',
  warn: 'text-warn bg-warn-soft',
  bad: 'text-bad bg-bad-soft',
  info: 'text-info bg-info-soft',
  run: 'text-run bg-run-soft',
  neutral: 'text-neutral bg-neutral-soft',
  primary: 'text-primary-text bg-primary-soft',
  steel: 'text-steel bg-steel-soft'
};

export function Pill({ tom = 'neutral', icone: Icone, children, className = '', titulo }: { tom?: Tom; icone?: LucideIcon; children: ReactNode; className?: string; titulo?: string }) {
  return (
    <span title={titulo} className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-caption font-semibold whitespace-nowrap leading-none ${tons[tom]} ${className}`}>
      {Icone && <Icone className="size-3.5" strokeWidth={2} aria-hidden />}
      {children}
    </span>
  );
}

const ORC: Record<StatusOrcamento, [string, Tom, LucideIcon]> = {
  RASCUNHO: ['Rascunho', 'neutral', FileEdit],
  ENVIADO: ['Enviado', 'info', Send],
  EM_NEGOCIACAO: ['Em negociação', 'warn', Handshake],
  APROVADO: ['Aprovado', 'ok', ThumbsUp],
  RECUSADO: ['Recusado', 'bad', ThumbsDown],
  EXPIRADO: ['Expirado', 'neutral', Hourglass],
  CONVERTIDO: ['Convertido em OS', 'run', CircleDot]
};
export const rotuloOrcamento = (s: StatusOrcamento) => ORC[s]?.[0] ?? s;

export function StatusOrcamentoPill({ status, versao }: { status: StatusOrcamento; versao?: number }) {
  const [l, t, I] = ORC[status] ?? [status, 'neutral', CircleDashed];
  return (
    <Pill tom={t} icone={I} className={status === 'EXPIRADO' ? 'line-through' : ''}>
      {l}
      {versao ? ` · v${versao}` : ''}
    </Pill>
  );
}

export function StatusTabelaPill({ status, desatualizada }: { status: StatusTabela; desatualizada?: boolean }) {
  const map: Record<StatusTabela, [string, Tom, LucideIcon]> = {
    RASCUNHO: ['Rascunho', 'neutral', FileEdit],
    VIGENTE: ['Vigente', 'ok', CheckCircle2],
    ENCERRADA: ['Encerrada', 'neutral', Lock]
  };
  const [l, t, I] = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <Pill tom={t} icone={I} className={status === 'ENCERRADA' ? 'opacity-75' : ''}>
        {l}
        {desatualizada && <span className="size-2 rounded-full bg-signal ml-0.5" aria-hidden />}
      </Pill>
      {desatualizada && (
        <Pill tom="warn" icone={TriangleAlert}>
          Desatualizada
        </Pill>
      )}
    </span>
  );
}

export function StatusCentroPill({ status }: { status: StatusCentro }) {
  const map: Record<StatusCentro, [string, Tom, LucideIcon]> = {
    ativo: ['Ativo', 'ok', CheckCircle2],
    manutencao: ['Em manutenção', 'warn', Wrench],
    desativado: ['Desativado', 'neutral', Ban]
  };
  const [l, t, I] = map[status] ?? ['?', 'neutral', CircleDashed];
  return <Pill tom={t} icone={I}>{l}</Pill>;
}

export function StatusClientePill({ status }: { status: StatusCliente }) {
  const map: Record<StatusCliente, [string, Tom, LucideIcon]> = {
    ATIVO: ['Ativo', 'ok', CheckCircle2],
    BLOQUEADO: ['Bloqueado', 'bad', ShieldAlert],
    INATIVO: ['Inativo', 'neutral', Ban]
  };
  const [l, t, I] = map[status] ?? ['?', 'neutral', CircleDashed];
  return <Pill tom={t} icone={I}>{l}</Pill>;
}

export const tomMargem: Record<SituacaoMargem, Tom> = { ok: 'ok', atencao: 'warn', perigo: 'bad' };

export function MargemPill({ situacao, children }: { situacao: SituacaoMargem; children: ReactNode }) {
  const I = situacao === 'ok' ? CheckCircle2 : situacao === 'atencao' ? Clock : TrendingDown;
  return (
    <Pill tom={tomMargem[situacao]} icone={situacao === 'perigo' ? XCircle : I} titulo={situacao === 'ok' ? 'No alvo' : situacao === 'atencao' ? 'Entre o mínimo e o alvo' : 'Abaixo do mínimo'}>
      {children}
    </Pill>
  );
}
