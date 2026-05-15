import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, Plus, Eye, Edit2, Calendar, Filter, X, RefreshCcw, 
  Activity, Clock, AlertTriangle, CheckCircle2, LayoutDashboard, 
  GanttChartSquare, Settings2, Zap, Target
} from 'lucide-react';
import SkeletonTable from '../../../components/SkeletonTable';
import api from '../../../services/api';
import commonStyles from '../../../styles/common/BaseList.module.css';
import styles from './ServiceOrdersList.module.css';
import { useToast } from '../../../components/ToastProvider';
import Pagination from '../../../components/Pagination';
import StatsCard from '../../../components/StatsCard';
import EmptyState from '../../../components/EmptyState';

interface ServiceOrdersListProps {
  showFinancialData?: boolean;
  title?: string;
  viewPathBase?: string;
}

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateValue: string | Date | null | undefined) => {
  if (!dateValue) return '-';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

const ServiceOrdersList: React.FC<ServiceOrdersListProps> = ({
  showFinancialData = false,
  title = 'Ordens de Serviço',
  viewPathBase = '/service-orders',
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pcpOverview, setPcpOverview] = useState<any>({ centers: [], days: 0, dailyCapacityHours: 8 });
  const [pcpCalendar, setPcpCalendar] = useState<any>({ days: [], centers: [], shiftConfig: [] });
  const [pcpLoading, setPcpLoading] = useState(false);
  const [pcpCalendarLoading, setPcpCalendarLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 15;
  
  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showOnlyConflicts, setShowOnlyConflicts] = useState(false);
  const [pcpStartDate, setPcpStartDate] = useState(formatDateInput(new Date()));
  const [pcpEndDate, setPcpEndDate] = useState(formatDateInput(new Date(Date.now() + (6 * 24 * 60 * 60 * 1000))));
  const [dailyCapacityHours, setDailyCapacityHours] = useState(8);
  const [planEditor, setPlanEditor] = useState<any | null>(null);
  const [batchEditorOpen, setBatchEditorOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [quickPlanConflicts, setQuickPlanConflicts] = useState<any[]>([]);
  const [batchExternalConflicts, setBatchExternalConflicts] = useState<any[]>([]);
  const [batchInternalConflicts, setBatchInternalConflicts] = useState<any[]>([]);
  const [planForm, setPlanForm] = useState({
    workCenter: '',
    plannedStartDate: '',
    plannedEndDate: '',
    plannedHours: 0,
  });
  const [batchPlanForm, setBatchPlanForm] = useState({
    workCenter: '',
    plannedStartDate: '',
    plannedEndDate: '',
    plannedHours: '',
  });

  const loadOrders = useCallback(() => {
    setLoading(true);
    api.get('/service-orders', {
      params: {
        page: currentPage,
        limit: itemsPerPage,
        search,
        status: statusFilter,
        startDate,
        endDate,
      }
    })
      .then((res: any) => {
        setOrders((Array.isArray(res) ? res : res?.data) || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      })
      .catch(() => showToast('Erro ao carregar ordens de serviço.', 'error'))
      .finally(() => setLoading(false));
  }, [showToast, currentPage, search, statusFilter, startDate, endDate]);

  const displayedOrders = useMemo(() => {
    if (!showFinancialData) return orders;
    return orders.map((order: any) => ({
      ...order,
      financials: {
        directCost: (order.materials || []).reduce((acc: number, m: any) => acc + Number(m.totalPrice || 0), 0)
          + (order.services || []).reduce((acc: number, s: any) => acc + Number(s.totalPrice || 0), 0),
        totalEstimated: Number(order.financials?.totalEstimated || 0)
          || ((order.materials || []).reduce((acc: number, m: any) => acc + Number(m.totalPrice || 0), 0)
          + (order.services || []).reduce((acc: number, s: any) => acc + Number(s.totalPrice || 0), 0)),
      },
    }));
  }, [orders, showFinancialData]);

  const loadPcpOverview = useCallback(() => {
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

  const loadPcpCalendar = useCallback(() => {
    setPcpCalendarLoading(true);
    api.get('/service-orders/pcp/calendar', {
      params: {
        startDate: pcpStartDate,
        endDate: pcpEndDate,
        morningHours: dailyCapacityHours / 2,
        afternoonHours: dailyCapacityHours / 2,
        nightHours: 0,
      }
    })
      .then((data: any) => setPcpCalendar(data || { days: [], centers: [], shiftConfig: [] }))
      .catch(() => setPcpCalendar({ days: [], centers: [], shiftConfig: [] }))
      .finally(() => setPcpCalendarLoading(false));
  }, [pcpStartDate, pcpEndDate, dailyCapacityHours]);

  const handleRefresh = useCallback(() => {
    loadOrders();
    loadPcpOverview();
    loadPcpCalendar();
  }, [loadOrders, loadPcpOverview, loadPcpCalendar]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadPcpOverview();
  }, [loadPcpOverview]);

  useEffect(() => {
    loadPcpCalendar();
  }, [loadPcpCalendar]);

  const handleView = (id: number) => navigate(`${viewPathBase}/${id}`);
  const handleEdit = (id: number) => navigate(`/service-orders/${id}/edit`);

  const openPlanEditor = (order: any) => {
    setQuickPlanConflicts([]);
    setPlanEditor(order);
    setPlanForm({
      workCenter: order.workCenter || '',
      plannedStartDate: order.plannedStartDate ? String(order.plannedStartDate).split('T')[0] : '',
      plannedEndDate: order.plannedEndDate ? String(order.plannedEndDate).split('T')[0] : '',
      plannedHours: Number(order.plannedHours) || 0,
    });
  };

  const closePlanEditor = () => {
    if (savingPlan) return;
    setQuickPlanConflicts([]);
    setPlanEditor(null);
  };

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrderIds((prev) => prev.includes(orderId)
      ? prev.filter((id) => id !== orderId)
      : [...prev, orderId]
    );
  };

  const conflictOrderIds = useMemo(() => {
    const conflictIds = new Set<number>();
    const centers = Array.isArray(pcpOverview?.centers) ? pcpOverview.centers : [];

    centers.forEach((center: any) => {
      const centerOrders = Array.isArray(center?.orders)
        ? center.orders.filter((order: any) => order?.plannedStartDate && order?.plannedEndDate)
        : [];

      for (let i = 0; i < centerOrders.length; i += 1) {
        for (let j = i + 1; j < centerOrders.length; j += 1) {
          const left = centerOrders[i];
          const right = centerOrders[j];
          const leftStart = new Date(left.plannedStartDate);
          const leftEnd = new Date(left.plannedEndDate);
          const rightStart = new Date(right.plannedStartDate);
          const rightEnd = new Date(right.plannedEndDate);

          if (
            Number.isNaN(leftStart.getTime()) ||
            Number.isNaN(leftEnd.getTime()) ||
            Number.isNaN(rightStart.getTime()) ||
            Number.isNaN(rightEnd.getTime())
          ) {
            continue;
          }

          if (leftStart <= rightEnd && leftEnd >= rightStart) {
            conflictIds.add(Number(left.id));
            conflictIds.add(Number(right.id));
          }
        }
      }
    });

    return conflictIds;
  }, [pcpOverview]);

  const filtered = useMemo(() => {
    if (!showOnlyConflicts) return displayedOrders;
    return displayedOrders.filter(order => conflictOrderIds.has(Number(order.id)));
  }, [displayedOrders, showOnlyConflicts, conflictOrderIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  };

  const totalPlanned = (pcpOverview?.centers || []).reduce((acc: number, c: any) => acc + (c.plannedHours || 0), 0);
  const totalCapacity = (pcpOverview?.centers || []).reduce((acc: number, c: any) => acc + (c.capacityHours || 0), 0);
  const totalLoadPercent = totalCapacity > 0 ? (totalPlanned / totalCapacity) * 100 : 0;
  const conflictCount = conflictOrderIds.size;

  return (
    <div className={commonStyles.listContainer}>
      <header className={commonStyles.header}>
        <div className={commonStyles.headerInfo}>
          <h2 className={commonStyles.title}>{title}</h2>
          <p className={commonStyles.stats}>Gestão operacional e planejamento de capacidade (PCP)</p>
        </div>

        <div className={commonStyles.controls}>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`${styles.toolBtn} ${showFilters ? styles.toolBtnActive : ''}`}
          >
            <Filter size={18} /> <span>Filtros</span>
          </button>

          <button
            onClick={() => setShowOnlyConflicts((prev) => !prev)}
            className={`${styles.toolBtn} ${showOnlyConflicts ? styles.toolBtnDanger : ''}`}
          >
            <AlertTriangle size={18} /> <span>Conflitos ({conflictCount})</span>
          </button>

          <div className={commonStyles.searchWrapper}>
            <Search size={16} className={commonStyles.searchIcon} />
            <input
              type="text"
              className={commonStyles.searchInput}
              placeholder="OS, Cliente ou descrição..."
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

          <Link to="/service-orders/new" className={commonStyles.newBtn}>
            <Plus size={18} />
            <span>Nova OS</span>
          </Link>
        </div>
      </header>

      {/* Mini Dashboard Operacional */}
      <section className={styles.statsGrid}>
        <StatsCard 
          title="Carga Planejada" 
          value={`${totalPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h`} 
          icon={Clock} 
          color="#3b82f6"
        />
        <StatsCard 
          title="Capacidade Total" 
          value={`${totalCapacity.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h`} 
          icon={Target} 
          color="#a855f7"
        />
        <StatsCard 
          title="Ocupação Global" 
          value={`${totalLoadPercent.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`} 
          icon={Activity} 
          trend={{ value: totalLoadPercent > 90 ? 'Crítico' : 'Normal', isPositive: totalLoadPercent < 90 }}
          color={totalLoadPercent > 90 ? 'var(--danger)' : 'var(--primary)'}
        />
        <StatsCard 
          title="Status de Conflitos" 
          value={conflictCount} 
          icon={AlertTriangle} 
          trend={{ value: conflictCount > 0 ? 'Replanejar' : 'OK', isPositive: conflictCount === 0 }}
          color={conflictCount > 0 ? 'var(--danger)' : 'var(--success)'}
        />
      </section>

      {/* Visão de Centros de Trabalho (Bento Grid Style) */}
      <section className={styles.pcpSection}>
        <div className={styles.pcpHeader}>
          <div className={styles.pcpTitleGroup}>
            <Zap size={20} color="var(--primary)" />
            <h3 className={styles.pcpTitle}>Performance por Centro de Trabalho</h3>
          </div>
          <div className={styles.pcpControls}>
             <input type="date" value={pcpStartDate} onChange={e => setPcpStartDate(e.target.value)} className={styles.pcpInput} />
             <span className={styles.pcpSeparator}>até</span>
             <input type="date" value={pcpEndDate} onChange={e => setPcpEndDate(e.target.value)} className={styles.pcpInput} />
          </div>
        </div>

        <div className={styles.centersGrid}>
          {pcpLoading ? (
            [1,2,3,4].map(i => <div key={i} className={styles.skeletonCenter} />)
          ) : (pcpOverview?.centers || []).map((center: any) => {
            const load = Number(center.loadPercent || 0);
            const barColor = load > 100 ? '#ef4444' : load > 85 ? '#f59e0b' : 'var(--primary)';
            return (
              <div key={center.workCenter} className={styles.centerCard}>
                <div className={styles.centerHeader}>
                  <span className={styles.centerName}>{center.workCenter}</span>
                  <span className={styles.centerPercent} style={{ color: barColor }}>{load.toFixed(1)}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${Math.min(load, 100)}%`, background: barColor, boxShadow: `0 0 10px ${barColor}44` }} 
                  />
                </div>
                <div className={styles.centerMetrics}>
                  <span>{center.plannedHours?.toFixed(1)}h / {center.capacityHours?.toFixed(1)}h</span>
                  <span>{center.ordersCount} OS</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {loading ? (
        <SkeletonTable columns={7} rows={10} />
      ) : filtered.length > 0 ? (
        <div className="animate-fade-in">
          <table className={commonStyles.tableContainer}>
            <thead className={commonStyles.tableHeader}>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                   <input type="checkbox" disabled />
                </th>
                <th>OS #</th>
                <th>Cliente / Descrição</th>
                <th>Operacional / Financeiro</th>
                <th>Abertura</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr 
                  key={order.id} 
                  className={`${commonStyles.tableRow} ${conflictOrderIds.has(Number(order.id)) ? styles.rowConflict : ''}`}
                  onClick={() => handleView(order.id)}
                >
                  <td className={commonStyles.tableCell} style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(Number(order.id))}
                      onChange={() => toggleOrderSelection(Number(order.id))}
                    />
                  </td>
                  <td className={commonStyles.tableCell}>
                    <span className={styles.osNumber}>#{order.id}</span>
                  </td>
                  <td className={commonStyles.tableCell}>
                    <div className={styles.clientCell}>
                      <span className={commonStyles.primaryText}>{order.person?.naturalPerson?.name || order.person?.legalPerson?.corporateName || 'N/A'}</span>
                      <span className={commonStyles.secondaryText}>{(order.description || '').substring(0, 50)}...</span>
                    </div>
                  </td>
                  <td className={commonStyles.tableCell}>
                    <div className={styles.metricsCell}>
                      {showFinancialData ? (
                        <span className={styles.financialValue}>
                          R$ {(order.financials?.totalEstimated || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className={styles.operationalValue}>
                          { (order.services || []).reduce((acc: number, s: any) => acc + Number(s.hoursWorked || 0), 0) }h de serviço
                        </span>
                      )}
                      <span className={styles.pcpBadge}>
                        {order.workCenter || 'Sem PCP'} • {order.plannedHours || 0}h
                      </span>
                    </div>
                  </td>
                  <td className={commonStyles.tableCell}>
                    <div className={styles.dateCell}>
                      <Calendar size={14} />
                      {new Date(order.openingDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className={commonStyles.tableCell}>
                    <span className={`${commonStyles.badge} ${
                      order.status === 'Concluída' ? commonStyles.badgeActive : 
                      order.status === 'Cancelada' ? commonStyles.badgeInactive : 
                      commonStyles.badgePending
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className={commonStyles.tableCell} style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => handleView(order.id)} className={`${commonStyles.actionBtn} ${commonStyles.viewBtn}`}><Eye size={16} /></button>
                      <button onClick={() => handleEdit(order.id)} className={`${commonStyles.actionBtn} ${commonStyles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => openPlanEditor(order)} className={styles.pcpActionBtn}>PCP</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={commonStyles.footer}>
             <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
              />
          </div>
        </div>
      ) : (
        <EmptyState 
          title="Nenhuma Ordem de Serviço"
          description="A base de operações está limpa. Inicie uma nova OS para começar o planejamento."
          actionLabel="Nova Ordem de Serviço"
          onAction={() => navigate('/service-orders/new')}
        />
      )}
    </div>
  );
};

export default ServiceOrdersList;
