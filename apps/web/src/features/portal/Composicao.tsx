import type { ReactNode } from 'react';
import { Clock, LinkIcon, RefreshCw, WifiOff, type LucideIcon } from 'lucide-react';
import { Button } from '../../components/Button';
import { brl, iniciais } from '../../lib/format';
import { ErroPortal, mensagemErro, type Grupo } from './portal';

export function Composicao({ grupos }: { grupos: Grupo[] }) {
  if (!grupos.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5" role="img" aria-label={`Como o valor se divide: ${grupos.map((g) => `${g.rotulo} ${g.pct}%`).join(', ')}`}>
        {grupos.map((g) => (
          <span key={g.chave} className="anim-crescer block h-full" style={{ width: `${g.pct}%`, background: g.cor }} />
        ))}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col">
        {grupos.map((g) => (
          <li key={g.chave} className="flex items-baseline justify-between gap-3 py-3 border-t border-border first:border-t-0">
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="size-2.5 rounded-[3px] flex-none" style={{ background: g.cor }} aria-hidden />
              <span className="text-ink-1">{g.rotulo}</span>
            </span>
            <span className="flex items-baseline gap-2 flex-none">
              <span className="mono text-[12.5px] text-ink-3">{g.pct}%</span>
              <span className="mono font-semibold">{brl(g.valor)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Avatar({ nome, className = '' }: { nome: string; className?: string }) {
  return (
    <span className={`size-11 rounded-full grid place-items-center font-bold text-sm text-white flex-none ${className}`} style={{ background: 'linear-gradient(135deg, #F5B63D, #E35D14)' }} aria-hidden>
      {iniciais(nome)}
    </span>
  );
}

export function FundoPortal({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-canvas text-ink-1 overflow-x-hidden"
      style={{ backgroundImage: 'linear-gradient(rgba(60,45,25,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(60,45,25,.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="relative mx-auto w-full max-w-[560px] min-h-screen flex flex-col sm:shadow-2 bg-transparent">{children}</div>
    </div>
  );
}

const TITULOS: Record<string, [string, LucideIcon]> = {
  LINK_INVALIDO: ['Este link não vale mais', LinkIcon],
  MUITAS_TENTATIVAS: ['Calma, só um minuto', Clock],
  OFFLINE: ['Sem conexão agora', WifiOff]
};

export function EstadoPortal({ erro, onTentar }: { erro: unknown; onTentar?: () => void }) {
  const codigo = erro instanceof ErroPortal ? erro.codigo : undefined;
  const [titulo, Icone] = (codigo && TITULOS[codigo]) || ['Não deu para abrir', RefreshCw];
  const msg = erro instanceof ErroPortal && codigo && TITULOS[codigo] ? mensagemErro(codigo) : erro instanceof ErroPortal ? erro.message : mensagemErro();
  return (
    <FundoPortal>
      <main className="flex-1 grid place-items-center px-4 py-12">
        <section className="card anim-subir w-full p-6 flex flex-col items-center text-center gap-3" role="alert">
          <span className="size-16 rounded-full grid place-items-center bg-primary-soft text-primary-text">
            <Icone className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="m-0 font-display text-[30px] font-bold leading-tight">{titulo}</h1>
          <p className="m-0 text-ink-2 max-w-[380px]">{msg}</p>
          {codigo !== 'LINK_INVALIDO' && onTentar && (
            <Button variante="secundario" tamanho="lg" icone={RefreshCw} onClick={onTentar} className="mt-2">
              Tentar de novo
            </Button>
          )}
        </section>
      </main>
    </FundoPortal>
  );
}

export function CarregandoPortal() {
  return (
    <FundoPortal>
      <div className="hero h-[220px]" aria-hidden />
      <main className="px-4 -mt-12 flex flex-col gap-3.5" aria-busy="true" aria-label="Carregando">
        <div className="card h-28 skeleton" />
        <div className="card h-56 skeleton" />
        <div className="card h-40 skeleton" />
      </main>
    </FundoPortal>
  );
}
