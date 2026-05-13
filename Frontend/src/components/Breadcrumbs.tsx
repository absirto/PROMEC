import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import styles from './Breadcrumbs.module.css';

const routeLabels: Record<string, string> = {
  'employees': 'Funcionários',
  'materials': 'Materiais',
  'people': 'Pessoas',
  'quality-controls': 'Qualidade',
  'service-orders': 'Ordens de Serviço',
  'budgets': 'Orçamentos',
  'services-catalog': 'Serviços',
  'users': 'Usuários',
  'groups': 'Grupos',
  'stock': 'Estoque',
  'purchases': 'Compras',
  'quotations': 'Cotações',
  'finance': 'Financeiro',
  'settings': 'Configurações',
  'auxiliary-tables': 'Cadastros',
  'reports': 'Relatórios',
  'new': 'Novo',
  'edit': 'Editar',
  'profile': 'Perfil'
};

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (location.pathname === '/') return null;

  return (
    <nav className={styles.breadcrumbs}>
      <Link to="/" className={styles.crumb}>
        <Home size={14} />
        <span>Dashboard</span>
      </Link>

      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const label = routeLabels[value] || (isNaN(Number(value)) ? value : `#${value}`);

        return (
          <React.Fragment key={to}>
            <ChevronRight size={14} className={styles.separator} />
            {last ? (
              <span className={`${styles.crumb} ${styles.active}`}>{label}</span>
            ) : (
              <Link to={to} className={styles.crumb}>
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
