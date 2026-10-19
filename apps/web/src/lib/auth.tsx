import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, getToken, SESSAO_EXPIRADA, setToken } from './api';
import { gravar, ler } from './storage';
import type { Me, Usuario } from './types';

interface Auth {
  usuario: (Usuario & Partial<Pick<Me, 'empresa'>>) | null;
  logado: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: (motivo?: string) => void;
  motivoSaida: string | null;
}

const Ctx = createContext<Auth | null>(null);
const CHAVE_USUARIO = 'promec.usuario';

const usuarioSalvo = (): Usuario | null => {
  try {
    const s = ler(CHAVE_USUARIO);
    return s ? (JSON.parse(s) as Usuario) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [logado, setLogado] = useState(() => !!getToken());
  const [usuario, setUsuario] = useState<Usuario | null>(() => (getToken() ? usuarioSalvo() : null));
  const [motivoSaida, setMotivo] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), enabled: logado, staleTime: 5 * 60_000 });

  const sair = useCallback(
    (motivo?: string) => {
      setToken(null);
      gravar(CHAVE_USUARIO, null);
      setLogado(false);
      setUsuario(null);
      setMotivo(motivo ?? null);
      qc.clear();
      navigate('/login', { replace: true });
    },
    [qc, navigate]
  );

  useEffect(() => {
    const h = () => sair('Sua sessão terminou. Entre de novo para continuar de onde parou.');
    window.addEventListener(SESSAO_EXPIRADA, h);
    return () => window.removeEventListener(SESSAO_EXPIRADA, h);
  }, [sair]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', { method: 'POST', body: { email, senha } });
    setToken(r.token);
    gravar(CHAVE_USUARIO, JSON.stringify(r.usuario));
    setUsuario(r.usuario);
    setMotivo(null);
    setLogado(true);
  }, []);

  const valor = useMemo<Auth>(
    () => ({ usuario: me.data ?? usuario, logado, entrar, sair, motivoSaida }),
    [me.data, usuario, logado, entrar, sair, motivoSaida]
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
};

export const podeLiberarMargem = (papel?: string) => papel === 'GESTOR' || papel === 'ADMIN';
