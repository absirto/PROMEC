import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit2, Trash2, UserCheck } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const EmployeesList: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get('/employees')
      .then((data: any) => setEmployees(Array.isArray(data) ? data : (data?.data || [])))
      .catch(() => setError('Erro ao carregar funcionários.'))
      .finally(() => setLoading(false));
  }, []);

  const handleView = (id: number) => navigate(`/employees/${id}`);
  const handleEdit = (id: number) => navigate(`/employees/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este funcionário?')) {
      api.delete(`/employees/${id}`)
        .then(() => setEmployees(employees.filter(e => e.id !== id)))
        .catch(() => alert('Erro ao excluir funcionário.'));
    }
  };

  const filtered = employees.filter(emp => {
    const name = emp.person?.naturalPerson?.name || '';
    const role = emp.jobRole?.name || '';
    return name.toLowerCase().includes(search.toLowerCase()) || 
           role.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Funcionários</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar funcionário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/employees/new" className={styles.newBtn}>
            <Plus size={20} /> Novo Funcionário
          </Link>
        </div>
      </div>

      {loading && <div className={styles.stats}>Carregando funcionários...</div>}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input 
                    type="checkbox" 
                    onChange={e => setSelected(e.target.checked ? filtered.map(item => item.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Funcionário</th>
                <th>Cargo / Área</th>
                <th>Matrícula</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(emp.id)}
                      onChange={() => setSelected(prev => prev.includes(emp.id) ? prev.filter(s => s !== emp.id) : [...prev, emp.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{emp.person?.naturalPerson?.name || 'N/A'}</div>
                        <div style={{ fontSize: 13, color: '#8a99a8' }}>{emp.person?.email || 'Sem e-mail'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ fontWeight: 500 }}>{emp.jobRole?.name || 'N/A'}</div>
                    <div style={{ fontSize: 13, color: '#8a99a8' }}>{emp.workArea?.name || 'N/A'}</div>
                  </td>
                  <td className={styles.tableCell}>{emp.matricula || '-'}</td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${emp.status === 'Ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleView(emp.id)} className={`${styles.actionBtn} ${styles.viewBtn}`}><Eye size={16} /></button>
                      <button onClick={() => handleEdit(emp.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(emp.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.batchActions}>
              <button className={styles.batchBtn} disabled={selected.length === 0}>
                Excluir Selecionados ({selected.length})
              </button>
            </div>
            <div className={styles.stats}>
              {filtered.length} funcionários encontrados
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeesList;
