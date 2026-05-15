import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { ThemeProvider } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';

// Analytics & Dashboard
const Home = lazy(() => import('./pages/analytics/dashboard/Home'));
const ReportsDashboard = lazy(() => import('./pages/analytics/reports/ReportsDashboard'));
const OperationalReports = lazy(() => import('./pages/analytics/reports/OperationalReports'));
const AdministrativeReports = lazy(() => import('./pages/analytics/reports/AdministrativeReports'));
const ServiceOrdersReport = lazy(() => import('./pages/analytics/reports/ServiceOrdersReport'));
const StockMovementsReport = lazy(() => import('./pages/analytics/reports/StockMovementsReport'));
const ProductionReport = lazy(() => import('./pages/analytics/reports/ProductionReport'));
const QualityReport = lazy(() => import('./pages/analytics/reports/QualityReport'));
const FinancialFlowReport = lazy(() => import('./pages/analytics/reports/FinancialFlowReport'));
const AccountsReport = lazy(() => import('./pages/analytics/reports/AccountsReport'));
const TeamPerformanceReport = lazy(() => import('./pages/analytics/reports/TeamPerformanceReport'));
const UsersSummaryReport = lazy(() => import('./pages/analytics/reports/UsersSummaryReport'));
const ProfitabilityReport = lazy(() => import('./pages/analytics/reports/ProfitabilityReport'));

// Authentication
const Login = lazy(() => import('./pages/auth/Login'));

// Operations
const EmployeesList = lazy(() => import('./pages/operations/employees/EmployeesList'));
const EmployeeForm = lazy(() => import('./pages/operations/employees/EmployeeForm'));
const MaterialsList = lazy(() => import('./pages/operations/materials/MaterialsList'));
const MaterialForm = lazy(() => import('./pages/operations/materials/MaterialForm'));
const PeopleList = lazy(() => import('./pages/operations/people/PeopleList'));
const PersonForm = lazy(() => import('./pages/operations/people/PersonForm'));
const QualityControlsList = lazy(() => import('./pages/operations/quality-controls/QualityControlsList'));
const QualityControlForm = lazy(() => import('./pages/operations/quality-controls/QualityControlForm'));
const ServiceOrdersList = lazy(() => import('./pages/operations/service-orders/ServiceOrdersList'));
const ServiceOrderForm = lazy(() => import('./pages/operations/service-orders/ServiceOrderForm'));
const BudgetsList = lazy(() => import('./pages/operations/service-orders/BudgetsList'));
const ServicesCatalogList = lazy(() => import('./pages/operations/services-catalog/ServicesCatalogList'));
const ServiceCatalogForm = lazy(() => import('./pages/operations/services-catalog/ServiceCatalogForm'));
const StockList = lazy(() => import('./pages/operations/materials/StockList'));
const PurchasesList = lazy(() => import('./pages/operations/materials/PurchasesList'));
const QuotationsList = lazy(() => import('./pages/operations/materials/QuotationsList'));

// Admin & Profile
const Profile = lazy(() => import('./pages/admin/users/Profile'));
const UsersList = lazy(() => import('./pages/admin/users/UsersList'));
const UserForm = lazy(() => import('./pages/admin/users/UserForm'));
const GroupsList = lazy(() => import('./pages/admin/groups/GroupsList'));
const GroupForm = lazy(() => import('./pages/admin/groups/GroupForm'));
const SettingsForm = lazy(() => import('./pages/admin/settings/SettingsForm'));
const AuxiliaryTables = lazy(() => import('./pages/admin/settings/AuxiliaryTables'));

// Financial
const FinanceList = lazy(() => import('./pages/financial/finance/FinanceList'));

// Layout
const MainLayout = lazy(() => import('./components/layout/MainLayout'));

