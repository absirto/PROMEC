import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Briefcase, Package, Wrench,
  ClipboardCheck, Tag, Settings, LogOut,
  Shield, Wallet, Database,
  LayoutDashboard, Layers, FileText, Menu, X,
} from 'lucide-react';
import styles from './MainLayout.module.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuSections = [
        {
          title: 'Relatórios',
          items: [
            { label: 'Relatórios', to: '/reports', icon: FileText, permission: 'relatorios:visualizar' }
          ]
        },
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard:visualizar' },
      ]
    },
    {
      title: 'Operacional',
      items: [
        { label: 'Orçamentos', to: '/budgets', icon: FileText, permission: 'orcamentos:visualizar' },
        { label: 'Ordens de Serviço', to: '/service-orders', icon: Wrench, permission: 'os:visualizar' },
        { label: 'Qualidade', to: '/quality-controls', icon: ClipboardCheck, permission: 'qualidade:visualizar' },
        { label: 'Estoque', to: '/stock', icon: Package, permission: 'estoque:visualizar' },
        { label: 'Compras', to: '/purchases', icon: Wallet, permission: 'estoque:visualizar' },
        { label: 'Materiais', to: '/materials', icon: Layers, permission: 'materiais:visualizar' },
      ]
    },
    {
      title: 'Financeiro',
      items: [
        { label: 'Fluxo de Caixa', to: '/finance', icon: Wallet, permission: 'financeiro:visualizar' },
        { label: 'Catálogo de Preços', to: '/services-catalog', icon: Tag, permission: 'materiais:visualizar' },
      ]
    },
    {
      title: 'Cadastros',
      items: [
        { label: 'Pessoas', to: '/people', icon: Users, permission: 'pessoas:visualizar' },
        { label: 'Funcionários', to: '/employees', icon: Briefcase, permission: 'funcionarios:visualizar' },
      ]
    },
    {
      title: 'Configurações',
      items: [
        { label: 'Usuários', to: '/users', icon: Users, permission: 'usuarios:gerenciar' },
        { label: 'Grupos de Acesso', to: '/groups', icon: Shield, permission: 'usuarios:gerenciar' },
        { label: 'Cadastros Básicos', to: '/auxiliary-tables', icon: Database, permission: 'configuracoes:gerenciar' },
        { label: 'Ajustes do Sistema', to: '/settings', icon: Settings, permission: 'configuracoes:gerenciar' },
      ]
    }
  ];

  const userPermissions = user?.group?.permissions?.map((p: any) => 
    typeof p === 'string' ? p : (p.permission?.name || p.name)
  ) || [];

  return (
    <div className={styles.layoutContainer}>
      <div
        className={`${styles.mobileBackdrop} ${isMobileMenuOpen ? styles.mobileBackdropVisible : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoIcon}>
            <Wrench size={24} />
          </div>
          <span className={styles.logoText}>ProMEC</span>
          <button
            type="button"
            className={styles.mobileCloseBtn}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className={styles.nav} style={{ overflowY: 'auto' }}>
          {menuSections.map((section, idx) => {
            const visibleItems = section.items.filter(item => 
              item.permission === 'any' || 
              user?.role === 'admin' ||
              userPermissions.includes(item.permission) || 
              userPermissions.includes('admin')
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className={styles.navSection}>
                <div className={styles.sectionLabel}>
                  {section.title}
                </div>
                {visibleItems.map(item => (
                  <NavLink 
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => 
                      `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                    }
                  >
                    <item.icon size={18} />
                    <span style={{ fontSize: 14 }}>{item.label}</span>
                    {location.pathname === item.to && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00e6b0', marginLeft: 'auto' }} />}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>

          <div style={{ color: '#8a99a8', fontSize: 14, fontWeight: 500 }}>
            {location.pathname === '/' ? 'Dashboard' : location.pathname.split('/')[1].replace('-', ' ').toUpperCase()}
          </div>
          
          <div className={styles.userInfo} onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.firstName} {user?.lastName}</div>
              <div style={{ color: '#00e6b0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{user?.group?.name}</div>
            </div>
            <div className={styles.userAvatar}>
              {user?.firstName?.charAt(0)}
            </div>
          </div>
        </header>

        <div className={styles.mainOutlet}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
