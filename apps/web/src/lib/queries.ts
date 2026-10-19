import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api, msgErro } from './api';
import { useToast } from '../components/Toast';
import type { Centro, Cliente, Colaborador, Lista, Parametros, TabelaDetalhe } from './types';

export const useParametros = () => useQuery({ queryKey: ['parametros'], queryFn: () => api<Parametros>('/parametros'), staleTime: 5 * 60_000 });
export const useClientes = (q = '') => useQuery({ queryKey: ['clientes', q], queryFn: () => api<Lista<Cliente>>('/clientes', { query: { q } }) });
export const useCentros = () => useQuery({ queryKey: ['centros-trabalho'], queryFn: () => api<Lista<Centro>>('/centros-trabalho') });
export const useColaboradores = () => useQuery({ queryKey: ['colaboradores'], queryFn: () => api<Lista<Colaborador>>('/colaboradores') });
export const useTabelaVigente = (enabled = true) =>
  useQuery({ queryKey: ['tabelas-custos', 'vigente'], queryFn: () => api<TabelaDetalhe>('/tabelas-custos/vigente'), retry: false, enabled });
export const useTabela = (id?: string) =>
  useQuery({ queryKey: ['tabelas-custos', id], queryFn: () => api<TabelaDetalhe>(`/tabelas-custos/${id}`), enabled: !!id && id !== 'vigente' });

/** Mutação com toast de sucesso na voz do produto e invalidação das listas tocadas. */
export function useAcao<V, R = unknown>(
  fn: (v: V) => Promise<R>,
  { invalida = [], sucesso, onSuccess }: { invalida?: QueryKey[]; sucesso?: ReactNode | ((r: R, v: V) => ReactNode); onSuccess?: (r: R, v: V) => void } = {}
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      invalida.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      const s = typeof sucesso === 'function' ? (sucesso as (r: R, v: V) => ReactNode)(r, v) : sucesso;
      if (s) toast(s, 'ok');
      onSuccess?.(r, v);
    },
    onError: (e) => toast(msgErro(e), 'bad')
  });
}
