import { rotaNotificacao } from './rotaNotificacao';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Notificacao { id: string; tipo: 'INFO' | 'ATENCAO' | 'ERRO' | 'SUCESSO'; titulo: string; mensagem: string; link: string | null; lida: boolean; data: string }
const ICONE = { INFO: [Info, 'text-info bg-info-soft'], ATENCAO: [AlertTriangle, 'text-warn bg-warn-soft'], ERRO: [XCircle, 'text-bad bg-bad-soft'], SUCESSO: [CheckCircle2, 'text-ok bg-ok-soft'] } as const;

const quando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export function Notificacoes() {
  const { logado } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ['notificacoes'], queryFn: () => api<{ itens: Notificacao[]; naoLidas: number }>('/notificacoes'), enabled: logado, refetchInterval: 60_000, retry: false });
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);
  if (q.isError) return null;
  const n = q.data?.naoLidas ?? 0;
  const itens = q.data?.itens ?? [];
  const ler = async (x: Notificacao) => {
    if (!x.lida) { await api(`/notificacoes/${x.id}/ler`, { method: 'POST' }).catch(() => null); qc.invalidateQueries({ queryKey: ['notificacoes'] }); }
    const destino = rotaNotificacao(x.link);
    if (!destino) return;
    setAberto(false);
    if (destino.externo) window.open(destino.rota, '_blank', 'noopener');
    else navigate(destino.rota);
  };
  const lerTodas = async () => { await api('/notificacoes/ler-todas', { method: 'POST' }).catch(() => null); qc.invalidateQueries({ queryKey: ['notificacoes'] }); };
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAberto(!aberto)} aria-haspopup="true" aria-expanded={aberto} aria-label={n ? `Notificações, ${n} novas` : 'Notificações'}
        className="relative size-10 grid place-items-center rounded-full hover:bg-surface-3">
        <Bell className="size-5" aria-hidden />
        {n > 0 && <span className="mono absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-primary text-white text-[10px] font-bold grid place-items-center">{n > 99 ? '99+' : n}</span>}
      </button>
      {aberto && (
        <div className="fixed left-3 right-3 top-[76px] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px] card shadow-2 anim-subir z-50 overflow-hidden" role="dialog" aria-label="Notificações">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <strong className="text-[15px]">Notificações</strong>
            {n > 0 && <button type="button" onClick={lerTodas} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-text"><CheckCheck className="size-4" aria-hidden />Marcar todas como lidas</button>}
          </div>
          <ul className="m-0 p-0 list-none max-h-[60vh] overflow-y-auto">
            {itens.length === 0 && <li className="px-4 py-6 text-center text-[14px] text-ink-3">Nada novo por aqui. Quando algo pedir você, aparece aqui.</li>}
            {itens.map((x) => {
              const [I, cor] = ICONE[x.tipo] ?? ICONE.INFO;
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => ler(x)} className={`w-full text-left flex gap-3 px-4 py-3 border-b border-border hover:bg-surface-2 ${x.lida ? 'opacity-70' : ''}`}>
                    <span className={`chip-ico !size-8 ${cor}`}><I className="size-4" aria-hidden /></span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="flex justify-between gap-2"><span className={`text-[14px] ${x.lida ? '' : 'font-semibold'}`}>{x.titulo}</span><span className="text-caption text-ink-3 whitespace-nowrap">{quando(x.data)}</span></span>
                      <span className="text-[13px] text-ink-2">{x.mensagem}</span>
                    </span>
                    {!x.lida && <span className="size-2 rounded-full bg-primary mt-2 flex-none" aria-label="não lida" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
