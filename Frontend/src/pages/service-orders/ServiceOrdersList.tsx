import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Edit2, Calendar, Filter, X } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';

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
    api.get('/service-orders')
      .then((data: any) => setOrders(data))
      .catch(() => showToast('Erro ao carregar ordens de serviço.', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

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

  const toggleSelectAllFiltered = () => {
    const filteredIds = filtered.map((o) => Number(o.id));
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedOrderIds.includes(id));

    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }

    setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const openBatchEditor = () => {
    if (!selectedOrderIds.length) {
      showToast('Selecione ao menos uma OS para replanejar em lote.', 'warning');
      return;
    }
    setBatchExternalConflicts([]);
    setBatchInternalConflicts([]);
    setBatchEditorOpen(true);
  };

  const closeBatchEditor = () => {
    if (savingPlan) return;
    setBatchExternalConflicts([]);
    setBatchInternalConflicts([]);
    setBatchEditorOpen(false);
  };

  const saveQuickPlan = async () => {
    if (!planEditor) return;

    setSavingPlan(true);
    try {
      await api.patch(`/service-orders/${planEditor.id}/plan`, {
        workCenter: planForm.workCenter?.trim() || null,
        plannedStartDate: planForm.plannedStartDate ? new Date(planForm.plannedStartDate).toISOString() : null,
        plannedEndDate: planForm.plannedEndDate ? new Date(planForm.plannedEndDate).toISOString() : null,
        plannedHours: Number(planForm.plannedHours) || 0,
      });

      showToast(`Planejamento da OS #${planEditor.id} atualizado.`, 'success');
      setQuickPlanConflicts([]);
      setPlanEditor(null);
      loadOrders();
      loadPcpOverview();
    } catch (error: any) {
      if (error && typeof error === 'object' && Array.isArray(error.conflicts)) {
        setQuickPlanConflicts(error.conflicts);
        showToast(error.message || 'Conflito de agenda detectado.', 'error');
        return;
      }
      showToast(typeof error === 'string' ? error : 'Erro ao replanejar OS.', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const saveBatchPlan = async () => {
    const payload: any = { ids: selectedOrderIds };

    if (batchPlanForm.workCenter.trim() !== '') {
      payload.workCenter = batchPlanForm.workCenter.trim();
    }
    if (batchPlanForm.plannedStartDate) {
      payload.plannedStartDate = new Date(batchPlanForm.plannedStartDate).toISOString();
    }
    if (batchPlanForm.plannedEndDate) {
      payload.plannedEndDate = new Date(batchPlanForm.plannedEndDate).toISOString();
    }
    if (batchPlanForm.plannedHours !== '') {
      payload.plannedHours = Number(batchPlanForm.plannedHours) || 0;
    }

    if (Object.keys(payload).length === 1) {
      showToast('Preencha ao menos um campo para aplicar no lote.', 'warning');
      return;
    }

    setSavingPlan(true);
    try {
      const result = await api.patch('/service-orders/plan/batch', payload);
      showToast(`Replanejamento em lote concluído: ${result?.updatedCount || selectedOrderIds.length} OS.`, 'success');
      setBatchEditorOpen(false);
      setSelectedOrderIds([]);
      setBatchExternalConflicts([]);
      setBatchInternalConflicts([]);
      setBatchPlanForm({ workCenter: '', plannedStartDate: '', plannedEndDate: '', plannedHours: '' });
      loadOrders();
      loadPcpOverview();
    } catch (error: any) {
      if (error && typeof error === 'object') {
        const externalConflicts = Array.isArray(error.externalConflicts) ? error.externalConflicts : [];
        const internalConflicts = Array.isArray(error.internalConflicts) ? error.internalConflicts : [];
        if (externalConflicts.length || internalConflicts.length) {
          setBatchExternalConflicts(externalConflicts);
          setBatchInternalConflicts(internalConflicts);
          showToast(error.message || 'Conflito de agenda detectado no lote.', 'error');
          return;
        }
      }
      showToast(typeof error === 'string' ? error : 'Erro ao replanejar lote de OS.', 'error');
    } finally {
      setSavingPlan(false);
    }
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

  const filtered = displayedOrders.filter(order => {
    const matchSearch = order.person?.naturalPerson?.name?.toLowerCase().includes(search.toLowerCase()) || 
                      order.person?.legalPerson?.corporateName?.toLowerCase().includes(search.toLowerCase()) ||
                      order.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || order.status === statusFilter;
    
    // Filtro por data
    const orderDate = new Date(order.openingDate).getTime();
    const matchStart = !startDate || orderDate >= new Date(startDate).getTime();
    const matchEnd = !endDate || orderDate <= new Date(endDate).getTime();
    const matchConflict = !showOnlyConflicts || conflictOrderIds.has(Number(order.id));

    return matchSearch && matchStatus && matchStart && matchEnd && matchConflict;
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
  const conflictCount = conflictOrderIds.size;

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className={styles.title}>{title}</h2>
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
          <button
            onClick={openBatchEditor}
            style={{
              background: selectedOrderIds.length ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.02)',
              color: selectedOrderIds.length ? '#10b981' : '#8a99a8',
              border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700
            }}
          >
            Replanejar Lote ({selectedOrderIds.length})
          </button>
          <button
            onClick={() => setShowOnlyConflicts((prev) => !prev)}
            style={{
              background: showOnlyConflicts ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.02)',
              color: showOnlyConflicts ? '#ef4444' : '#8a99a8',
              border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700
            }}
          >
            Só Conflitos ({conflictCount})
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
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>OS com Conflito</div>
            <div style={{ color: conflictCount > 0 ? '#ef4444' : '#10b981', fontSize: 20, fontWeight: 900 }}>
              {conflictCount}
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

      <div style={{
        background: 'rgba(15,23,42,0.75)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 16 }}>Calendário PCP por Turno</h3>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            Janela: {formatDateLabel(pcpStartDate)} até {formatDateLabel(pcpEndDate)}
          </span>
        </div>

        {pcpCalendarLoading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Gerando calendário por turno...</div>}

        {!pcpCalendarLoading && (!pcpCalendar?.centers || pcpCalendar.centers.length === 0) && (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem carga planejada para montar calendário no período.</div>
        )}

        {!pcpCalendarLoading && (pcpCalendar?.centers || []).map((center: any) => (
          <div key={`calendar-${center.workCenter}`} style={{ marginBottom: 14 }}>
            <div style={{ color: '#f8fafc', fontWeight: 800, marginBottom: 8 }}>{center.workCenter}</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(pcpCalendar?.days || []).length || 1}, minmax(120px, 1fr))`, gap: 8 }}>
              {(center.days || []).map((day: any) => {
                const load = Number(day.loadPercent || 0);
                const tone = load > 100 ? '#ef4444' : load > 85 ? '#f59e0b' : '#10b981';
                return (
                  <div key={`${center.workCenter}-${day.date}`} style={{
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 10,
                    padding: 8,
                    background: 'rgba(2,6,23,0.4)'
                  }}>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>{formatDateLabel(day.date)}</div>
                    <div style={{ color: tone, fontSize: 15, fontWeight: 900 }}>{load.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}%</div>
                    <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 2 }}>
                      {Number(day.plannedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h / {Number(day.capacityHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {(day.shifts || []).map((shift: any) => (
                        <div key={`${day.date}-${shift.key}`} style={{ fontSize: 10, color: '#94a3b8' }}>
                          {shift.label}: {Number(shift.plannedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h/{Number(shift.capacityHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
              <th style={{ width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={toggleSelectAllFiltered}
                  checked={filtered.length > 0 && filtered.every((o) => selectedOrderIds.includes(Number(o.id)))}
                />
              </th>
              <th style={{ paddingLeft: 20 }}>OS #</th>
              <th>Cliente</th>
              <th>{showFinancialData ? 'Custos / Total' : 'Quantidades / PCP'}</th>
              <th>Data Abertura</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr
                key={order.id}
                className={styles.tableRow}
                style={conflictOrderIds.has(Number(order.id)) ? { background: 'rgba(127,29,29,0.22)' } : undefined}
              >
                <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(Number(order.id))}
                    onChange={() => toggleOrderSelection(Number(order.id))}
                  />
                </td>
                <td style={{ paddingLeft: 20, fontWeight: 700 }}>#{order.id}</td>
                <td className={styles.tableCell}>
                  <div style={{ fontWeight: 600 }}>{order.person?.naturalPerson?.name || order.person?.legalPerson?.corporateName || 'N/A'}</div>
                  <div style={{ fontSize: 12, color: '#8a99a8' }}>{(order.description || '').substring(0, 40)}...</div>
                </td>
                <td className={styles.tableCell}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {showFinancialData ? (
                      <>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                          Custo Direto: R$ {(order.financials?.directCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>
                          Total Previsto: R$ {(order.financials?.totalEstimated || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                          Materiais: {(order.materials || []).reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                        </span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>
                          Mão de obra: {(order.services || []).reduce((acc: number, item: any) => acc + Number(item.hoursWorked || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                        </span>
                      </>
                    )}
                    <span style={{ color: '#60a5fa', fontSize: 12 }}>
                      PCP: {(order.workCenter || 'Sem centro')} • {(order.plannedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                    </span>
                    {conflictOrderIds.has(Number(order.id)) && (
                      <span style={{
                        display: 'inline-flex',
                        width: 'fit-content',
                        marginTop: 2,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(239,68,68,0.2)',
                        color: '#fecaca',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        Conflito de agenda
                      </span>
                    )}
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
                    <button
                      onClick={() => openPlanEditor(order)}
                      className={`${styles.actionBtn} ${styles.editBtn}`}
                      style={{ minWidth: 50, fontSize: 11, fontWeight: 800 }}
                    >
                      PCP
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {batchEditorOpen && (
        <div
          onClick={closeBatchEditor}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.72)',
            zIndex: 51,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 580,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96))',
              border: '1px solid rgba(148,163,184,0.22)',
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>Replanejamento em Lote ({selectedOrderIds.length} OS)</h3>
              <button
                onClick={closeBatchEditor}
                disabled={savingPlan}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}
              >
                ×
              </button>
            </div>

            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
              Preencha apenas os campos que deseja aplicar. Campos vazios serão ignorados.
            </div>

            {(batchExternalConflicts.length > 0 || batchInternalConflicts.length > 0) && (
              <div style={{
                background: 'rgba(127, 29, 29, 0.28)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                color: '#fecaca'
              }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Conflitos detectados no lote</div>

                {batchExternalConflicts.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 4 }}>Conflitos com OS já planejadas:</div>
                    {batchExternalConflicts.map((group: any) => (
                      <div key={`external-${group.id}`} style={{ fontSize: 12, marginBottom: 6 }}>
                        <strong>OS #{group.id}</strong>
                        {Array.isArray(group.conflicts) && group.conflicts.map((c: any) => (
                          <div key={`conf-${group.id}-${c.id}`} style={{ marginLeft: 8, color: '#fee2e2' }}>
                            • Conflita com OS #{c.id} ({c.traceCode || 'sem código'}) - {formatDateLabel(c.plannedStartDate)} até {formatDateLabel(c.plannedEndDate)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {batchInternalConflicts.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 4 }}>Conflitos internos no próprio lote:</div>
                    {batchInternalConflicts.map((c: any, idx: number) => (
                      <div key={`internal-${idx}`} style={{ fontSize: 12, marginLeft: 8, color: '#fee2e2' }}>
                        • OS #{c.leftId} e OS #{c.rightId} sobrepõem no centro {c.workCenter}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Centro de Trabalho</label>
                <input
                  className={styles.searchInput}
                  value={batchPlanForm.workCenter}
                  onChange={e => setBatchPlanForm({ ...batchPlanForm, workCenter: e.target.value })}
                  placeholder="Ex: Corte Plasma"
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Horas Planejadas</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className={styles.searchInput}
                  value={batchPlanForm.plannedHours}
                  onChange={e => setBatchPlanForm({ ...batchPlanForm, plannedHours: e.target.value })}
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Início Planejado</label>
                <input
                  type="date"
                  className={styles.searchInput}
                  value={batchPlanForm.plannedStartDate}
                  onChange={e => setBatchPlanForm({ ...batchPlanForm, plannedStartDate: e.target.value })}
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Fim Planejado</label>
                <input
                  type="date"
                  className={styles.searchInput}
                  value={batchPlanForm.plannedEndDate}
                  onChange={e => setBatchPlanForm({ ...batchPlanForm, plannedEndDate: e.target.value })}
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
            </div>

            {quickPlanConflicts.length > 0 && (
              <div style={{
                background: 'rgba(127, 29, 29, 0.28)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
                color: '#fecaca'
              }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Conflitos de agenda</div>
                {quickPlanConflicts.map((c: any) => (
                  <div key={`quick-conf-${c.id}`} style={{ fontSize: 12, marginBottom: 4, color: '#fee2e2' }}>
                    • OS #{c.id} ({c.traceCode || 'sem código'}) no centro {c.workCenter || '-'} - {formatDateLabel(c.plannedStartDate)} até {formatDateLabel(c.plannedEndDate)}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={closeBatchEditor}
                disabled={savingPlan}
                style={{ background: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveBatchPlan}
                disabled={savingPlan}
                style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', padding: '10px 14px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                {savingPlan ? 'Aplicando...' : 'Aplicar no Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {planEditor && (
        <div
          onClick={closePlanEditor}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.72)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96))',
              border: '1px solid rgba(148,163,184,0.22)',
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>Replanejar OS #{planEditor.id}</h3>
              <button
                onClick={closePlanEditor}
                disabled={savingPlan}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Centro de Trabalho</label>
                <input
                  className={styles.searchInput}
                  value={planForm.workCenter}
                  onChange={e => setPlanForm({ ...planForm, workCenter: e.target.value })}
                  placeholder="Ex: Solda MIG"
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Horas Planejadas</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className={styles.searchInput}
                  value={planForm.plannedHours}
                  onChange={e => setPlanForm({ ...planForm, plannedHours: parseFloat(e.target.value) || 0 })}
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Início Planejado</label>
                <input
                  type="date"
                  className={styles.searchInput}
                  value={planForm.plannedStartDate}
                  onChange={e => setPlanForm({ ...planForm, plannedStartDate: e.target.value })}
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Fim Planejado</label>
                <input
                  type="date"
                  className={styles.searchInput}
                  value={planForm.plannedEndDate}
                  onChange={e => setPlanForm({ ...planForm, plannedEndDate: e.target.value })}
                  style={{ height: 38, width: '100%', padding: '0 10px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={closePlanEditor}
                disabled={savingPlan}
                style={{ background: 'rgba(148,163,184,0.15)', color: '#cbd5e1', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveQuickPlan}
                disabled={savingPlan}
                style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', padding: '10px 14px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
              >
                {savingPlan ? 'Salvando...' : 'Salvar Planejamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrdersList;
