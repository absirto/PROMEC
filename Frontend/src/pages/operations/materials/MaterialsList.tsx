import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Plus, Eye, Edit2, Trash2, LayoutGrid, List, RefreshCcw, Tag, Coins, Database, AlertCircle, TrendingUp, ShoppingBag } from 'lucide-react';
import SkeletonTable from '../../../components/SkeletonTable';
import api from '../../../services/api';
import commonStyles from '../../../styles/common/BaseList.module.css';
import styles from './MaterialsList.module.css';
import Pagination from '../../../components/Pagination';
import EmptyState from '../../../components/EmptyState';
import StatsCard from '../../../components/StatsCard';

const MaterialsList: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [currentPage, search, refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleView = (id: number) => navigate(`/materials/${id}`);
  const handleEdit = (id: number) => navigate(`/materials/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este material?')) {
      api.delete(`/materials/${id}`)
        .then(() => handleRefresh())
        .catch(() => alert('Erro ao excluir material.'));
    }
  };

  return (
    <div className={commonStyles.listContainer}>
      <header className={commonStyles.header}>
        <div className={commonStyles.headerInfo}>
          <h2 className={commonStyles.title}>Almoxarifado & Insumos</h2>
          <p className={commonStyles.stats}>Controle técnico e valorização do estoque ProMEC</p>
        </div>

        <div className={commonStyles.controls}>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('table')}
              title="Visualização em Lista"
            >
              <List size={18} />
            </button>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              title="Visualização em Grade"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          
          <div className={commonStyles.searchWrapper}>
            <Search size={16} className={commonStyles.searchIcon} />
            <input
              type="text"
              className={commonStyles.searchInput}
              placeholder="Nome ou descrição técnica..."
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

          <button onClick={() => navigate('/materials/new')} className={commonStyles.newBtn}>
            <Plus size={18} />
            <span>Adicionar Item</span>
          </button>
        </div>
      </header>

      {/* Mini Dashboard Insumos */}
      {!loading && !error && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }} className="animate-fade-in">
          <StatsCard 
            title="Itens no Catálogo" 
            value={totalItems} 
            icon={Package} 
            color="#3b82f6"
          />
          <StatsCard 
            title="Estoque Crítico" 
            value="3" 
            icon={AlertCircle} 
            trend={{ value: 'Atenção', isPositive: false }}
            color="var(--danger)"
          />
          <StatsCard 
            title="Novas Entradas" 
            value="14" 
            icon={ShoppingBag} 
            color="var(--primary)"
          />
          <StatsCard 
            title="Valor Total" 
            value="R$ 12.4k" 
            icon={Coins} 
            trend={{ value: '+4%', isPositive: true }}
            color="var(--success)"
          />
        </section>
      )}

      {loading && (
        viewMode === 'table' ? 
        <SkeletonTable columns={5} rows={8} /> : 
        <div className={styles.materialsGrid}>
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={styles.skeletonCard} />)}
        </div>
      )}

      {!loading && !error && (
        <div className="animate-fade-in">
          {materials.length > 0 ? (
            viewMode === 'table' ? (
              <table className={commonStyles.tableContainer}>
                <thead className={commonStyles.tableHeader}>
                  <tr>
                    <th>Material / Especificação</th>
                    <th>Unidade / Preço</th>
                    <th>Status Operacional</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id} className={commonStyles.tableRow} onClick={() => handleView(m.id)}>
                      <td className={commonStyles.tableCell}>
                        <div className={commonStyles.mainInfoCell}>
                          <div className={commonStyles.avatar}>
                            <Package size={20} />
                          </div>
                          <div>
                            <span className={commonStyles.primaryText}>{m.name}</span>
                            <span className={commonStyles.secondaryText}>{m.description || 'Sem descrição técnica'}</span>
                          </div>
                        </div>
                      </td>
                      <td className={commonStyles.tableCell}>
                        <div>
                          <span className={commonStyles.primaryText} style={{ color: 'var(--primary)' }}>
                            R$ {Number(m.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={commonStyles.secondaryText}>por {m.unit}</span>
                        </div>
                      </td>
                      <td className={commonStyles.tableCell}>
                        <span className={`${commonStyles.badge} ${m.active !== false ? commonStyles.badgeActive : commonStyles.badgeInactive}`}>
                          {m.active !== false ? 'Em Linha' : 'Desativado'}
                        </span>
                      </td>
                      <td className={commonStyles.tableCell} style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={(e) => { e.stopPropagation(); handleView(m.id); }} className={`${commonStyles.actionBtn} ${commonStyles.viewBtn}`} title="Visualizar"><Eye size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(m.id); }} className={`${commonStyles.actionBtn} ${commonStyles.editBtn}`} title="Editar"><Edit2 size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className={`${commonStyles.actionBtn} ${commonStyles.deleteBtn}`} title="Excluir"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.materialsGrid}>
                {materials.map(m => (
                  <div key={m.id} className={styles.materialCard} onClick={() => handleView(m.id)}>
                    <div className={styles.cardHeader}>
                      <div className={styles.imagePlaceholder}>
                        <Package size={24} />
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
                        <span>{m.unit}</span>
                        <span style={{ color: m.active !== false ? 'var(--primary)' : 'var(--danger)' }}>
                          {m.active !== false ? 'Disponível' : 'Indisponível'}
                        </span>
                      </div>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill} 
                          style={{ 
                            width: m.active !== false ? '100%' : '0%', 
                            background: m.active !== false ? 'var(--primary)' : 'var(--danger)',
                            boxShadow: m.active !== false ? '0 0 10px var(--primary-glow)' : 'none'
                          }} 
                        />
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button onClick={(e) => { e.stopPropagation(); handleView(m.id); }} className={styles.actionBtn}>
                        <Eye size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(m.id); }} className={styles.actionBtn}>
                        <Edit2 size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <EmptyState 
              title="Catálogo Vazio"
              description={search ? `Nenhum material encontrado para "${search}".` : "Ainda não existem materiais cadastrados no almoxarifado."}
              actionLabel="Cadastrar Material"
              onAction={() => navigate('/materials/new')}
            />
          )}

          <div className={commonStyles.footer}>
            <div className={commonStyles.batchActions}></div>
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

export default MaterialsList;
