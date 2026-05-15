import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, Plus, Edit2, Trash2, Key, RefreshCcw, Lock, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../../../services/api';
import commonStyles from '../../../styles/common/BaseList.module.css';
import styles from './GroupsList.module.css';
import StatsCard from '../../../components/StatsCard';
import EmptyState from '../../../components/EmptyState';
import SkeletonTable from '../../../components/SkeletonTable';

const GroupsList: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get('/groups')
      .then((data: any) => setGroups(Array.isArray(data) ? data : (data?.data || [])))
      .catch(() => setError('Erro ao carregar grupos de acesso.'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleEdit = (id: number) => navigate(`/groups/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este grupo?')) {
      api.delete(`/groups/${id}`)
        .then(() => handleRefresh())
        .catch(() => alert('Erro ao excluir grupo.'));
    }
  };

  const filtered = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={commonStyles.listContainer}>
      <header className={commonStyles.header}>
        <div className={commonStyles.headerInfo}>
          <h2 className={commonStyles.title}>Políticas de Acesso</h2>
          <p className={commonStyles.stats}>Configuração de RBAC e segurança granular</p>
        </div>

        <div className={commonStyles.controls}>
          <div className={commonStyles.searchWrapper}>
            <Search size={16} className={commonStyles.searchIcon} />
            <input
              type="text"
              className={commonStyles.searchInput}
              placeholder="Nome da política..."
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

          <Link to="/groups/new" className={commonStyles.newBtn}>
            <Plus size={18} />
            <span>Criar Perfil</span>
          </Link>
        </div>
      </header>

      {/* Mini Dashboard Segurança */}
      {!loading && !error && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }} className="animate-fade-in">
          <StatsCard 
            title="Perfis de Acesso" 
            value={groups.length} 
            icon={Shield} 
            color="#a855f7"
          />
          <StatsCard 
            title="Regras Ativas" 
            value={groups.reduce((acc, g) => acc + (g.permissionKeys?.length || 0), 0)} 
            icon={Lock} 
            color="var(--primary)"
          />
          <StatsCard 
            title="Nível de Segurança" 
            value="Alta" 
            icon={ShieldCheck} 
            color="var(--success)"
          />
          <StatsCard 
            title="Auditoria" 
            value="OK" 
            icon={ShieldAlert} 
            trend={{ value: 'Monitorado', isPositive: true }}
            color="var(--primary)"
          />
        </section>
      )}

      {loading && <SkeletonTable columns={4} rows={5} />}

      {!loading && !error && (
        <div className="animate-fade-in">
          {filtered.length > 0 ? (
            <table className={commonStyles.tableContainer}>
              <thead className={commonStyles.tableHeader}>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" disabled /></th>
                  <th>Nome do Perfil / Grupo</th>
                  <th>Permissões Associadas</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(group => (
                  <tr key={group.id} className={commonStyles.tableRow} onClick={() => handleEdit(group.id)}>
                    <td className={commonStyles.tableCell} style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                       <input type="checkbox" />
                    </td>
                    <td className={commonStyles.tableCell}>
                      <div className={commonStyles.mainInfoCell}>
                        <div className={commonStyles.avatar}>
                          <Shield size={20} />
                        </div>
                        <span className={commonStyles.primaryText}>{group.name}</span>
                      </div>
                    </td>
                    <td className={commonStyles.tableCell}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(group.permissionKeys || []).slice(0, 4).map((key: string) => (
                          <span key={key} style={{ 
                            background: 'rgba(45, 212, 191, 0.08)', 
                            padding: '4px 10px', 
                            borderRadius: 8, 
                            fontSize: 11, 
                            fontWeight: 700,
                            color: 'var(--primary)',
                            border: '1px solid rgba(45, 212, 191, 0.2)'
                          }}>
                            {key}
                          </span>
                        ))}
                        {(group.permissionKeys?.length || 0) > 4 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                            +{(group.permissionKeys?.length || 0) - 4} outras
                          </span>
                        )}
                        {(!group.permissionKeys || group.permissionKeys.length === 0) && (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Perfil sem restrições configuradas</span>
                        )}
                      </div>
                    </td>
                    <td className={commonStyles.tableCell} style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEdit(group.id)} className={`${commonStyles.actionBtn} ${commonStyles.editBtn}`} title="Editar Permissões"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(group.id)} className={`${commonStyles.actionBtn} ${commonStyles.deleteBtn}`} title="Excluir Grupo"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState 
              title="Sem Grupos de Acesso"
              description={search ? `Nenhum grupo encontrado para "${search}".` : "Não existem grupos de permissão configurados."}
              actionLabel="Criar Primeiro Perfil"
              onAction={() => navigate('/groups/new')}
            />
          )}
          
          <div className={commonStyles.footer}>
            <p className={commonStyles.stats}>{filtered.length} perfis de segurança operando no núcleo ProMEC.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsList;
