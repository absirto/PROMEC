import type { ReactNode } from 'react';
import { Card } from './Card';
import { Busca, FiltroChips } from './DataTable';
import { Carregando, ErroEstado } from './EmptyState';

/** Moldura padrão das listagens: busca que filtra ao digitar, filtros por situação com contagem e estados. */
export function Listagem<T extends string>({
  rotulo, busca, onBusca, placeholder, filtros, filtro, onFiltro, carregando, erro, tentar, vazio, semResultado, total, mostrando, children
}: {
  rotulo: string;
  busca: string;
  onBusca: (v: string) => void;
  placeholder: string;
  filtros: { valor: T; rotulo: string; n?: number }[];
  filtro: T;
  onFiltro: (v: T) => void;
  carregando: boolean;
  erro: unknown;
  tentar: () => void;
  vazio: ReactNode | null;
  semResultado: boolean;
  total: number;
  mostrando: number;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden anim-subir" aria-label={rotulo}>
      <div className="px-4 py-3.5 flex flex-wrap gap-2.5 items-center border-b border-border">
        <Busca valor={busca} onChange={onBusca} placeholder={placeholder} />
        <FiltroChips rotulo="Filtrar por situação" opcoes={filtros} valor={filtro} onChange={onFiltro} />
      </div>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <ErroEstado erro={erro} tentar={tentar} />
      ) : vazio ? (
        vazio
      ) : (
        <>
          {children}
          {semResultado && (
            <p className="m-0 p-10 text-center text-ink-2">
              Nada encontrado{busca ? ` para “${busca}”` : ' com esse filtro'}. Tente outro termo ou limpe os filtros.
            </p>
          )}
          <div className="px-4 py-3 text-[13.5px] text-ink-2 border-t border-border" aria-live="polite">
            Mostrando <strong>{mostrando}</strong> de <strong>{total}</strong>
          </div>
        </>
      )}
    </Card>
  );
}

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
