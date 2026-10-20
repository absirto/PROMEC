import { Lock } from 'lucide-react';
import { DICA_MASCARA, MASCARA } from '../lib/permissoes';
import { useAuth } from '../lib/auth';
import { brl } from '../lib/format';

/** Custo escondido por permissão: mesmo espaço do número, com dica. */
export function Mascara({ className = '', dica = DICA_MASCARA }: { className?: string; dica?: string }) {
  return (
    <span className={`mono inline-flex items-center gap-1 text-ink-3 cursor-help ${className}`} title={dica} aria-label={dica} tabIndex={0}>
      {MASCARA}<Lock className="size-3" aria-hidden />
    </span>
  );
}

export const useVerCusto = () => useAuth().pode('custo.ver_custo_hora');

/** Custo-hora formatado, ou •••• quando a pessoa não pode ver (ou a API mascarou). */
export function CustoHora({ valor, sufixo = '', formatar = brl, className = '' }: { valor: string | number | null | undefined; sufixo?: string; formatar?: (v: string | number) => string; className?: string }) {
  const ver = useVerCusto();
  if (!ver || valor === null || valor === undefined) return <Mascara className={className} />;
  return <span className={className}>{formatar(valor)}{sufixo}</span>;
}
