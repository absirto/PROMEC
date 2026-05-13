import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Plus, Eye, Edit2, Trash2, LayoutGrid, List } from 'lucide-react';
import SkeletonTable from '../../components/SkeletonTable';
import api from '../../services/api';
import commonStyles from '../../styles/common/BaseList.module.css';
import styles from './MaterialsList.module.css';
import Pagination from '../../components/Pagination';

const MaterialsList: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 12;

  useEffect(() => {
    setLoading(true);
    api.get('/materials', {
      params: { page: currentPage, limit: itemsPerPage, search }
    })
      .then((res: any) => {
        setMaterials(res || []);
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
        .then(() => setCurrentPage(prev => prev))
        .catch(() => alert('Erro ao excluir material.'));
    }
  };

  return (
    <div className={commonStyles.listContainer}>
      <div className={commonStyles.header}>
        <h2 className={commonStyles.title}>Almoxarifado</h2>
        <div className={commonStyles.controls}>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List size={18} />
            </button>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 18, color: '#64748b' }} />
            <input
              type="text"
              className={commonStyles.searchInput}
              placeholder="Buscar item..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 44 }}
            />
          </div>
          
          <button onClick={() => navigate('/materials/new')} className={commonStyles.newBtn}>
            <Plus size={20} /> Adicionar Item
          </button>
        </div>
      </div>

      {loading && (
        viewMode === 'table' ? 
        <SkeletonTable columns={5} rows={8} /> : 
        <div className={styles.materialsGrid}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 380, borderRadius: 32, background: 'rgba(255,255,255,0.02)' }} className="skeleton-pulse" />)}
        </div>
      )}

      {!loading && !error && (
        <>
          {viewMode === 'table' ? (
            <table className={commonStyles.tableContainer}>
              <thead className={commonStyles.tableHeader}>
                <tr>
                  <th>Material</th>
                  <th>Unidade</th>
                  <th>Preço Base</th>
                  <th>Disponibilidade</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className={commonStyles.tableRow}>
                    <td className={commonStyles.tableCell}>
                      <div className={commonStyles.mainInfoCell} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className={commonStyles.avatar}>
                          <Package size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.description || 'Sem descrição técnica'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={commonStyles.tableCell}>{m.unit}</td>
                    <td className={commonStyles.tableCell}>
                      <span style={{ fontWeight: 800, color: 'var(--accent)' }}>
                        R$ {Number(m.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className={commonStyles.tableCell}>
                      <span className={`${commonStyles.badge} ${m.active !== false ? commonStyles.badgeActive : commonStyles.badgeInactive}`}>
                        {m.active !== false ? 'Ativo' : 'Indisponível'}
                      </span>
                    </td>
                    <td className={commonStyles.tableCell} style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button onClick={() => handleView(m.id)} className={`${commonStyles.actionBtn} ${commonStyles.viewBtn}`} title="Visualizar"><Eye size={16} /></button>
                        <button onClick={() => handleEdit(m.id)} className={`${commonStyles.actionBtn} ${commonStyles.editBtn}`} title="Editar"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(m.id)} className={`${commonStyles.actionBtn} ${commonStyles.deleteBtn}`} title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.materialsGrid}>
              {materials.map(m => (
                <div key={m.id} className={styles.materialCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.imagePlaceholder}>
                      <Package size={32} />
                    </div>
                    <div className={styles.priceTag}>
                      R$ {Number(m.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className={styles.materialInfo}>
                    <div className={styles.materialName}>{m.name}</div>
                    <div className={styles.materialDesc}>{m.description || 'Nenhuma especificação técnica fornecida para este item.'}</div>
                  </div>

                  <div className={styles.stockSection}>
                    <div className={styles.stockLabel}>
                      <span>Nível de Disponibilidade</span>
                      <span style={{ color: m.active !== false ? 'var(--success)' : 'var(--danger)' }}>
                        {m.active !== false ? 'Operacional' : 'Indisponível'}
                      </span>
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill} 
                        style={{ 
                          width: m.active !== false ? '85%' : '0%', 
                          background: m.active !== false ? 'linear-gradient(90deg, var(--primary), var(--success))' : 'var(--danger)',
                          boxShadow: m.active !== false ? '0 0 10px var(--primary-glow)' : 'none'
                        }} 
                      />
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button onClick={() => handleView(m.id)} className={styles.actionBtn} title="Ver Detalhes">
                      <Eye size={16} /> Detalhes
                    </button>
                    <button onClick={() => handleEdit(m.id)} className={styles.actionBtn} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 48 }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
            />
          </div>

          <div className={commonStyles.footer}>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
              Exibindo <span style={{ color: '#fff' }}>{materials.length}</span> de <span style={{ color: '#fff' }}>{totalItems}</span> itens catalogados
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MaterialsList;
