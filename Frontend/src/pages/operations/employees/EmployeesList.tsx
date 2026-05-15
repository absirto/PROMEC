import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit2, Trash2, UserCheck, RefreshCcw, Briefcase, Mail } from 'lucide-react';
import SkeletonTable from '../../../components/SkeletonTable';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseList.module.css';
import Pagination from '../../../components/Pagination';

const EmployeesList: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
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
    api.get('/employees', {
      params: {
        page: currentPage,
        limit: itemsPerPage,
        search
      }
    })
      .then((res: any) => {
        setEmployees(res || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      })
      .catch(() => setError('Erro ao carregar funcionários.'))
      .finally(() => setLoading(false));
  }, [currentPage, search, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleView = (id: number) => navigate(`/employees/${id}`);
  const handleEdit = (id: number) => navigate(`/employees/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este funcionário?')) {
      api.delete(`/employees/${id}`)
        .then(() => handleRefresh())
        .catch(() => alert('Erro ao excluir funcionário.'));
    }
  };

  const filtered = employees;

  return (
    <div className={styles.listContainer}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Quadro de Funcionários</h2>
          <p className={styles.stats}>{totalItems} colaboradores ativos na organização</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar colaborador..."
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

          <Link to="/employees/new" className={styles.newBtn}>
            <Plus size={18} />
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
                    onChange={e => setSelected(e.target.checked ? filtered.map(item => item.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Colaborador / Identificação</th>
                <th>Cargo / Departamento</th>
                <th>Matrícula / Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} className={styles.tableRow}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(emp.id)}
                      onChange={() => setSelected(prev => prev.includes(emp.id) ? prev.filter(s => s !== emp.id) : [...prev, emp.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <span className={styles.primaryText}>{emp.person?.naturalPerson?.name || 'N/A'}</span>
                        <span className={styles.secondaryText}>
                          <Mail size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          {emp.person?.email || 'Sem e-mail'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div>
                      <span className={styles.primaryText}>{emp.jobRole?.name || 'N/A'}</span>
                      <span className={styles.secondaryText}>{emp.workArea?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className={styles.primaryText} style={{ fontFamily: 'monospace' }}>{emp.matricula || '-'}</span>
                      <span className={`${styles.badge} ${emp.status === 'Ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                        {emp.status}
                      </span>
                    </div>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleView(emp.id)} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Ver"><Eye size={18} /></button>
                      <button onClick={() => handleEdit(emp.id)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(emp.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir"><Trash2 size={18} /></button>
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
                  onClick={() => alert(`Ações em lote para ${selected.length} colaboradores.`)}
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

export default EmployeesList;
