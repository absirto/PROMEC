import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TituloProvider } from './titulo';

export function AppShell() {
  const { logado } = useAuth();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  if (!logado) return <Navigate to="/login" replace state={{ de: loc.pathname }} />;
  return (
    <TituloProvider>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 focus:bg-surface-1 focus:px-4 focus:py-2 focus:rounded-full">
        Pular para o conteúdo
      </a>
      <Sidebar aberta={menu} onFechar={() => setMenu(false)} />
      <div className="lg:pl-[276px] min-h-screen flex flex-col">
        <Topbar onMenu={() => setMenu(true)} />
        <main id="conteudo" className="flex-1 w-full max-w-[1320px] px-3 sm:px-5 pt-5 pb-20 flex flex-col gap-5">
          <Outlet />
        </main>
      </div>
    </TituloProvider>
  );
}
