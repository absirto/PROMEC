import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Search, Plus, Eye, Edit2, Trash2, ShieldCheck, Mail, RefreshCcw } from 'lucide-react';
import SkeletonTable from '../../components/SkeletonTable';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const UsersList: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get('/users')
      .then((data: any) => setUsers(data))
      .catch(() => setError('Erro ao carregar usuários.'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleEdit = (id: number) => navigate(`/users/${id}/edit`);
  const handleView = (id: number) => navigate(`/users/${id}`);
  const handleDelete = (id: number) => {
    if (window.confirm('Excluir este usuário?')) {
      api.delete(`/users/${id}`)
        .then(() => handleRefresh())
        .catch(() => alert('Erro ao excluir usuário.'));
    }
  };

  const filtered = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.listContainer}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Gestão de Identidade</h2>
          <p className={styles.stats}>{filtered.length} usuários com acesso ao ecossistema</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button 
            className={`${styles.refreshBtn} ${loading ? styles.refreshBtnLoading : ''}`}
            onClick={handleRefresh}
            title="Atualizar"
          >
            <RefreshCcw size={18} />
          </button>

          <Link to="/users/new" className={styles.newBtn}>
            <Plus size={18} />
            <span>Novo Usuário</span>
          </Link>
        </div>
      </header>

      {loading && <SkeletonTable columns={5} rows={5} />}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <div className="animate-fade-in">
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40 }}>
                  <input 
                    type="checkbox" 
                    onChange={e => setSelected(e.target.checked ? filtered.map(u => u.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Usuário / Acesso</th>
                <th>Permissões / Grupo</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={styles.tableRow}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(u.id)}
                      onChange={() => setSelected(prev => prev.includes(u.id) ? prev.filter(s => s !== u.id) : [...prev, u.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <User size={18} />
                      </div>
                      <div>
                        <span className={styles.primaryText}>{u.firstName} {u.lastName}</span>
                        <span className={styles.secondaryText}>
                          <Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div>
                      <span className={styles.primaryText}>
                        <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--primary)' }} />
                        {u.group?.name || 'Acesso Restrito'}
                      </span>
                      <span className={styles.secondaryText}>Nível de acesso operacional</span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Ativo</span>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleView(u.id)} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Ver"><Eye size={18} /></button>
                      <button onClick={() => handleEdit(u.id)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(u.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Remover"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.batchActions}>
              {selected.length > 0 && (
                <button 
                  className={styles.actionBtn}
                  style={{ opacity: 1, color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}
                >
                  <Trash2 size={14} style={{ marginRight: 6 }} />
                  Desativar Selecionados ({selected.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;
