import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, Plus, Edit2, Trash2, Key, RefreshCcw, Lock, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../../../services/api';
import commonStyles from '../../../styles/common/BaseList.module.css';
import premiumStyles from './GroupsList.module.css';
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
    <div className={`${commonStyles.listContainer} ${premiumStyles.listWrapper}`}>
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

          <Link to="/groups/new" className={commonStyles.newBtn} style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)' }}>
            <Plus size={18} />
            <span>Criar Perfil</span>
          </Link>
        </div>
      </header>

      {/* Mini Dashboard Segurança */}
      {!loading && !error && (
        <section className={`animate-fade-in ${premiumStyles.statsGrid}`}>
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
            color="#2dd4bf"
          />
          <StatsCard 
            title="Políticas Configuradas" 
            value={groups.filter(g => (g.permissionKeys || []).length > 0).length} 
            icon={ShieldCheck} 
            color="#34d399"
          />
          <StatsCard 
            title="Chaves Distribuídas" 
            value={new Set(groups.flatMap(g => g.permissionKeys || [])).size} 
            icon={ShieldAlert} 
            trend={{ value: 'Monitorado', isPositive: true }}
            color="#a855f7"
          />
        </section>
      )}

      {loading && <SkeletonTable columns={4} rows={5} />}

      {!loading && !error && (
        <div className="animate-fade-in">
          {filtered.length > 0 ? (
            <table className={premiumStyles.premiumTable}>
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
                  <tr key={group.id} className={premiumStyles.premiumRow} onClick={() => handleEdit(group.id)}>
                    <td className={premiumStyles.premiumCell} style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                       <input type="checkbox" />
                    </td>
                    <td className={premiumStyles.premiumCell}>
                      <div className={commonStyles.mainInfoCell}>
                        <div className={premiumStyles.securityAvatar}>
                          <Shield size={22} />
                        </div>
                        <span className={premiumStyles.groupName}>{group.name}</span>
                      </div>
                    </td>
                    <td className={premiumStyles.premiumCell}>
                      <div className={premiumStyles.permissionsWrapper}>
                        {(group.permissionKeys || []).slice(0, 4).map((key: string) => (
                          <span key={key} className={premiumStyles.premiumBadge}>
                            {key}
                          </span>
                        ))}
                        {(group.permissionKeys?.length || 0) > 4 && (
                          <span className={premiumStyles.badgeExtra}>
                            +{(group.permissionKeys?.length || 0) - 4} outras
                          </span>
                        )}
                        {(!group.permissionKeys || group.permissionKeys.length === 0) && (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Perfil sem restrições configuradas</span>
                        )}
                      </div>
                    </td>
                    <td className={premiumStyles.premiumCell} style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEdit(group.id)} className={`${premiumStyles.premiumActionBtn} ${premiumStyles.editBtn}`} title="Editar Permissões"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(group.id)} className={`${premiumStyles.premiumActionBtn} ${premiumStyles.deleteBtn}`} title="Excluir Grupo"><Trash2 size={18} /></button>
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
