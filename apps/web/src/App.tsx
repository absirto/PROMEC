import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './layout/AppShell';
import { Login } from './pages/Login';
import { Carregando } from './components/EmptyState';
import { NaoEncontrado } from './pages/NaoEncontrado';

const Painel = lazy(() => import('./pages/Painel'));
const TabelasCustos = lazy(() => import('./pages/TabelasCustos'));
const TabelaDetalhe = lazy(() => import('./pages/TabelaDetalhe'));
const CustoFixo = lazy(() => import('./pages/CustoFixo'));
const CentrosLista = lazy(() => import('./pages/CentrosLista'));
const CentroForm = lazy(() => import('./pages/CentroForm'));
const ColaboradoresLista = lazy(() => import('./pages/ColaboradoresLista'));
const ColaboradorForm = lazy(() => import('./pages/ColaboradorForm'));
const ClientesLista = lazy(() => import('./pages/ClientesLista'));
const ClienteForm = lazy(() => import('./pages/ClienteForm'));
const OrcamentosLista = lazy(() => import('./pages/OrcamentosLista'));
const OrcamentoEditor = lazy(() => import('./pages/OrcamentoEditor'));
const OSLista = lazy(() => import('./pages/OSLista'));
const OSNova = lazy(() => import('./pages/OSNova'));
const OSDetalhe = lazy(() => import('./pages/OSDetalhe'));
const Planejamento = lazy(() => import('./pages/Planejamento'));
const Agenda = lazy(() => import('./pages/Agenda'));
const ModoOperador = lazy(() => import('./pages/ModoOperador'));

function TelaOperador() {
  const { logado } = useAuth();
  if (!logado) return <Navigate to="/login" replace state={{ de: '/operador' }} />;
  return (
    <Suspense fallback={<Carregando />}>
      <ModoOperador />
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/operador" element={<TelaOperador />} />
      <Route element={<AppShell />}>
        <Route
          path="*"
          element={
            <Suspense fallback={<div className="card"><Carregando /></div>}>
              <Routes>
                <Route index element={<Painel />} />
                <Route path="tabelas-custos" element={<TabelasCustos />} />
                <Route path="tabelas-custos/:id" element={<TabelaDetalhe />} />
                <Route path="custo-fixo" element={<CustoFixo />} />
                <Route path="centros-trabalho" element={<CentrosLista />} />
                <Route path="centros-trabalho/:id" element={<CentroForm />} />
                <Route path="colaboradores" element={<ColaboradoresLista />} />
                <Route path="colaboradores/:id" element={<ColaboradorForm />} />
                <Route path="clientes" element={<ClientesLista />} />
                <Route path="clientes/:id" element={<ClienteForm />} />
                <Route path="orcamentos" element={<OrcamentosLista />} />
                <Route path="orcamentos/:id" element={<OrcamentoEditor />} />
                <Route path="ordens-servico" element={<OSLista />} />
                <Route path="ordens-servico/nova" element={<OSNova />} />
                <Route path="ordens-servico/:id" element={<OSDetalhe />} />
                <Route path="planejamento" element={<Planejamento />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="*" element={<NaoEncontrado />} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
