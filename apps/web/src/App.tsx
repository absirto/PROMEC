import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
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

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
                <Route path="*" element={<NaoEncontrado />} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
