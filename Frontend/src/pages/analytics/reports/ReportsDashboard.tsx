import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { 
  FileText, TrendingUp, Package, Users, 
  BarChart3, Wallet, Clock, CheckCircle2,
  ChevronRight, Sparkles, PieChart, LayoutDashboard
} from 'lucide-react';
import styles from './ReportsDashboard.module.css';

const ReportsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
      title: 'Operações & Logística',
      description: 'Gestão técnica, PCP e ativos circulantes.',
      reports: [
        { name: 'Ordens de Serviço', path: '/reports/operational/service-orders', icon: FileText, color: '#3b82f6', desc: 'Analítico de OS e produtividade.' },
        { name: 'Gestão de Estoque', path: '/reports/operational/stock-movements', icon: Package, color: '#2dd4bf', desc: 'Entradas, saídas e valoração.' },
        { name: 'Eficiência de Produção', path: '/reports/operational/production', icon: Clock, color: '#a855f7', desc: 'Ocupação de centros de trabalho.' },
        { name: 'Garantia e Qualidade', path: '/reports/operational/quality', icon: CheckCircle2, color: '#f59e0b', desc: 'Não conformidades e inspeções.' },
      ]
    },
    {
      title: 'Business Intelligence',
      description: 'Análise estratégica e saúde financeira.',
      reports: [
        { name: 'Fluxo de Caixa', path: '/reports/administrative/financial-flow', icon: Wallet, color: '#2dd4bf', desc: 'DRE e movimentações reais.' },
        { name: 'Contas & Tesouraria', path: '/reports/administrative/accounts', icon: BarChart3, color: '#3b82f6', desc: 'Recebíveis e obrigações.' },
        { name: 'Margem e Lucratividade', path: '/reports/administrative/profitability', icon: TrendingUp, color: '#f59e0b', desc: 'Rentabilidade por projeto.' },
        { name: 'Performance Humana', path: '/reports/administrative/team-performance', icon: Users, color: '#a855f7', desc: 'KPIs de colaboradores.' },
      ]
    }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.badge}>
            <Sparkles size={12} /> Analytics Engine 2026
          </div>
          <h1 className={styles.title}>Centro de Inteligência ProMEC</h1>
          <p className={styles.subtitle}>Relatórios dinâmicos e exportação de dados analíticos para suporte à decisão.</p>
        </div>
        <div className={styles.headerStats}>
           <div className={styles.miniStat}>
              <LayoutDashboard size={18} />
              <span>12 Relatórios Ativos</span>
           </div>
           <div className={styles.miniStat}>
              <PieChart size={18} />
              <span>Dados em Tempo Real</span>
           </div>
        </div>
      </header>

      <div className={styles.bentoGrid}>
        {reportGroups.map((group, idx) => (
          <section key={idx} className={styles.section}>
            <div className={styles.sectionInfo}>
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
                  <div className={styles.cardHeader}>
                    <div className={styles.iconBox} style={{ backgroundColor: `${report.color}15`, color: report.color }}>
                      <report.icon size={22} />
                    </div>
                    <ChevronRight size={16} className={styles.arrow} />
                  </div>
                  <div className={styles.reportInfo}>
                    <span className={styles.reportName}>{report.name}</span>
                    <span className={styles.reportDesc}>{report.desc}</span>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.actionText}>Gerar Relatório</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default ReportsDashboard;
