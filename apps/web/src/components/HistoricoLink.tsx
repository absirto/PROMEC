import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { useAuth } from '../lib/auth';

/** Atalho para a auditoria filtrada por um registro. Some sem permissão de auditoria. */
export function HistoricoLink({ entidade, id, className = '' }: { entidade: string; id: string; className?: string }) {
  const { pode } = useAuth();
  if (!pode('configuracoes.visualizar') && !pode('usuarios.visualizar')) return null;
  return (
    <Link to={`/configuracoes/auditoria?entidade=${encodeURIComponent(entidade)}&entidadeId=${encodeURIComponent(id)}`}
      className={`inline-flex items-center gap-1.5 text-[13.5px] font-medium text-info hover:underline min-h-[32px] ${className}`}>
      <History className="size-4" aria-hidden />Histórico de alterações
    </Link>
  );
}
