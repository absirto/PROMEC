import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Contrast, KeyRound, Layers, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTema, type Tema } from '../lib/theme';
import { api } from '../lib/api';
import type { TabelaResumo } from '../lib/types';
import { iniciais } from '../lib/format';
import { useTituloAtual } from './titulo';
import { Notificacoes } from './Notificacoes';

const PAPEIS: Record<string, string> = { ADMIN: 'Administração', GESTOR: 'Gestão', ORCAMENTISTA: 'Orçamentos', OPERADOR: 'Operação' };

function SeletorTema() {
  const [tema, setTema] = useTema();
  const ops: { v: Tema; l: string; I: typeof Sun }[] = [
    { v: 'claro', l: 'Tema claro', I: Sun },
    { v: 'escuro', l: 'Tema escuro', I: Moon },
    { v: 'alto-contraste', l: 'Alto contraste', I: Contrast }
  ];
  return (
    <div role="radiogroup" aria-label="Tema" className="flex p-1 rounded-full bg-surface-3 gap-0.5">
      {ops.map(({ v, l, I }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={tema === v}
          aria-label={l}
          title={l}
          onClick={() => setTema(v)}
          className={`h-8 w-9 grid place-items-center rounded-full transition duration-micro ${tema === v ? 'bg-ink-1 text-surface-1' : 'text-ink-2 hover:text-ink-1'}`}
        >
          <I className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function MenuUsuario() {
  const { usuario, sair } = useAuth();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Menu de ${usuario?.nome ?? 'usuário'}`}
        className="size-10 rounded-full grid place-items-center text-[13px] font-bold text-[#1E1B16]"
        style={{ background: 'linear-gradient(135deg, #F5B63D, #E35D14)' }}
      >
        {iniciais(usuario?.nome)}
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-12 w-64 card p-2 shadow-2 anim-subir z-50">
          <div className="px-3 py-2 flex flex-col">
            <span className="font-semibold">{usuario?.nome}</span>
            <span className="text-caption text-ink-3 truncate">{usuario?.email}</span>
            <span className="text-caption text-ink-2 mt-1">
              {usuario?.empresa?.nome ? `${usuario.empresa.nome} · ` : ''}
              {usuario?.perfil?.nome ?? PAPEIS[usuario?.papel ?? ''] ?? usuario?.papel}
            </span>
          </div>
          <Link role="menuitem" to="/trocar-senha" onClick={() => setAberto(false)} className="w-full flex items-center gap-2 h-10 px-3 rounded-control hover:bg-surface-3 text-[14px] no-underline text-ink-1">
            <KeyRound className="size-4" aria-hidden /> Trocar senha
          </Link>
          <button role="menuitem" type="button" onClick={() => sair()} className="w-full flex items-center gap-2 h-10 px-3 rounded-control hover:bg-surface-3 text-[14px]">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const titulo = useTituloAtual();
  const verTabela = useAuth().pode('custos.visualizar');
  const vigente = useQuery({ queryKey: ['tabelas-custos', 'vigente'], queryFn: () => api<TabelaResumo>('/tabelas-custos/vigente'), retry: false, staleTime: 60_000, enabled: verTabela });
  return (
    <header className="glass sticky top-3 z-20 mx-3 sm:mx-5 mt-3 rounded-full pl-2 sm:pl-5 pr-2 py-1.5 flex items-center gap-2 sm:gap-3">
      <button type="button" onClick={onMenu} aria-label="Abrir menu" className="lg:hidden size-10 grid place-items-center rounded-full hover:bg-surface-3">
        <Menu className="size-5" aria-hidden />
      </button>
      <span className="font-semibold text-[14px] truncate flex-[1_1_120px]">{titulo}</span>
      <label className="hidden md:flex items-center gap-2 h-10 px-4 rounded-full bg-surface-2 border border-border text-ink-3 w-[min(320px,30vw)]">
        <Search className="size-4" aria-hidden />
        <span className="sr-only">Buscar</span>
        <input disabled placeholder="Buscar orçamento, cliente… em breve" className="bg-transparent outline-none flex-1 min-w-0 text-[13.5px] cursor-not-allowed" />
      </label>
      {vigente.data && (
        <Link to={`/tabelas-custos/${vigente.data.id}`} className="hidden sm:inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full bg-ok-soft text-ok text-caption font-semibold no-underline whitespace-nowrap">
          <Layers className="size-3.5" aria-hidden />
          Custos {vigente.data.competencia} · v{vigente.data.versao}
          {vigente.data.desatualizada && <span className="size-2 rounded-full bg-signal" title="Desatualizada" />}
        </Link>
      )}
      <SeletorTema />
      <Notificacoes />
      <MenuUsuario />
    </header>
  );
}
