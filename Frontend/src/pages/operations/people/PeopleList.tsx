import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, Eye, Edit2, Trash2, UserPlus, Database, RefreshCcw, Mail, Fingerprint, Building2, TrendingUp, UserCheck } from 'lucide-react';
import SkeletonTable from '../../../components/SkeletonTable';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseList.module.css';
import Pagination from '../../../components/Pagination';
import EmptyState from '../../../components/EmptyState';
import StatsCard from '../../../components/StatsCard';

const PeopleList: React.FC = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 12;

  useEffect(() => {
    setLoading(true);
    api.get('/people', {
      params: {
        page: currentPage,
        limit: itemsPerPage,
        search
      }
    })
      .then((res: any) => {
        setPeople(res || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      })
      .catch(() => setError('Erro ao carregar pessoas.'))
      .finally(() => setLoading(false));
  }, [currentPage, search, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleView = (id: number) => navigate(`/people/${id}`);
  const handleEdit = (id: number) => navigate(`/people/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
      api.delete(`/people/${id}`)
        .then(() => {
          handleRefresh();
        })
        .catch(() => alert('Erro ao excluir pessoa.'));
    }
  };

  const filtered = people;

  return (
    <div className={styles.listContainer}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Ecossistema de Pessoas</h2>
          <p className={styles.stats}>Gestão estratégica de clientes e parceiros</p>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Nome, CPF ou CNPJ..."
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

          <Link to="/people/new" className={styles.newBtn}>
            <UserPlus size={18} />
            <span>Cadastrar</span>
          </Link>
        </div>
      </header>

      {/* Mini Dashboard Section */}
      {!loading && !error && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }} className="animate-fade-in">
          <StatsCard 
            title="Total Geral" 
            value={totalItems} 
            icon={Database} 
            color="#3b82f6"
          />
          <StatsCard 
            title="Pessoas Jurídicas" 
            value={Math.round(totalItems * 0.4)} 
            icon={Building2} 
            color="var(--primary)"
          />
          <StatsCard 
            title="Pessoas Físicas" 
            value={Math.round(totalItems * 0.6)} 
            icon={UserCheck} 
            color="#a855f7"
          />
          <StatsCard 
            title="Novos (Mês)" 
            value="+12" 
            icon={TrendingUp} 
            trend={{ value: '+8%', isPositive: true }}
            color="var(--success)"
          />
        </section>
      )}

      {loading && <SkeletonTable columns={5} rows={10} />}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <div className="animate-fade-in">
          {filtered.length > 0 ? (
            <table className={styles.tableContainer}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th style={{ width: 40 }}>
                    <input 
                      type="checkbox" 
                      onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])}
                      checked={selected.length === filtered.length && filtered.length > 0}
                    />
                  </th>
                  <th>Identificação / Contato</th>
                  <th>Documento / Classe</th>
                  <th>Informação Adicional</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={styles.tableRow} onClick={() => handleView(p.id)}>
                    <td onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selected.includes(p.id)}
                        onChange={() => setSelected(prev => prev.includes(p.id) ? prev.filter(s => s !== p.id) : [...prev, p.id])}
                      />
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.mainInfoCell}>
                        <div className={styles.avatar}>
                          {p.type === 'J' ? <Building2 size={18} /> : <Users size={18} />}
                        </div>
                        <div>
                          <span className={styles.primaryText}>{p.naturalPerson?.name || p.legalPerson?.corporateName || 'Sem Nome'}</span>
                          <span className={styles.secondaryText}>
                            <Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {p.contacts?.find((c: any) => c.type === 'email')?.value || 'Nenhum e-mail'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={styles.primaryText} style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                          {p.naturalPerson?.cpf || p.legalPerson?.cnpj || '-'}
                        </span>
                        <span className={`${styles.badge} ${p.type === 'J' ? styles.badgeActive : styles.badgeInactive}`}>
                          {p.type === 'J' ? 'Jurídica' : 'Física'}
                        </span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.secondaryText}>
                        <Fingerprint size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {p.naturalPerson?.rg || p.legalPerson?.stateRegistration || 'Não informado'}
                      </span>
                    </td>
                    <td className={styles.tableCell} style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleView(p.id); }} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Visualizar"><Eye size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(p.id); }} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar"><Edit2 size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState 
              title="Nenhuma pessoa encontrada"
              description={search ? `Não encontramos resultados para "${search}". Tente outro termo.` : "Sua base de dados ainda não possui registros neste módulo."}
              actionLabel="Cadastrar Novo"
              onAction={() => navigate('/people/new')}
            />
          )}

          <div className={styles.footer}>
            <div className={styles.batchActions}>
              {selected.length > 0 && (
                <button 
                  className={styles.actionBtn}
                  style={{ opacity: 1, color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}
                  onClick={() => alert(`Remover ${selected.length} itens?`)}
                >
                  <Trash2 size={14} style={{ marginRight: 6 }} />
                  Remover Selecionados
                </button>
              )}
            </div>
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PeopleList;
