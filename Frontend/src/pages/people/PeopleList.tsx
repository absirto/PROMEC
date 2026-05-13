import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, Eye, Edit2, Trash2, UserPlus, Database } from 'lucide-react';
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
  }, [currentPage, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleView = (id: number) => navigate(`/people/${id}`);
  const handleEdit = (id: number) => navigate(`/people/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
      api.delete(`/people/${id}`)
        .then(() => {
          if (people.length === 1 && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
          } else {
            setCurrentPage(prev => prev);
          }
        })
        .catch(() => alert('Erro ao excluir pessoa.'));
    }
  };

  const filtered = people; // O filtro agora é feito no backend

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Cadastros (Pessoas)</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar por nome, CPF ou CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/people/new" className={styles.newBtn}>
            <UserPlus size={20} /> Novo Cadastro
          </Link>
        </div>
      </div>

      {loading && <SkeletonTable columns={6} rows={10} />}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input 
                    type="checkbox" 
                    onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Nome / Razão Social</th>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Insc. Estadual/RG</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(p.id)}
                      onChange={() => setSelected(prev => prev.includes(p.id) ? prev.filter(s => s !== p.id) : [...prev, p.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        {p.type === 'J' ? <Database size={20} /> : <Users size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: 15 }}>{p.naturalPerson?.name || p.legalPerson?.corporateName || 'Sem Nome'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{p.contacts?.[0]?.value || 'Sem contato'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell} style={{ fontWeight: 700, fontFamily: 'Outfit' }}>{p.naturalPerson?.cpf || p.legalPerson?.cnpj || '-'}</td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${p.type === 'J' ? styles.badgeActive : styles.badgeInactive}`} style={{ 
                      background: p.type === 'J' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: p.type === 'J' ? 'var(--primary-bright)' : 'var(--accent)',
                      borderColor: p.type === 'J' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                    }}>
                      {p.type === 'J' ? 'Jurídica' : 'Física'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>{p.naturalPerson?.rg || p.legalPerson?.stateRegistration || '-'}</td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button onClick={() => handleView(p.id)} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Visualizar"><Eye size={16} /></button>
                      <button onClick={() => handleEdit(p.id)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
          />

          <div className={styles.footer}>
            <div className={styles.batchActions}>
              <button 
                className={styles.batchBtn}
                disabled={selected.length === 0}
                onClick={() => alert(`Ações em lote para ${selected.length} itens.`)}
              >
                Excluir Selecionados ({selected.length})
              </button>
            </div>
            <div className={styles.stats}>
              Total: {totalItems} registros encontrados
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PeopleList;
