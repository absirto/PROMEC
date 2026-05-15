import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, UserCog, Briefcase, Package, Wrench,
  ClipboardCheck, Tag, Settings, LogOut,
  Shield, Wallet, Database, ShoppingCart,
  LayoutDashboard, Layers, FileText, Menu, X,
  ClipboardList, BarChart3, Search, ChevronRight,
  ChevronLeft, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import styles from './MainLayout.module.css';
import { clearStoredSession } from '../../utils/authSession';
import Breadcrumbs from '../Breadcrumbs';
import CommandPalette from '../CommandPalette';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearStoredSession();
    navigate('/login');
  };

  const routeLabels: Record<string, string> = {
    '/': 'Dashboard',
    '/budgets': 'Orçamentos',
    '/service-orders': 'Ordens de Serviço',
    '/finance/service-orders': 'Ordens de Serviço Financeiras',
    '/quality-controls': 'Controle de Qualidade',
    '/stock': 'Estoque',
    '/purchases': 'Central de Compras',
    '/quotations': 'Central de Cotações',
    '/materials': 'Materiais',
    '/finance': 'Fluxo de Caixa',
    '/services-catalog': 'Catálogo de Serviços',
    '/people': 'Pessoas',
    '/employees': 'Funcionários',
    '/reports': 'Relatórios',
    '/users': 'Usuários',
    '/groups': 'Grupos de Acesso',
    '/auxiliary-tables': 'Cadastros Básicos',
    '/settings': 'Ajustes do Sistema',
    '/profile': 'Meu Perfil',
  };

  const currentPageLabel = (() => {
    const exact = routeLabels[location.pathname];
    if (exact) return exact;
    const base = '/' + location.pathname.split('/')[1];
    return routeLabels[base] || location.pathname.split('/')[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  })();

  const [expandedSections, setExpandedSections] = useState<string[]>(['Principal', 'Operacional', 'Financeiro', 'Cadastros', 'Relatórios', 'Configurações']);

  const toggleSection = (title: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      if (!expandedSections.includes(title)) {
        setExpandedSections(prev => [...prev, title]);
      }
      return;
    }
    setExpandedSections(prev => 
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const menuSections = [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard:visualizar' },
      ]
    },
    {
      title: 'Operacional',
      items: [
        { label: 'Orçamentos', to: '/budgets', icon: ClipboardList, permission: 'orcamentos:visualizar' },
        { label: 'Ordens de Serviço', to: '/service-orders', icon: Wrench, permission: 'os:visualizar' },
        { label: 'Qualidade', to: '/quality-controls', icon: ClipboardCheck, permission: 'qualidade:visualizar' },
        { label: 'Estoque', to: '/stock', icon: Package, permission: 'estoque:visualizar' },
        { label: 'Compras', to: '/purchases', icon: ShoppingCart, permission: 'estoque:visualizar' },
        { label: 'Cotações', to: '/quotations', icon: FileText, permission: 'estoque:visualizar' },
        { label: 'Materiais', to: '/materials', icon: Layers, permission: 'materiais:visualizar' },
      ]
    },
    {
      title: 'Financeiro',
      items: [
        { label: 'Fluxo de Caixa', to: '/finance', icon: Wallet, permission: 'financeiro:visualizar' },
        { label: 'Catálogo de Serviços', to: '/services-catalog', icon: Tag, permission: 'materiais:visualizar' },
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
      title: 'Relatórios',
      items: [
        { label: 'Relatórios', to: '/reports', icon: BarChart3, permission: 'relatorios:visualizar' },
      ]
    },
    {
      title: 'Configurações',
      items: [
        { label: 'Usuários', to: '/users', icon: UserCog, permission: 'usuarios:gerenciar' },
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

      <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoIcon}>
            <Wrench size={22} />
          </div>
          <span className={styles.logoText}>ProMEC</span>
          <button className={styles.collapseToggle} onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className={styles.nav}>
          {menuSections.map((section, idx) => {
            const visibleItems = section.items.filter(item => 
              item.permission === 'any' || 
              user?.role === 'admin' ||
              userPermissions.includes(item.permission) || 
              userPermissions.includes('admin')
            );

            if (visibleItems.length === 0) return null;
            const isExpanded = expandedSections.includes(section.title) && !isCollapsed;

            return (
              <div key={idx} className={`${styles.navSection} ${isExpanded ? styles.sectionExpanded : ''}`}>
                <div 
                  className={styles.sectionHeader}
                  onClick={() => toggleSection(section.title)}
                >
                  <span className={styles.sectionLabel}>{section.title}</span>
                  {!isCollapsed && (
                    <div className={styles.sectionToggle}>
                      <ChevronRight size={12} className={isExpanded ? styles.rotate90 : ''} />
                    </div>
                  )}
                </div>
                
                <div className={styles.sectionItems}>
                  {visibleItems.map(item => (
                    <NavLink 
                      key={item.to}
                      to={item.to}
                      title={isCollapsed ? item.label : undefined}
                      className={({ isActive }) => 
                        `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                      }
                    >
                      <item.icon size={20} />
                      <span className={styles.navLabel}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout} title={isCollapsed ? "Sair do Sistema" : undefined}>
            <LogOut size={20} />
            <span className={styles.navLabel}>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.topBar}>
          <div className={styles.topBarActions}>
            <button 
              className={styles.mobileMenuBtn} 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>

            <button 
              className={styles.globalSearchBtn} 
              onClick={() => (window as any).dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              title="Busca Global (Ctrl + K)"
            >
              <Search size={18} />
              <span className={styles.searchPlaceholder}>Busca Global...</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
          
          <div className={styles.topBarCenter}>
             <div className={styles.pageLabel}>{currentPageLabel}</div>
          </div>

          <div className={styles.userInfo} onClick={() => navigate('/profile')}>
            <div className={styles.userText}>
              <div className={styles.userName}>{user?.firstName} {user?.lastName}</div>
              <div className={styles.userRole}>{user?.group?.name}</div>
            </div>
            <div className={styles.userAvatar}>
              {user?.firstName?.charAt(0)}
            </div>
          </div>
        </header>

        <div className={styles.mainOutlet}>
          <div className={styles.breadWrap}>
            <Breadcrumbs />
          </div>
          {children}
        </div>
      </main>

      <CommandPalette />
    </div>
  );
};

export default MainLayout;
