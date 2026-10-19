import { brl, pct, toNum } from '../lib/format';

export interface Fatia { chave: string; rotulo: string; valor: string | number; cor: string }

export const COR_ORCAMENTO: Record<string, [string, string]> = {
  material: ['Material', 'var(--pm-chart-material)'],
  ferramental: ['Ferramental', '#2A6AA3'],
  horaMaquina: ['Hora-máquina (ciclo)', 'var(--pm-chart-hora)'],
  setup: ['Setup', 'var(--pm-chart-setup)'],
  maoDeObra: ['Mão de obra', 'var(--pm-chart-material)'],
  rateio: ['Rateio do custo fixo', 'var(--pm-chart-rateio)'],
  terceiros: ['Terceiros', '#0E7C86'],
  frete: ['Frete', '#5B6B7F'],
  impostos: ['Impostos', 'var(--pm-chart-impostos)'],
  comissao: ['Comissão', '#B5AC9C'],
  margem: ['Margem', 'var(--pm-chart-margem)']
};

export const COR_CENTRO: Record<string, [string, string]> = {
  maoDeObra: ['Mão de obra', 'var(--pm-chart-material)'],
  manutencao: ['Manutenção', 'var(--pm-chart-hora)'],
  insumos: ['Insumos', 'var(--pm-chart-setup)'],
  depreciacao: ['Depreciação', 'var(--pm-chart-rateio)'],
  energia: ['Energia', 'var(--pm-chart-impostos)'],
  outros: ['Outros', '#B5AC9C'],
  rateio: ['Rateio do custo fixo', 'var(--pm-chart-margem)']
};

export const fatias = (valores: Record<string, string | number> | { categoria: string; valor: string }[], mapa: Record<string, [string, string]>): Fatia[] => {
  const pares = Array.isArray(valores) ? valores.map((v) => [v.categoria, v.valor] as const) : Object.keys(mapa).map((k) => [k, valores[k] ?? 0] as const);
  return pares
    .filter(([, v]) => toNum(v) > 0)
    .map(([k, v]) => ({ chave: k, rotulo: mapa[k]?.[0] ?? k, cor: mapa[k]?.[1] ?? 'var(--pm-neutral)', valor: v }));
};

export function CompositionBar({ itens, legenda = true, altura = 16, unidade = 'R$', rotulo = 'Composição' }: { itens: Fatia[]; legenda?: boolean; altura?: number; unidade?: 'R$' | 'R$/h'; rotulo?: string }) {
  const total = itens.reduce((a, i) => a + toNum(i.valor), 0) || 1;
  const aria = `${rotulo}: ${itens.map((i) => `${i.rotulo} ${pct(toNum(i.valor) / total)}`).join(', ')}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex overflow-hidden gap-0.5" style={{ height: altura, borderRadius: altura / 2 }} role="img" aria-label={aria}>
        {itens.map((i) => (
          <span key={i.chave} className="anim-crescer block h-full" style={{ width: `${(toNum(i.valor) / total) * 100}%`, background: i.cor }} title={`${i.rotulo}: ${brl(i.valor)}`} />
        ))}
      </div>
      {legenda && (
        <ul className="m-0 p-0 list-none flex flex-col">
          {itens.map((i) => (
            <li key={i.chave} className="grid grid-cols-[12px_minmax(0,1fr)_auto_52px] gap-2.5 items-center py-1 text-[13.5px]">
              <span className="size-3 rounded" style={{ background: i.cor }} aria-hidden />
              <span className="text-ink-2 truncate">{i.rotulo}</span>
              <span className="mono font-medium">
                {brl(i.valor)}
                {unidade === 'R$/h' && <span className="text-ink-3 text-[12px]">/h</span>}
              </span>
              <span className="mono text-right text-ink-3 text-[12px]">{pct(toNum(i.valor) / total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
