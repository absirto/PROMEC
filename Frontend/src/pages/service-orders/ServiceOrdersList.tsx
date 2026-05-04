import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit2, Calendar, Filter, X } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ServiceOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pcpOverview, setPcpOverview] = useState<any>({ centers: [], days: 0, dailyCapacityHours: 8 });
  const [pcpLoading, setPcpLoading] = useState(false);
  
  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pcpStartDate, setPcpStartDate] = useState(formatDateInput(new Date()));
  const [pcpEndDate, setPcpEndDate] = useState(formatDateInput(new Date(Date.now() + (6 * 24 * 60 * 60 * 1000))));
  const [dailyCapacityHours, setDailyCapacityHours] = useState(8);

  useEffect(() => {
    setLoading(true);
    api.get('/service-orders')
      .then((data: any) => setOrders(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPcpLoading(true);
    api.get('/service-orders/pcp/overview', {
      params: {
        startDate: pcpStartDate,
        endDate: pcpEndDate,
        dailyCapacityHours,
      }
    })
      .then((data: any) => setPcpOverview(data || { centers: [] }))
      .catch(() => setPcpOverview({ centers: [] }))
      .finally(() => setPcpLoading(false));
  }, [pcpStartDate, pcpEndDate, dailyCapacityHours]);

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

  const totalPlanned = (pcpOverview?.centers || []).reduce((acc: number, c: any) => acc + (c.plannedHours || 0), 0);
  const totalCapacity = (pcpOverview?.centers || []).reduce((acc: number, c: any) => acc + (c.capacityHours || 0), 0);
  const totalLoadPercent = totalCapacity > 0 ? (totalPlanned / totalCapacity) * 100 : 0;

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

      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.82), rgba(30,41,59,0.78))',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: 18,
        padding: 18,
        marginBottom: 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 18 }}>PCP: Capacidade x Carga</h3>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
              {pcpOverview?.days || 0} dias no período • {pcpOverview?.centers?.length || 0} centros ativos
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Início</label>
              <input type="date" value={pcpStartDate} onChange={e => setPcpStartDate(e.target.value)} className={styles.searchInput} style={{ height: 34, padding: '0 10px' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Fim</label>
              <input type="date" value={pcpEndDate} onChange={e => setPcpEndDate(e.target.value)} className={styles.searchInput} style={{ height: 34, padding: '0 10px' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Capacidade/dia (h)</label>
              <input
                type="number"
                min={1}
                step="0.5"
                value={dailyCapacityHours}
                onChange={e => setDailyCapacityHours(Math.max(1, parseFloat(e.target.value) || 8))}
                className={styles.searchInput}
                style={{ height: 34, width: 130, padding: '0 10px' }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Carga Planejada Total</div>
            <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800 }}>{totalPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Capacidade Total</div>
            <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800 }}>{totalCapacity.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Ocupação Global</div>
            <div style={{ color: totalLoadPercent > 100 ? '#ef4444' : '#10b981', fontSize: 20, fontWeight: 900 }}>
              {totalLoadPercent.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {pcpLoading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Atualizando visão PCP...</div>}
          {!pcpLoading && (pcpOverview?.centers || []).length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Nenhuma OS planejada para o período selecionado.</div>
          )}
          {!pcpLoading && (pcpOverview?.centers || []).map((center: any) => {
            const load = Number(center.loadPercent || 0);
            const cappedWidth = Math.min(load, 100);
            const barColor = load > 100 ? '#ef4444' : load > 85 ? '#f59e0b' : '#10b981';

            return (
              <div key={center.workCenter} style={{ background: 'rgba(2,6,23,0.45)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ color: '#e2e8f0', fontSize: 13 }}>{center.workCenter}</strong>
                  <span style={{ color: barColor, fontWeight: 800, fontSize: 12 }}>
                    {load.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
                  </span>
                </div>

                <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(cappedWidth, 2)}%`, height: '100%', background: barColor }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                  <span>{(center.plannedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h planejadas</span>
                  <span>{(center.capacityHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h capacidade</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                  {center.ordersCount || 0} OS em carteira
                </div>
              </div>
            );
          })}
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
              <th>Custos / Total</th>
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
                  <div style={{ fontSize: 12, color: '#8a99a8' }}>{(order.description || '').substring(0, 40)}...</div>
                </td>
                <td className={styles.tableCell}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>
                      Custo Direto: R$ {(order.financials?.directCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                      Total Previsto: R$ {(order.financials?.totalEstimated || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: '#60a5fa', fontSize: 12 }}>
                      PCP: {(order.workCenter || 'Sem centro')} • {(order.plannedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                    </span>
                  </div>
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
