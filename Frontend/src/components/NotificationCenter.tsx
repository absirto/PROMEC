import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, ExternalLink, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { useNotifications, Notification } from '../hooks/useNotifications';
import styles from './NotificationCenter.module.css';
import { useNavigate } from 'react-router-dom';

const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'WARNING': return <AlertTriangle size={18} className={styles.warningIcon} />;
      case 'ERROR': return <XCircle size={18} className={styles.errorIcon} />;
      case 'SUCCESS': return <CheckCircle2 size={18} className={styles.successIcon} />;
      default: return <Info size={18} className={styles.infoIcon} />;
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      setIsOpen(false);
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={`${styles.bellBtn} ${unreadCount > 0 ? styles.hasUnread : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3>Notificações</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className={styles.clearBtn}>
                <Check size={14} /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={32} />
                <p>Nenhuma notificação por enquanto.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`${styles.item} ${!n.read ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={styles.itemIcon}>{getIcon(n.type)}</div>
                  <div className={styles.itemBody}>
                    <div className={styles.itemTitle}>{n.title}</div>
                    <div className={styles.itemMessage}>{n.message}</div>
                    <div className={styles.itemMeta}>
                      {new Date(n.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {n.link && <ExternalLink size={14} className={styles.linkIcon} />}
                </div>
              ))
            )}
          </div>
          
          <div className={styles.footer}>
            Ver todas as atividades
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
