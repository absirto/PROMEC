import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as XLSX from 'xlsx';
import { ShoppingCart, RefreshCcw, Filter, CheckCircle2, Clock3, FileDown, Search, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import Skeleton from '../../components/Skeleton';
import Pagination from '../../components/Pagination';

const requestStatusColor: Record<string, string> = {
  OPEN: '#f59e0b',
  PARTIAL: '#38bdf8',
  CLOSED: '#10b981',
};

interface NewPurchaseFormData {
  supplierPersonId: string;
  items: {
    id: number;
    materialName: string;
    shortageQty: number;
    unit: string;
    quantity: number;
    unitCost: string;
    totalPaid: string;
  }[];
}

const PurchaseFulfillmentForm: React.FC<{ 
  request: any, 
  people: any[], 
  onSuccess: () => void,
  getPersonName: (p: any) => string 
}> = ({ request, people, onSuccess, getPersonName }) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const pendingItems = (request.items || []).filter((i: any) => Number(i.shortageQty || 0) > 0 && i.status !== 'PURCHASED');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<NewPurchaseFormData>({
    defaultValues: {
      supplierPersonId: '',
      items: pendingItems.map((item: any) => ({
        id: item.id,
        materialName: item.material?.name,
        shortageQty: item.shortageQty,
        unit: item.unit || item.material?.unit,
        quantity: item.shortageQty,
        unitCost: '',
        totalPaid: ''
      }))
    }
  });

  const watchedItems = watch('items');

  const handleCalcTotal = (index: number) => {
    const qty = Number(watchedItems[index].quantity) || 0;
    const cost = Number(watchedItems[index].unitCost) || 0;
    setValue(`items.${index}.totalPaid` as any, (qty * cost).toFixed(2));
  };

  const onSubmit = async (data: NewPurchaseFormData) => {
    if (!data.supplierPersonId) {
      showToast('Selecione um fornecedor.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierPersonId: data.supplierPersonId,
        items: data.items.map((item: any) => ({
          purchaseRequestItemId: item.id,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          totalPaid: Number(item.totalPaid)
        }))
      };

      await api.post(`/service-orders/purchase-requests/${request.id}/fulfill`, payload);
      showToast('Compra e entrada em estoque registradas!');
      onSuccess();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Erro ao registrar compra.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 12, background: 'rgba(15,23,42,0.45)', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800 }}>{request.code}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {request.serviceOrder?.traceCode || 'Sem OS'} · {request.serviceOrder?.description || 'Solicitação geral'}
          </div>
        </div>
        <span style={{
          color: requestStatusColor[request.status] || '#cbd5e1',
          border: `1px solid ${requestStatusColor[request.status] || '#475569'}`,
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 800,
          height: 'fit-content'
        }}>
          {request.status}
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <select
          className={`${styles.searchInput} ${errors.supplierPersonId ? styles.inputError : ''}`}
          style={{ width: '100%', minWidth: 'unset' }}
          {...register('supplierPersonId', { required: true })}
        >
          <option value="">Selecione o fornecedor</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{getPersonName(person)}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {watchedItems.map((item, index) => (
          <div key={item.id} style={{ background: 'rgba(2,6,23,0.45)', borderRadius: 10, padding: 10 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>
              {item.materialName}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
              Pendente: {Number(item.shortageQty).toLocaleString('pt-BR')} {item.unit}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <input 
                type="number" step="0.01" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%', fontSize: 12 }} 
                placeholder="Qtd" {...register(`items.${index}.quantity` as any, { required: true, onChange: () => handleCalcTotal(index) })} 
              />
              <input 
                type="number" step="0.01" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%', fontSize: 12 }} 
                placeholder="Custo" {...register(`items.${index}.unitCost` as any, { required: true, onChange: () => handleCalcTotal(index) })} 
              />
              <input 
                type="number" step="0.01" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%', fontSize: 12 }} 
                placeholder="Total" {...register(`items.${index}.totalPaid` as any, { required: true })} 
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          width: '100%',
          border: '1px solid rgba(16,185,129,0.35)',
          background: 'rgba(16,185,129,0.14)',
          color: '#86efac',
          borderRadius: 12,
          padding: '10px',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 13
        }}
      >
        {submitting ? 'Gravando...' : 'Registrar Compra e Entrada'}
      </button>
    </form>
  );
};

const PurchasesList: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [emissions, setEmissions] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    supplierPersonId: '',
    status: '',
  });

  // Paginação
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histTotalItems, setHistTotalItems] = useState(0);

  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalItems, setAuditTotalItems] = useState(0);

  const [reqPage, setReqPage] = useState(1);
  const [reqTotalPages, setReqTotalPages] = useState(1);
  const [reqTotalItems, setReqTotalItems] = useState(0);

  const itemsPerPage = 8;

  const getPersonName = (person: any) => {
    if (!person) return '-';
    return person.naturalPerson?.name || person.legalPerson?.corporateName || '-';
  };

  const fetchHistory = useCallback(async () => {
    try {
      const historyParams = new URLSearchParams();
      if (filters.startDate) historyParams.set('startDate', filters.startDate);
      if (filters.endDate) historyParams.set('endDate', filters.endDate);
      if (filters.supplierPersonId) historyParams.set('supplierPersonId', filters.supplierPersonId);
      historyParams.set('page', String(histPage));
      historyParams.set('limit', String(itemsPerPage));

      const res: any = await api.get(`/stock/purchases?${historyParams.toString()}`);
      setPurchaseHistory(res || []);
      setHistTotalPages(res.meta?.totalPages || 1);
      setHistTotalItems(res.meta?.total || 0);
    } catch (err) {
      showToast('Erro ao carregar histórico.', 'error');
    }
  }, [filters, histPage, showToast]);

  const fetchAudit = useCallback(async () => {
    try {
      const res: any = await api.get('/dashboard/audit-logs', { 
        params: { module: 'Suprimentos', page: auditPage, limit: itemsPerPage } 
      });
      setEmissions(res || []);
      setAuditTotalPages(res.meta?.totalPages || 1);
      setAuditTotalItems(res.meta?.total || 0);
    } catch (err) {
      setEmissions([]);
    }
  }, [auditPage]);

  const fetchRequests = useCallback(async () => {
    try {
      const res: any = await api.get('/service-orders/purchase-requests', {
        params: { page: reqPage, limit: itemsPerPage }
      });
      setPurchaseRequests(res || []);
      setReqTotalPages(res.meta?.totalPages || 1);
      setReqTotalItems(res.meta?.total || 0);
    } catch (err) {
      showToast('Erro ao carregar solicitações.', 'error');
    }
  }, [reqPage, showToast]);

  const fetchBaseData = useCallback(async () => {
    try {
      const allPeople = await api.get('/people');
      setPeople(allPeople || []);
    } catch (err) {
      showToast('Erro ao carregar pessoas.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchHistory(), fetchAudit(), fetchRequests(), fetchBaseData()]).finally(() => setLoading(false));
  }, [fetchHistory, fetchAudit, fetchRequests, fetchBaseData]);

  const handleApplyFilters = () => {
    setHistPage(1);
    fetchHistory();
  };

  const exportToExcel = () => {
    const exportData = purchaseHistory.map(item => ({
      Data: new Date(item.purchaseDate).toLocaleDateString('pt-BR'),
      Fornecedor: getPersonName(item.supplier),
      Material: item.material?.name,
      Quantidade: item.quantity,
      'Custo Unitário': item.unitCost,
      'Total Pago': item.totalPaid,
      'OS Ref.': item.serviceOrder?.traceCode || 'Geral'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico de Compras");
    XLSX.writeFile(wb, "historico_compras_promec.xlsx");
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', padding: 10, borderRadius: 12 }}>
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className={styles.title} style={{ margin: 0 }}>Gestão de Suprimentos</h2>
            <p style={{ color: '#8a99a8', fontSize: 13, margin: 0 }}>Fulfillment de solicitações e rastreabilidade de entradas</p>
          </div>
        </div>
        <button 
          className={`${styles.refreshBtn} ${loading ? styles.refreshBtnLoading : ''}`} 
          onClick={() => { setHistPage(1); setAuditPage(1); setReqPage(1); }}
          title="Atualizar Listas"
        >
          <RefreshCcw size={20} />
        </button>
      </div>

      <div style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 24,
        marginTop: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f1f5f9', fontWeight: 800, marginRight: 8 }}>
          <Filter size={16} /> Filtros
        </div>
        <input type="date" className={styles.searchInput} value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
        <input type="date" className={styles.searchInput} value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
        <select className={styles.searchInput} value={filters.supplierPersonId} onChange={e => setFilters({...filters, supplierPersonId: e.target.value})}>
          <option value="">Todos os Fornecedores</option>
          {people.map(p => <option key={p.id} value={p.id}>{getPersonName(p)}</option>)}
        </select>
        <button className={styles.newBtn} onClick={handleApplyFilters}><Search size={18} /> Filtrar</button>
        <button className={styles.actionBtn} onClick={exportToExcel} disabled={purchaseHistory.length === 0}><FileDown size={18} /> Exportar Excel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Solicitações Pendentes */}
        <div>
           <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Clock3 size={18} color="#f59e0b" />
            <strong style={{ color: '#f1f5f9', fontSize: 16 }}>Solicitações Pendentes</strong>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton height="160px" borderRadius="14px" />
              <Skeleton height="160px" borderRadius="14px" />
            </div>
          ) : purchaseRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 20, color: '#8a99a8' }}>Nenhuma solicitação pendente.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {purchaseRequests.map(request => (
                <PurchaseFulfillmentForm 
                  key={request.id} 
                  request={request} 
                  people={people} 
                  onSuccess={() => { setReqPage(1); fetchRequests(); fetchHistory(); fetchAudit(); }} 
                  getPersonName={getPersonName} 
                />
              ))}
              <Pagination
                currentPage={reqPage}
                totalPages={reqTotalPages}
                onPageChange={setReqPage}
                totalItems={reqTotalItems}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </div>

        {/* Histórico e Auditoria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Histórico de Entradas */}
          <div style={{ background: 'rgba(15, 23, 42, 0.25)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <CheckCircle2 size={18} color="#10b981" />
              <strong style={{ color: '#f1f5f9', fontSize: 16 }}>Últimas Entradas</strong>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3].map(i => <Skeleton key={i} height="80px" borderRadius="12px" />)}
              </div>
            ) : purchaseHistory.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#8a99a8' }}>Sem entradas no período.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {purchaseHistory.map(item => (
                  <div key={item.id} style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{item.material?.name}</span>
                      <span style={{ color: '#10b981', fontWeight: 800 }}>R$ {Number(item.totalPaid).toLocaleString('pt-BR')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8a99a8', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{getPersonName(item.supplier)}</span>
                      <span>{item.quantity} {item.material?.unit}</span>
                    </div>
                  </div>
                ))}
                <Pagination
                  currentPage={histPage}
                  totalPages={histTotalPages}
                  onPageChange={setHistPage}
                  totalItems={histTotalItems}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}
          </div>

          {/* Histórico de Emissões */}
          <div style={{ background: 'rgba(15, 23, 42, 0.25)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FileSpreadsheet size={18} color="#38bdf8" />
              <strong style={{ color: '#f1f5f9', fontSize: 16 }}>Log de Atividades</strong>
            </div>

            {loading ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                 <Skeleton height="60px" borderRadius="12px" />
               </div>
            ) : emissions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#5c6b7a', fontSize: 12 }}>Nenhum log recente.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {emissions.map(log => (
                  <div key={log.id} style={{ fontSize: 11, color: '#8a99a8', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', borderRadius: 8 }}>
                    <strong>{log.action}</strong> por {log.user?.firstName || 'Sistema'} em {new Date(log.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                ))}
                <Pagination
                  currentPage={auditPage}
                  totalPages={auditTotalPages}
                  onPageChange={setAuditPage}
                  totalItems={auditTotalItems}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchasesList;
