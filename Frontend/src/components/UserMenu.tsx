import React from 'react';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  email: string;
  onLogout: () => void;
  onEditPassword: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ email, onLogout, onEditPassword }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={styles['user-menu-root']}>
      <button className={styles['user-menu-trigger']} onClick={() => setOpen((v) => !v)}>
        {email} <span style={{ marginLeft: 8 }}>▼</span>
      </button>
      {open && (
        <div className={styles['user-menu-dropdown']}>
          <button onClick={onEditPassword}>Editar senha</button>
          <button onClick={onLogout}>Sair</button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
