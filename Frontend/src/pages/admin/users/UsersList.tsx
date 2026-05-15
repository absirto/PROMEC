import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Search, Plus, Eye, Edit2, Trash2, ShieldCheck, Mail, RefreshCcw, ShieldAlert, UserCheck, Key } from 'lucide-react';
import SkeletonTable from '../../../components/SkeletonTable';
import api from '../../../services/api';
import commonStyles from '../../../styles/common/BaseList.module.css';
import styles from './UsersList.module.css';
import StatsCard from '../../../components/StatsCard';
import EmptyState from '../../../components/EmptyState';

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
      .then((data: any) => setUsers((Array.isArray(data) ? data : data?.data) || []))
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
    <div className={commonStyles.listContainer}>
      <header className={commonStyles.header}>
        <div className={commonStyles.headerInfo}>
          <h2 className={commonStyles.title}>Gestão de Identidade</h2>
          <p className={commonStyles.stats}>Controle de acessos e permissões do sistema</p>
        </div>

        <div className={commonStyles.controls}>
          <div className={commonStyles.searchWrapper}>
            <Search size={16} className={commonStyles.searchIcon} />
            <input
              type="text"
              className={commonStyles.searchInput}
              placeholder="Nome, e-mail ou grupo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button 
            className={`${commonStyles.refreshBtn} ${loading ? commonStyles.refreshBtnLoading : ''}`}
            onClick={handleRefresh}
            title="Sincronizar"
          >
            <RefreshCcw size={18} />
          </button>

          <Link to="/users/new" className={commonStyles.newBtn}>
            <Plus size={18} />
            <span>Novo Usuário</span>
          </Link>
        </div>
      </header>

      {/* Mini Dashboard Identidade */}
      {!loading && !error && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }} className="animate-fade-in">
          <StatsCard 
            title="Total de Usuários" 
            value={users.length} 
            icon={User} 
            color="var(--primary)"
          />
          <StatsCard 
            title="Administradores" 
            value={users.filter(u => u.role === 'admin').length} 
            icon={ShieldAlert} 
            color="#a855f7"
          />
          <StatsCard 
            title="Sessões Ativas" 
            value={users.length} 
            icon={Key} 
            color="var(--success)"
          />
          <StatsCard 
            title="Acessos Hoje" 
            value="12" 
            icon={UserCheck} 
            trend={{ value: '+15%', isPositive: true }}
            color="var(--primary)"
          />
        </section>
      )}

      {loading && <SkeletonTable columns={5} rows={8} />}

      {!loading && !error && (
        <div className="animate-fade-in">
          {filtered.length > 0 ? (
            <table className={commonStyles.tableContainer}>
              <thead className={commonStyles.tableHeader}>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={e => setSelected(e.target.checked ? filtered.map(u => u.id) : [])}
                      checked={selected.length === filtered.length && filtered.length > 0}
                    />
                  </th>
                  <th>Usuário / Acesso Principal</th>
                  <th>Permissões & Grupos</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className={commonStyles.tableRow} onClick={() => handleView(u.id)}>
                    <td className={commonStyles.tableCell} style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selected.includes(u.id)}
                        onChange={() => setSelected(prev => prev.includes(u.id) ? prev.filter(s => s !== u.id) : [...prev, u.id])}
                      />
                    </td>
                    <td className={commonStyles.tableCell}>
                      <div className={commonStyles.mainInfoCell}>
                        <div className={commonStyles.avatar}>
                          {u.firstName?.charAt(0)}
                        </div>
                        <div>
                          <span className={commonStyles.primaryText}>{u.firstName} {u.lastName}</span>
                          <span className={commonStyles.secondaryText}>
                            <Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={commonStyles.tableCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={commonStyles.primaryText}>
                          <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--primary)' }} />
                          {u.group?.name || 'Acesso Direto'}
                        </span>
                        <span className={commonStyles.secondaryText}>Role: {u.role === 'admin' ? 'Administrador' : 'Operador'}</span>
                      </div>
                    </td>
                    <td className={commonStyles.tableCell}>
                      <span className={`${commonStyles.badge} ${commonStyles.badgeActive}`}>Ativo</span>
                    </td>
                    <td className={commonStyles.tableCell} style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleView(u.id)} className={`${commonStyles.actionBtn} ${commonStyles.viewBtn}`} title="Visualizar"><Eye size={18} /></button>
                        <button onClick={() => handleEdit(u.id)} className={`${commonStyles.actionBtn} ${commonStyles.editBtn}`} title="Editar"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(u.id)} className={`${commonStyles.actionBtn} ${commonStyles.deleteBtn}`} title="Desativar"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState 
              title="Nenhum Usuário"
              description={search ? `Nenhum resultado para "${search}".` : "Sua base de usuários está vazia. Comece convidando sua equipe."}
              actionLabel="Criar Novo Usuário"
              onAction={() => navigate('/users/new')}
            />
          )}

          <div className={commonStyles.footer}>
            <div className={commonStyles.batchActions}>
              {selected.length > 0 && (
                <button 
                  className={commonStyles.actionBtn}
                  style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 700, padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)' }}
                >
                  <ShieldAlert size={14} style={{ marginRight: 6 }} />
                  Suspender Acesso ({selected.length})
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
