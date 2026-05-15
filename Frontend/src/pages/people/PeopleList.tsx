import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, Eye, Edit2, Trash2, UserPlus, Database, RefreshCcw, Mail, Fingerprint, Building2 } from 'lucide-react';
import SkeletonTable from '../../components/SkeletonTable';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import Pagination from '../../components/Pagination';

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
          <h2 className={styles.title}>Diretório de Pessoas</h2>
          <p className={styles.stats}>{totalItems} contatos cadastrados no sistema</p>
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
            <span>Novo</span>
          </Link>
        </div>
      </header>

      {loading && <SkeletonTable columns={5} rows={10} />}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <div className="animate-fade-in">
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
                <tr key={p.id} className={styles.tableRow}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(p.id)}
                      onChange={() => setSelected(prev => prev.includes(p.id) ? prev.filter(s => s !== p.id) : [...prev, p.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        {p.type === 'J' ? <Building2 size={20} /> : <Users size={20} />}
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
                      <button onClick={() => handleView(p.id)} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Visualizar"><Eye size={18} /></button>
                      <button onClick={() => handleEdit(p.id)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(p.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir"><Trash2 size={18} /></button>
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
