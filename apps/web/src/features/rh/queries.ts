import { useQuery, type QueryKey } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Lista } from '../../lib/types';
import type { Ausencia, Disponibilidade, Habilitacao, Matriz, Produtividade } from './rh';

/** O que muda quando ausências ou habilitações mudam: RH, ficha do colaborador, painel e capacidade. */
export const INVALIDA_RH: QueryKey[] = [['rh'], ['colaboradores'], ['painel'], ['planejamento'], ['agenda']];

export const useAusencias = (f: { de?: string; ate?: string; colaboradorId?: string }, enabled = true) =>
  useQuery({ queryKey: ['rh', 'ausencias', f.de ?? '', f.ate ?? '', f.colaboradorId ?? ''], queryFn: () => api<Lista<Ausencia>>('/rh/ausencias', { query: f }), enabled });

export const useHabilitacoes = (vencendo?: number, enabled = true) =>
  useQuery({ queryKey: ['rh', 'habilitacoes', vencendo ?? 'todas'], queryFn: () => api<Lista<Habilitacao>>('/rh/habilitacoes', { query: { vencendo } }), enabled });

export const useMatriz = () => useQuery({ queryKey: ['rh', 'matriz'], queryFn: () => api<Matriz>('/rh/habilitacoes/matriz') });

export const useDisponibilidade = (competencia: string) =>
  useQuery({ queryKey: ['rh', 'disponibilidade', competencia], queryFn: () => api<Disponibilidade>('/rh/disponibilidade', { query: { competencia } }) });

export const useProdutividade = (meses: number, enabled = true) =>
  useQuery({ queryKey: ['rh', 'produtividade', meses], queryFn: () => api<Produtividade>('/rh/produtividade', { query: { meses } }), enabled });
