import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, Plus, Edit2, Trash2, Key } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const GroupsList: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/groups')
      .then((data: any) => setGroups(Array.isArray(data) ? data : (data?.data || [])))
      .catch(() => setError('Erro ao carregar grupos de acesso.'))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (id: number) => navigate(`/groups/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este grupo?')) {
      api.delete(`/groups/${id}`)
        .then(() => setGroups(groups.filter(g => g.id !== id)))
        .catch(() => alert('Erro ao excluir grupo.'));
    }
  };

  const filtered = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Grupos de Permissão</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar grupo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/groups/new" className={styles.newBtn}>
            <Plus size={20} /> Novo Grupo
          </Link>
        </div>
      </div>

      {loading && <div className={styles.stats}>Buscando grupos...</div>}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input type="checkbox" />
                </th>
                <th>Nome do Grupo</th>
                <th>Permissões Ativas</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(group => (
                <tr key={group.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input type="checkbox" />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <Shield size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{group.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {group.permissionKeys?.map((key: string) => (
                        <span key={key} style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#00e6b0' }}>
                          <Key size={10} style={{ marginRight: 4 }} /> {key}
                        </span>
                      ))}
                      {(!group.permissionKeys || group.permissionKeys.length === 0) && (
                        <span style={{ fontSize: 13, color: '#8a99a8' }}>Nenhuma permissão</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleEdit(group.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(group.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.stats}>
              {filtered.length} grupos configurados no sistema
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GroupsList;
