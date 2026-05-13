import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Search, Plus, Eye, Edit2, Trash2, ShieldCheck, Mail } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const UsersList: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get('/users')
      .then((data: any) => setUsers(Array.isArray(data) ? data : (data?.data || [])))
      .catch(() => setError('Erro ao carregar usuários.'))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (id: number) => navigate(`/users/${id}/edit`);
  const handleView = (id: number) => navigate(`/users/${id}`);
  const handleDelete = (id: number) => {
    if (window.confirm('Excluir este usuário?')) {
      api.delete(`/users/${id}`)
        .then(() => setUsers(users.filter(u => u.id !== id)))
        .catch(() => alert('Erro ao excluir usuário.'));
    }
  };

  const filtered = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Usuários do Sistema</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/users/new" className={styles.newBtn}>
            <Plus size={20} /> Novo Usuário
          </Link>
        </div>
      </div>

      {loading && <div className={styles.stats}>Buscando usuários...</div>}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input 
                    type="checkbox" 
                    onChange={e => setSelected(e.target.checked ? filtered.map(u => u.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Grupo de Acesso</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(u.id)}
                      onChange={() => setSelected(prev => prev.includes(u.id) ? prev.filter(s => s !== u.id) : [...prev, u.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <User size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={14} color="#8a99a8" />
                      {u.email}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={14} color="#00e6b0" />
                      {u.group?.name || 'Sem grupo'}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Ativo</span>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleView(u.id)} className={`${styles.actionBtn} ${styles.viewBtn}`}><Eye size={16} /></button>
                      <button onClick={() => handleEdit(u.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(u.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.batchActions}>
              <button className={styles.batchBtn} disabled={selected.length === 0}>
                Desativar Selecionados ({selected.length})
              </button>
            </div>
            <div className={styles.stats}>
              {filtered.length} usuários registrados
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UsersList;
