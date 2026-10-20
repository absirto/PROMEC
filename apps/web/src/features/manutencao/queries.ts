import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Fornecedor } from '../../lib/types';
import { lista, type Indicadores, type Ordem, type Plano } from './manutencao';

export const INVAL_MANUTENCAO = [['manutencao'], ['painel'], ['centros-trabalho'], ['planejamento'], ['agenda']];

export const usePlanos = (centroId?: string) =>
  useQuery({ queryKey: ['manutencao', 'planos', centroId ?? ''], queryFn: () => api<unknown>('/manutencao/planos', { query: { centroId } }).then(lista<Plano>) });

export const useOrdens = (f: { status?: string; centroId?: string; tipo?: string } = {}) =>
  useQuery({
    queryKey: ['manutencao', 'ordens', f.status ?? '', f.centroId ?? '', f.tipo ?? ''],
    queryFn: () => api<unknown>('/manutencao/ordens', { query: { status: f.status, centroId: f.centroId, tipo: f.tipo } }).then(lista<Ordem>)
  });

export const useOrdem = (id: string | null) =>
  useQuery({ queryKey: ['manutencao', 'ordem', id], queryFn: () => api<Ordem>(`/manutencao/ordens/${id}`), enabled: !!id });

export const useIndicadores = (meses: number, centroId?: string) =>
  useQuery({ queryKey: ['manutencao', 'indicadores', meses, centroId ?? ''], queryFn: () => api<Indicadores>('/manutencao/indicadores', { query: { meses, centroId } }), retry: false });

export const useFornecedores = (enabled = true) =>
  useQuery({ queryKey: ['fornecedores', 'opcoes-manutencao'], queryFn: () => api<unknown>('/fornecedores').then(lista<Fornecedor>), enabled, staleTime: 60_000 });
