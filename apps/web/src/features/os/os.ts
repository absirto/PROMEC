import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleDot, ListOrdered, Pause, PackageCheck, Ruler, XCircle, type LucideIcon } from 'lucide-react';
import type { Tom } from '../../components/Pill';
import type { FilaOperador, MotivoPausa, StatusOS } from '../../lib/types';
import { pct, toNum } from '../../lib/format';

export interface EstiloStatus { rotulo: string; tom: Tom; icone: LucideIcon; variante?: 'tracejado' | 'pulsando' | 'contorno' | 'solido' | 'riscado' }

export const STATUS_OS: Record<StatusOS, EstiloStatus> = {
  ABERTA: { rotulo: 'Aberta', tom: 'neutral', icone: CircleDashed, variante: 'tracejado' },
  EM_FILA: { rotulo: 'Em fila', tom: 'info', icone: ListOrdered },
  EM_EXECUCAO: { rotulo: 'Em execução', tom: 'run', icone: CircleDot, variante: 'pulsando' },
  PAUSADA: { rotulo: 'Pausada', tom: 'warn', icone: Pause },
  CONTROLE_QUALIDADE: { rotulo: 'Controle de qualidade', tom: 'info', icone: Ruler },
  CONCLUIDA: { rotulo: 'Concluída', tom: 'ok', icone: CheckCircle2, variante: 'contorno' },
  ENTREGUE: { rotulo: 'Entregue', tom: 'ok', icone: PackageCheck, variante: 'solido' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'bad', icone: XCircle, variante: 'riscado' }
};

export const FLUXO_OS: StatusOS[] = ['ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'CONTROLE_QUALIDADE', 'CONCLUIDA', 'ENTREGUE'];

/** Posição no stepper; pausada conta como execução. */
export const etapaOS = (s: StatusOS) => (s === 'PAUSADA' ? FLUXO_OS.indexOf('EM_EXECUCAO') : FLUXO_OS.indexOf(s));

export const MOTIVOS_PAUSA: Record<MotivoPausa, string> = {
  FALTA_PECA: 'Falta peça ou material',
  AGUARDANDO_CLIENTE: 'Esperando o cliente',
  QUEBRA: 'Máquina quebrou',
  FALTA_OPERADOR: 'Falta operador',
  OUTRO: 'Outro motivo'
};

/** Segundos entre dois instantes, nunca negativo. */
export const segundosDesde = (inicio: string, agora = Date.now()) => Math.max(0, Math.floor((agora - new Date(inicio).getTime()) / 1000));

/** 3725 s → "01:02:05" */
export const cronometro = (seg: number) => {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':');
};

/** Selo de desvio orçado × projetado: dentro da tolerância ok, até 2× atenção, acima perigo. */
export function desvioBadge(desvio: string | number, tolerancia = 0.2): { tom: 'ok' | 'warn' | 'bad'; rotulo: string } {
  const d = toNum(desvio);
  const tom = d <= tolerancia ? 'ok' : d <= tolerancia * 2 ? 'warn' : 'bad';
  const rotulo = Math.abs(d) < 0.0005 ? 'no orçado' : `${d > 0 ? '+' : '−'}${pct(Math.abs(d), 0)}`;
  return { tom, rotulo };
}

export const nomeDe = (x: string | { nome: string } | null | undefined) => (x == null ? null : typeof x === 'string' ? x : x.nome);

export const textoAlerta = (a: string | { mensagem: string }) => (typeof a === 'string' ? a : a.mensagem);

/** Aceita a fila aninhada ({ os, operacao }) ou achatada (campos da operação com osId/osNumero). */
export function normalizarFila(x: unknown): FilaOperador {
  const r = x as Record<string, unknown>;
  if (r.operacao && r.os) return r as unknown as FilaOperador;
  const op = (r.operacao ?? r) as FilaOperador['operacao'];
  return {
    os: (r.os as FilaOperador['os']) ?? {
      id: String(r.osId ?? r.ordemServicoId ?? ''),
      numero: String(r.osNumero ?? r.numero ?? ''),
      titulo: String(r.osTitulo ?? r.titulo ?? ''),
      prazo: (r.prazo as string) ?? null,
      prioridade: (r.prioridade as FilaOperador['os']['prioridade']) ?? 'NORMAL',
      status: (r.osStatus as FilaOperador['os']['status']) ?? 'EM_FILA',
      lote: Number(r.lote ?? 1)
    },
    operacao: op,
    apontamentoAberto: (r.apontamentoAberto as FilaOperador['apontamentoAberto']) ?? null
  };
}

/** Relógio que anda de segundo em segundo enquanto `ativo`. */
export function useAgora(ativo = true) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [ativo]);
  return agora;
}

/**
 * Pausa por quebra ainda aberta: a manutenção grava a observação como "Centro: descrição (OM-AAAA-NNNNN)".
 * Devolve o centro, a descrição e o número da ordem de manutenção para a OS mostrar a parada com clareza.
 */
export function quebraAberta(ocorrencias: { tipo: string; motivo: string | null; fim: string | null; inicio: string; observacao: string | null }[]) {
  const q = [...ocorrencias].reverse().find((x) => x.tipo === 'PAUSA' && x.motivo === 'QUEBRA' && !x.fim);
  if (!q) return null;
  const obs = q.observacao ?? '';
  const m = obs.match(/^(.*?):\s*(.*?)\s*\((OM-[\d-]+)\)\s*$/);
  return { inicio: q.inicio, centro: m?.[1]?.trim() || null, descricao: (m?.[2] ?? obs).trim() || null, ordem: m?.[3] ?? null };
}
