import React, { useEffect, useState } from 'react';
import { History, User, Clock, FileEdit, PlusCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import styles from './AuditTimeline.module.css';

interface AuditLog {
  id: number;
  entity: string;
  entityId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId?: number;
  userEmail?: string;
  oldData: any;
  newData: any;
  createdAt: string;
}

interface AuditTimelineProps {
  entity: string;
  entityId: number;
}

const AuditTimeline: React.FC<AuditTimelineProps> = ({ entity, entityId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get(`/audit/${entity}/${entityId}`);
        // O interceptor do api.ts já retorna .data (ou o próprio objeto com .data como property)
        setLogs(Array.isArray(response) ? response : response?.data || []);
      } catch (error) {
        console.error('Erro ao buscar logs de auditoria:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [entity, entityId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <PlusCircle size={16} className={styles.createIcon} />;
      case 'UPDATE': return <FileEdit size={16} className={styles.updateIcon} />;
      case 'DELETE': return <Trash2 size={16} className={styles.deleteIcon} />;
      default: return <History size={16} />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE': return 'Criação';
      case 'UPDATE': return 'Alteração';
      case 'DELETE': return 'Exclusão';
      default: return action;
    }
  };

  if (loading) return <div className={styles.loading}>Carregando histórico...</div>;
  if (logs.length === 0) return <div className={styles.empty}>Nenhuma alteração registrada.</div>;

  return (
    <div className={styles.timelineContainer}>
      <h3 className={styles.title}><History size={18} /> Histórico de Alterações</h3>
      <div className={styles.list}>
        {logs.map((log) => (
          <div key={log.id} className={styles.item}>
            <div className={styles.marker}>
              <div className={styles.iconCircle}>{getActionIcon(log.action)}</div>
              <div className={styles.line} />
            </div>
            <div className={styles.content}>
              <div className={styles.header} onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                <div className={styles.mainInfo}>
                  <span className={styles.actionLabel}>{getActionLabel(log.action)}</span>
                  <span className={styles.user}>
                    <User size={12} /> {log.userEmail || 'Sistema'}
                  </span>
                  <span className={styles.date}>
                    <Clock size={12} /> {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                {log.action === 'UPDATE' && (
                  <button className={styles.expandBtn}>
                    {expandedId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>

              {expandedId === log.id && log.action === 'UPDATE' && (
                <div className={styles.details}>
                  <table className={styles.diffTable}>
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Anterior</th>
                        <th>Novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(log.newData || {}).map(key => {
                        const oldVal = log.oldData?.[key];
                        const newVal = log.newData?.[key];
                        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                        
                        return (
                          <tr key={key}>
                            <td className={styles.fieldName}>{key}</td>
                            <td className={styles.oldVal}>{String(oldVal || '-')}</td>
                            <td className={styles.newVal}>{String(newVal || '-')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditTimeline;
