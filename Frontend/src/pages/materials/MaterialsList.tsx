import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Search, Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import Pagination from '../../components/Pagination';

const MaterialsList: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
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
    api.get('/materials', {
      params: {
        page: currentPage,
        limit: itemsPerPage,
        search
      }
    })
      .then((res: any) => {
        setMaterials(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      })
      .catch(() => setError('Erro ao carregar materiais.'))
      .finally(() => setLoading(false));
  }, [currentPage, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleView = (id: number) => navigate(`/materials/${id}`);
  const handleEdit = (id: number) => navigate(`/materials/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este material?')) {
      api.delete(`/materials/${id}`)
        .then(() => {
          if (materials.length === 1 && currentPage > 1) {
            setCurrentPage(prev => prev - 1);
          } else {
            // Recarregar a página atual
            setCurrentPage(prev => prev);
          }
        })
        .catch(() => alert('Erro ao excluir material.'));
    }
  };

  const handleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const filtered = materials; // O filtro agora é feito no backend

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Materiais</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/materials/new" className={styles.newBtn}>
            <Plus size={20} /> Novo Material
          </Link>
        </div>
      </div>

      {loading && <div className={styles.stats}>Carregando materiais...</div>}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input 
                    type="checkbox" 
                    onChange={e => setSelected(e.target.checked ? filtered.map(m => m.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Material</th>
                <th>Unidade</th>
                <th>Preço</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(m.id)}
                      onChange={() => handleSelect(m.id)}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <Package size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 13, color: '#8a99a8' }}>{m.description || 'Sem descrição'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>{m.unit}</td>
                  <td className={styles.tableCell}>R$ {m.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${m.active !== false ? styles.badgeActive : styles.badgeInactive}`}>
                      {m.active !== false ? 'Em Estoque' : 'Indisponível'}
                    </span>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleView(m.id)} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Visualizar"><Eye size={16} /></button>
                      <button onClick={() => handleEdit(m.id)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(m.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir"><Trash2 size={16} /></button>
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
                onClick={() => alert('Ação em lote não implementada')}
              >
                Excluir Selecionados ({selected.length})
              </button>
            </div>
            <div className={styles.stats}>
              Total: {totalItems} materiais
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MaterialsList;
