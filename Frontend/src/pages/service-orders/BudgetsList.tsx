import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit2, Calendar, Filter, X, RefreshCcw } from 'lucide-react';
import SkeletonTable from '../../components/SkeletonTable';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const BudgetsList: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Check permissions for financial data
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userPermissions = user?.group?.permissions || [];
  const hasFinanceAccess = user?.role === 'admin' || userPermissions.includes('financeiro:visualizar');

  // Filtros
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/service-orders')
      .then((data: any) => {
        setOrders(data.filter((o: any) => o.status === 'Orçamento'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleView = (id: number) => navigate(`/service-orders/${id}`);
  const handleEdit = (id: number) => navigate(`/service-orders/${id}/edit`);

  const filtered = orders.filter(order => {
    const matchSearch = (order.person?.naturalPerson?.name?.toLowerCase().includes(search.toLowerCase()) || 
                       order.person?.legalPerson?.corporateName?.toLowerCase().includes(search.toLowerCase()) ||
                       order.description?.toLowerCase().includes(search.toLowerCase()));
    
    // Filtro por data
    const orderDate = new Date(order.openingDate).getTime();
    const matchStart = !startDate || orderDate >= new Date(startDate).getTime();
    const matchEnd = !endDate || orderDate <= new Date(endDate).getTime();

    return matchSearch && matchStart && matchEnd;
  });

  const calculateBudgetTotal = (order: any) => {
    const matTotal = (order.materials || []).reduce((acc: number, m: any) => acc + (m.totalPrice || 0), 0);
    const svcTotal = (order.services || []).reduce((acc: number, s: any) => acc + (s.totalPrice || 0), 0);
    const subtotal = matTotal + svcTotal;
    
    const profitAmount = subtotal * ((order.profitPercent || 0) / 100);
    const baseForTax = subtotal + profitAmount;
    const taxAmount = baseForTax * ((order.taxPercent || 0) / 100);
    
    return baseForTax + taxAmount;
  };

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className={styles.title}>Painel de Orçamentos</h2>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              background: showFilters ? 'rgba(0, 230, 176, 0.1)' : 'rgba(255,255,255,0.02)',
              color: showFilters ? '#00e6b0' : '#8a99a8',
              border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700
            }}
          >
            <Filter size={18} /> Filtros {filtered.length !== orders.length && '(Ativos)'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/service-orders/new" className={styles.newBtn}>
            <Plus size={20} /> Novo Orçamento
          </Link>
          <button 
            className={`${styles.refreshBtn} ${loading ? styles.refreshBtnLoading : ''}`}
            onClick={handleRefresh}
            title="Atualizar Lista"
          >
            <RefreshCcw size={20} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16, 
          marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16,
          animation: 'slideInDown 0.3s ease-out', border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div>
            <label style={{ fontSize: 12, color: '#8a99a8', display: 'block', marginBottom: 6 }}>Pesquisar</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#5c6b7a' }} />
              <input 
                className={styles.searchInput} 
                style={{ fontSize: 13, paddingLeft: 32, width: '100%', height: 38 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cliente ou descrição..."
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8a99a8', display: 'block', marginBottom: 6 }}>De</label>
            <input type="date" className={styles.searchInput} style={{ height: 38, width: '100%', padding: '0 10px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8a99a8', display: 'block', marginBottom: 6 }}>Até</label>
            <input type="date" className={styles.searchInput} style={{ height: 38, width: '100%', padding: '0 10px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={clearFilters} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Limpar
            </button>
          </div>
        </div>
      )}

      {loading && <SkeletonTable columns={7} rows={6} />}
      
      {!loading && (
        <table className={styles.tableContainer}>
          <thead className={styles.tableHeader}>
            <tr>
              <th style={{ paddingLeft: 20 }}>Ref #</th>
              <th>Cliente</th>
              <th>Data Emissão</th>
              {hasFinanceAccess && <th style={{ textAlign: 'right' }}>Valor Estimado</th>}
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id} className={styles.tableRow}>
                <td style={{ paddingLeft: 20, fontWeight: 700 }}>#{order.id}</td>
                <td className={styles.tableCell}>
                  <div style={{ fontWeight: 600 }}>{order.person?.naturalPerson?.name || order.person?.legalPerson?.corporateName || 'N/A'}</div>
                  <div style={{ fontSize: 12, color: '#8a99a8' }}>{order.description.substring(0, 40)}{order.description.length > 40 ? '...' : ''}</div>
                </td>
                <td className={styles.tableCell}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={14} color="#8a99a8" />
                    {new Date(order.openingDate).toLocaleDateString()}
                  </div>
                </td>
                {hasFinanceAccess && (
                  <td className={styles.tableCell} style={{ textAlign: 'right', fontWeight: 800, color: '#00e6b0' }}>
                     R$ {calculateBudgetTotal(order).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                )}
                <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button onClick={() => handleView(order.id)} className={`${styles.actionBtn} ${styles.viewBtn}`} title="Visualizar"><Eye size={16} /></button>
                    <button onClick={() => handleEdit(order.id)} className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar Orçamento"><Edit2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>
                   Nenhum orçamento pendente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BudgetsList;
