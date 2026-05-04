import { LogOut } from 'lucide-react';
import React from 'react';
import styles from './SidebarLogoutButton.module.css';

interface SidebarLogoutButtonProps {
  onLogout: () => void;
  iconOnly?: boolean;
}

const SidebarLogoutButton: React.FC<SidebarLogoutButtonProps> = ({ onLogout, iconOnly }) => (
  <button
    className={styles['sidebar-logout']}
    onClick={onLogout}
    title="Sair"
    aria-label="Sair"
    style={iconOnly ? { justifyContent: 'center', padding: '10px 12px' } : {}}
  >
    <LogOut size={22} />
    {!iconOnly && <span style={{ marginLeft: 8 }}>Sair</span>}
  </button>
);

export default SidebarLogoutButton;
