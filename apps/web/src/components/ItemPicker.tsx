import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Item, Lista, TipoItem } from '../lib/types';
import { brl, num } from '../lib/format';
import { Select } from './Field';

export const useItens = (tipo?: TipoItem | TipoItem[]) =>
  useQuery({ queryKey: ['itens', 'todos'], queryFn: () => api<Lista<Item>>('/itens'), staleTime: 60_000, select: (d) => (tipo ? d.itens.filter((i) => i.ativo && (Array.isArray(tipo) ? tipo.includes(i.tipo) : i.tipo === tipo)) : d.itens.filter((i) => i.ativo)) });

/** Escolha de item mostrando disponível e custo médio. */
export function ItemPicker({ value, onChange, tipos, rotulo = 'Item do estoque', vazio = 'Escolha o item', className, invalido, disabled }: {
  value: string; onChange: (id: string, item?: Item) => void; tipos?: TipoItem[]; rotulo?: string; vazio?: string; className?: string; invalido?: boolean; disabled?: boolean;
}) {
  const q = useItens(tipos);
  const itens = q.data ?? [];
  return (
    <Select
      aria-label={rotulo}
      value={value}
      vazio={q.isLoading ? 'Carregando itens…' : vazio}
      onChange={(id) => onChange(id, itens.find((i) => i.id === id))}
      opcoes={itens.map((i) => ({ valor: i.id, rotulo: `${i.codigo} · ${i.descricao} · ${num(i.saldo?.disponivel ?? 0, 2)} ${i.unidadeConsumo} · ${brl(i.custoMedio)}/${i.unidadeConsumo}` }))}
      className={className}
      invalido={invalido}
      disabled={disabled}
    />
  );
}
