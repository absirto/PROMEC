import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const Ctx = createContext<{ titulo: string; set: (t: string) => void }>({ titulo: '', set: () => {} });

export function TituloProvider({ children }: { children: ReactNode }) {
  const [titulo, set] = useState('');
  return <Ctx.Provider value={{ titulo, set }}>{children}</Ctx.Provider>;
}

export function useTitulo(t: string) {
  const { set } = useContext(Ctx);
  useEffect(() => {
    set(t);
    document.title = t ? `${t} · ProMEC` : 'ProMEC';
  }, [t, set]);
}

export const useTituloAtual = () => useContext(Ctx).titulo;
