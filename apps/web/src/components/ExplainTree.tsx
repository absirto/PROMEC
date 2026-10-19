import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { NoExplicacao } from '@promec/motor';
import { brl, horas, num, toNum } from '../lib/format';

export const valorNo = (n: Pick<NoExplicacao, 'valor' | 'unidade'>) => {
  switch (n.unidade) {
    case 'R$': return brl(n.valor);
    case 'R$/h': return `${brl(n.valor)}/h`;
    case 'h': return horas(n.valor, 1);
    case '%': return `${num(n.valor, 1)}%`;
    case 'kg': return `${num(n.valor, 3)} kg`;
    case 'un': return num(n.valor, 0);
    default: return num(n.valor);
  }
};

function No({ no, nivel, pai, abertoInicial }: { no: NoExplicacao; nivel: number; pai?: NoExplicacao; abertoInicial: number }) {
  const [aberto, setAberto] = useState(nivel < abertoInicial);
  const temFilhos = !!no.filhos?.length;
  const prop = pai && pai.unidade === no.unidade && toNum(pai.valor) > 0 ? Math.min(1, Math.abs(toNum(no.valor)) / toNum(pai.valor)) : null;
  return (
    <li className="anim-subir" style={{ animationDelay: `${nivel * 40}ms` }}>
      <div className="flex items-start gap-2 py-1.5" style={{ paddingLeft: nivel * 16 }}>
        {temFilhos ? (
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
            aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${no.rotulo}`}
            className="mt-0.5 size-6 grid place-items-center rounded-md text-ink-3 hover:bg-surface-3 flex-none"
          >
            <ChevronRight className={`size-4 transition-transform duration-micro ${aberto ? 'rotate-90' : ''}`} aria-hidden />
          </button>
        ) : (
          <span className="w-6 flex-none" />
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex justify-between gap-3 items-baseline">
            <span className={`text-[14px] ${nivel === 0 ? 'font-semibold' : ''}`}>{no.rotulo}</span>
            <span className={`mono text-[14px] whitespace-nowrap ${nivel === 0 ? 'font-bold' : 'font-medium'}`}>{valorNo(no)}</span>
          </div>
          {no.formula && <span className="text-caption text-ink-3">{no.formula}</span>}
          {prop !== null && (
            <span className="h-1 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
              <span className="anim-crescer block h-full rounded-full bg-steel" style={{ width: `${prop * 100}%` }} />
            </span>
          )}
        </div>
      </div>
      {temFilhos && aberto && (
        <ul className="m-0 p-0 list-none">
          {no.filhos!.map((f, i) => (
            <No key={`${f.rotulo}-${i}`} no={f} nivel={nivel + 1} pai={no} abertoInicial={abertoInicial} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ExplainTree({ raiz, abertoInicial = 2, rotulo = 'Árvore de composição' }: { raiz: NoExplicacao; abertoInicial?: number; rotulo?: string }) {
  return (
    <ul className="m-0 p-0 list-none" aria-label={rotulo}>
      <No no={raiz} nivel={0} abertoInicial={abertoInicial} />
    </ul>
  );
}
