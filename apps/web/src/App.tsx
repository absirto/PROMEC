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
const ItensLista = lazy(() => import('./pages/ItensLista'));
const ItemForm = lazy(() => import('./pages/ItemForm'));
const FornecedoresLista = lazy(() => import('./pages/FornecedoresLista'));
const FornecedorForm = lazy(() => import('./pages/FornecedorForm'));
const Estoque = lazy(() => import('./pages/Estoque'));
const Compras = lazy(() => import('./pages/Compras'));
const CotacaoDetalhe = lazy(() => import('./pages/CotacaoDetalhe'));
const PedidoDetalhe = lazy(() => import('./pages/PedidoDetalhe'));
const Qualidade = lazy(() => import('./pages/Qualidade'));
const Laudo = lazy(() => import('./pages/Laudo'));
const Titulos = lazy(() => import('./pages/Titulos'));
const FluxoCaixa = lazy(() => import('./pages/FluxoCaixa'));
const DREPage = lazy(() => import('./pages/DRE'));
const ComissoesPage = lazy(() => import('./pages/Comissoes'));
const Recorrencias = lazy(() => import('./pages/Recorrencias'));
const ContasCentros = lazy(() => import('./pages/ContasCentros'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Auditoria = lazy(() => import('./pages/Auditoria'));
const CRM = lazy(() => import('./pages/CRM'));
const Manutencao = lazy(() => import('./pages/Manutencao'));
const RH = lazy(() => import('./pages/RH'));
const Parametros = lazy(() => import('./pages/Parametros'));
const TrocarSenha = lazy(() => import('./pages/TrocarSenha'));
const PortalOrcamento = lazy(() => import('./pages/PortalOrcamento'));
const PortalOS = lazy(() => import('./pages/PortalOS'));
const ModoOperador = lazy(() => import('./pages/ModoOperador'));

function TelaLaudo() {
  const { logado } = useAuth();
  if (!logado) return <Navigate to="/login" replace />;
  return (
    <Suspense fallback={<Carregando />}>
      <Laudo />
    </Suspense>
  );
}

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
      <Route path="/portal/orcamento/:token" element={<Suspense fallback={<Carregando />}><PortalOrcamento /></Suspense>} />
      <Route path="/portal/os/:token" element={<Suspense fallback={<Carregando />}><PortalOS /></Suspense>} />
      <Route path="/ordens-servico/:id/laudo" element={<TelaLaudo />} />
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
                <Route path="itens" element={<ItensLista />} />
                <Route path="itens/:id" element={<ItemForm />} />
                <Route path="fornecedores" element={<FornecedoresLista />} />
                <Route path="fornecedores/:id" element={<FornecedorForm />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="compras" element={<Compras />} />
                <Route path="compras/cotacoes/:id" element={<CotacaoDetalhe />} />
                <Route path="compras/pedidos/:id" element={<PedidoDetalhe />} />
                <Route path="qualidade" element={<Qualidade />} />
                <Route path="crm" element={<CRM />} />
                <Route path="manutencao" element={<Manutencao />} />
                <Route path="rh" element={<RH />} />
                <Route path="configuracoes/parametros" element={<Parametros />} />
                <Route path="configuracoes/usuarios" element={<Usuarios />} />
                <Route path="configuracoes/auditoria" element={<Auditoria />} />
                <Route path="trocar-senha" element={<TrocarSenha />} />
                <Route path="financeiro/receber" element={<Titulos tipo="RECEBER" />} />
                <Route path="financeiro/pagar" element={<Titulos tipo="PAGAR" />} />
                <Route path="financeiro/fluxo" element={<FluxoCaixa />} />
                <Route path="financeiro/dre" element={<DREPage />} />
                <Route path="financeiro/comissoes" element={<ComissoesPage />} />
                <Route path="financeiro/recorrencias" element={<Recorrencias />} />
                <Route path="financeiro/contas" element={<ContasCentros />} />
                <Route path="*" element={<NaoEncontrado />} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
