import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit2, Calendar, Filter, X } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const ServiceOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/service-orders')
      .then((data: any) => setOrders(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleView = (id: number) => navigate(`/service-orders/${id}`);
  const handleEdit = (id: number) => navigate(`/service-orders/${id}/edit`);

  const filtered = orders.filter(order => {
    const matchSearch = order.person?.naturalPerson?.name?.toLowerCase().includes(search.toLowerCase()) || 
                      order.person?.legalPerson?.corporateName?.toLowerCase().includes(search.toLowerCase()) ||
                      order.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || order.status === statusFilter;
    
    // Filtro por data
    const orderDate = new Date(order.openingDate).getTime();
    const matchStart = !startDate || orderDate >= new Date(startDate).getTime();
    const matchEnd = !endDate || orderDate <= new Date(endDate).getTime();

    return matchSearch && matchStatus && matchStart && matchEnd;
  });

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className={styles.title}>Ordens de Serviço</h2>
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
        <Link to="/service-orders/new" className={styles.newBtn}>
          <Plus size={20} /> Nova OS
        </Link>
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
            <label style={{ fontSize: 12, color: '#8a99a8', display: 'block', marginBottom: 6 }}>Status</label>
            <select className={styles.searchInput} style={{ height: 38, width: '100%', padding: '0 10px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos os Status</option>
              <option value="Orçamento">Orçamento</option>
              <option value="Aprovada">Aprovada</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Concluída">Concluída</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8a99a8', display: 'block', marginBottom: 6 }}>Início</label>
            <input type="date" className={styles.searchInput} style={{ height: 38, width: '100%', padding: '0 10px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8a99a8', display: 'block', marginBottom: 6 }}>Fim</label>
            <input type="date" className={styles.searchInput} style={{ height: 38, width: '100%', padding: '0 10px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={clearFilters} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Limpar
            </button>
          </div>
        </div>
      )}

      {loading && <div className={styles.stats}>Sincronizando Ordens de Serviço...</div>}
      
      {!loading && (
        <table className={styles.tableContainer}>
          <thead className={styles.tableHeader}>
            <tr>
              <th style={{ paddingLeft: 20 }}>OS #</th>
              <th>Cliente</th>
              <th>Data Abertura</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id} className={styles.tableRow}>
                <td style={{ paddingLeft: 20, fontWeight: 700 }}>#{order.id}</td>
                <td className={styles.tableCell}>
                  <div style={{ fontWeight: 600 }}>{order.person?.naturalPerson?.name || order.person?.legalPerson?.corporateName || 'N/A'}</div>
                  <div style={{ fontSize: 12, color: '#8a99a8' }}>{order.description.substring(0, 40)}...</div>
                </td>
                <td className={styles.tableCell}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={14} color="#8a99a8" />
                    {new Date(order.openingDate).toLocaleDateString()}
                  </div>
                </td>
                <td className={styles.tableCell}>
                  <span className={`${styles.badge} ${
                    order.status === 'Concluída' ? styles.badgeActive : 
                    order.status === 'Cancelada' ? styles.badgeInactive : 
                    styles.badgePending
                   }`} style={{ 
                    background: order.status === 'Orçamento' ? 'rgba(59, 130, 246, 0.15)' : undefined,
                    color: order.status === 'Orçamento' ? '#3b82f6' : undefined
                   }}>
                    {order.status}
                  </span>
                </td>
                <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button onClick={() => handleView(order.id)} className={`${styles.actionBtn} ${styles.viewBtn}`}><Eye size={16} /></button>
                    <button onClick={() => handleEdit(order.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ServiceOrdersList;