const AppLayout = () => (
  <ProtectedRoute>
    <MainLayout>
      <Outlet />
    </MainLayout>
  </ProtectedRoute>
);

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<div style={{ background: '#0b1120', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4bf', fontWeight: 800 }}>Carregando ProMEC...</div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<ProtectedRoute permission="dashboard:visualizar"><Home /></ProtectedRoute>} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="employees" element={<ProtectedRoute permission="funcionarios:visualizar"><EmployeesList /></ProtectedRoute>} />
                  <Route path="employees/new" element={<ProtectedRoute permission="funcionarios:gerenciar"><EmployeeForm /></ProtectedRoute>} />
                  <Route path="employees/:id" element={<ProtectedRoute permission="funcionarios:visualizar"><EmployeeForm isView={true} /></ProtectedRoute>} />
                  <Route path="employees/:id/edit" element={<ProtectedRoute permission="funcionarios:gerenciar"><EmployeeForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="materials" element={<ProtectedRoute permission="materiais:visualizar"><MaterialsList /></ProtectedRoute>} />
                  <Route path="materials/new" element={<ProtectedRoute permission="materiais:gerenciar"><MaterialForm /></ProtectedRoute>} />
                  <Route path="materials/:id" element={<ProtectedRoute permission="materiais:visualizar"><MaterialForm isView={true} /></ProtectedRoute>} />
                  <Route path="materials/:id/edit" element={<ProtectedRoute permission="materiais:gerenciar"><MaterialForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="people" element={<ProtectedRoute permission="pessoas:visualizar"><PeopleList /></ProtectedRoute>} />
                  <Route path="people/new" element={<ProtectedRoute permission="pessoas:gerenciar"><PersonForm /></ProtectedRoute>} />
                  <Route path="people/:id" element={<ProtectedRoute permission="pessoas:visualizar"><PersonForm isView={true} /></ProtectedRoute>} />
                  <Route path="people/:id/edit" element={<ProtectedRoute permission="pessoas:gerenciar"><PersonForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="quality-controls" element={<ProtectedRoute permission="qualidade:visualizar"><QualityControlsList /></ProtectedRoute>} />
                  <Route path="quality-controls/new" element={<ProtectedRoute permission="qualidade:gerenciar"><QualityControlForm /></ProtectedRoute>} />
                  <Route path="quality-controls/:id" element={<ProtectedRoute permission="qualidade:visualizar"><QualityControlForm isView={true} /></ProtectedRoute>} />
                  <Route path="quality-controls/:id/edit" element={<ProtectedRoute permission="qualidade:gerenciar"><QualityControlForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="service-orders" element={<ProtectedRoute permission="os:visualizar"><ServiceOrdersList showFinancialData={false} viewPathBase="/service-orders" /></ProtectedRoute>} />
                  <Route path="service-orders/new" element={<ProtectedRoute permission="os:gerenciar"><ServiceOrderForm /></ProtectedRoute>} />
                  <Route path="service-orders/:id" element={<ProtectedRoute permission="os:visualizar"><ServiceOrderForm isView={true} showFinancialData={false} listPath="/service-orders" /></ProtectedRoute>} />
                  <Route path="service-orders/:id/edit" element={<ProtectedRoute permission="os:gerenciar"><ServiceOrderForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="finance/service-orders" element={<ProtectedRoute permission="financeiro:visualizar"><ServiceOrdersList showFinancialData={true} title="Ordens de Serviço Financeiras" viewPathBase="/finance/service-orders" /></ProtectedRoute>} />
                  <Route path="finance/service-orders/:id" element={<ProtectedRoute permission="financeiro:visualizar"><ServiceOrderForm isView={true} showFinancialData={true} listPath="/finance/service-orders" /></ProtectedRoute>} />
                  <Route path="budgets" element={<ProtectedRoute permission="orcamentos:visualizar"><BudgetsList /></ProtectedRoute>} />
                  <Route path="services-catalog" element={<ProtectedRoute permission="materiais:visualizar"><ServicesCatalogList /></ProtectedRoute>} />
                  <Route path="services-catalog/new" element={<ProtectedRoute permission="materiais:gerenciar"><ServiceCatalogForm /></ProtectedRoute>} />
                  <Route path="services-catalog/:id" element={<ProtectedRoute permission="materiais:visualizar"><ServiceCatalogForm isView={true} /></ProtectedRoute>} />
                  <Route path="services-catalog/:id/edit" element={<ProtectedRoute permission="materiais:gerenciar"><ServiceCatalogForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute permission="usuarios:gerenciar"><UsersList /></ProtectedRoute>} />
                  <Route path="users/new" element={<ProtectedRoute permission="usuarios:gerenciar"><UserForm /></ProtectedRoute>} />
                  <Route path="users/:id" element={<ProtectedRoute permission="usuarios:gerenciar"><UserForm isView={true} /></ProtectedRoute>} />
                  <Route path="users/:id/edit" element={<ProtectedRoute permission="usuarios:gerenciar"><UserForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="groups" element={<ProtectedRoute permission="usuarios:gerenciar"><GroupsList /></ProtectedRoute>} />
                  <Route path="groups/new" element={<ProtectedRoute permission="usuarios:gerenciar"><GroupForm /></ProtectedRoute>} />
                  <Route path="groups/:id" element={<ProtectedRoute permission="usuarios:gerenciar"><GroupForm isView={true} /></ProtectedRoute>} />
                  <Route path="groups/:id/edit" element={<ProtectedRoute permission="usuarios:gerenciar"><GroupForm isEdit={true} /></ProtectedRoute>} />
                  <Route path="stock" element={<ProtectedRoute permission="estoque:visualizar"><StockList /></ProtectedRoute>} />
                  <Route path="purchases" element={<ProtectedRoute permission="estoque:visualizar"><PurchasesList /></ProtectedRoute>} />
                  <Route path="quotations" element={<ProtectedRoute permission="estoque:visualizar"><QuotationsList /></ProtectedRoute>} />
                  <Route path="finance" element={<ProtectedRoute permission="financeiro:visualizar"><FinanceList /></ProtectedRoute>} />
                  <Route path="settings" element={<ProtectedRoute permission="configuracoes:gerenciar"><SettingsForm /></ProtectedRoute>} />
                  <Route path="auxiliary-tables" element={<ProtectedRoute permission="configuracoes:gerenciar"><AuxiliaryTables /></ProtectedRoute>} />

                  <Route path="reports" element={<ProtectedRoute permission="relatorios:visualizar"><ReportsDashboard /></ProtectedRoute>}>
                    <Route path="operational" element={<OperationalReports />}>
                      <Route path="service-orders" element={<ServiceOrdersReport />} />
                      <Route path="stock-movements" element={<StockMovementsReport />} />
                      <Route path="production" element={<ProductionReport />} />
                      <Route path="quality" element={<QualityReport />} />
                    </Route>
                    <Route path="administrative" element={<AdministrativeReports />}>
                      <Route path="financial-flow" element={<FinancialFlowReport />} />
                      <Route path="accounts" element={<AccountsReport />} />
                      <Route path="team-performance" element={<TeamPerformanceReport />} />
                      <Route path="users-summary" element={<UsersSummaryReport />} />
                      <Route path="profitability" element={<ProfitabilityReport />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
