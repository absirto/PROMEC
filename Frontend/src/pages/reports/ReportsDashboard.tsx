
import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { 
  FileText, TrendingUp, Package, Users, 
  BarChart3, Wallet, Clock, CheckCircle2 
} from 'lucide-react';
import styles from './ReportsDashboard.module.css';

const ReportsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Se não estivermos na raiz de /reports, renderizar apenas o Outlet (o relatório específico)
  const isRoot = location.pathname === '/reports' || location.pathname === '/reports/';

  if (!isRoot) {
    return (
      <div className={styles.container}>
         <Outlet />
      </div>
    );
  }

  const reportGroups = [
    {
      title: 'Relatórios Operacionais',
      description: 'Acompanhe o dia a dia da produção e estoque.',
      reports: [
        { name: 'Ordens de Serviço', path: '/reports/operational/service-orders', icon: FileText, color: '#3b82f6' },
        { name: 'Movimentação de Estoque', path: '/reports/operational/stock-movements', icon: Package, color: '#10b981' },
        { name: 'Produção por Técnico', path: '/reports/operational/production', icon: Clock, color: '#8b5cf6' },
        { name: 'Controle de Qualidade', path: '/reports/operational/quality', icon: CheckCircle2, color: '#f59e0b' },
      ]
    },
    {
      title: 'Relatórios Administrativos',
      description: 'Visão financeira e de performance do negócio.',
      reports: [
        { name: 'Fluxo de Caixa', path: '/reports/administrative/financial-flow', icon: Wallet, color: '#10b981' },
        { name: 'Contas a Receber/Pagar', path: '/reports/administrative/accounts', icon: BarChart3, color: '#3b82f6' },
        { name: 'Rentabilidade por OS', path: '/reports/administrative/profitability', icon: TrendingUp, color: '#f59e0b' },
        { name: 'Resumo de Equipe', path: '/reports/administrative/team-performance', icon: Users, color: '#8b5cf6' },
      ]
    }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Centro de Relatórios</h1>
          <p className={styles.subtitle}>Selecione uma categoria para gerar seus relatórios analíticos.</p>
        </div>
      </header>

      <div className={styles.grid}>
        {reportGroups.map((group, idx) => (
          <div key={idx} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{group.title}</h2>
              <p className={styles.sectionDesc}>{group.description}</p>
            </div>
            
            <div className={styles.reportList}>
              {group.reports.map((report, rIdx) => (
                <button 
                  key={rIdx} 
                  className={styles.reportCard}
                  onClick={() => navigate(report.path)}
                >
                  <div className={styles.iconBox} style={{ backgroundColor: `${report.color}15`, color: report.color }}>
                    <report.icon size={24} />
                  </div>
                  <div className={styles.reportInfo}>
                    <span className={styles.reportName}>{report.name}</span>
                    <span className={styles.reportAction}>Gerar agora</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsDashboard;
