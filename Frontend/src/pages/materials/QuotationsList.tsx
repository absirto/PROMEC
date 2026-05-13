import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  FileDown,
  FileText,
  Printer,
  RefreshCw,
  Search,
  WandSparkles,
  Save,
  Trash2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import pageStyles from './QuotationsList.module.css';
import { useToast } from '../../components/ToastProvider';
import Skeleton from '../../components/Skeleton';

const quotationStatusColor: Record<string, string> = {
  OPEN: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#64748b',
};

const requestStatusColor: Record<string, string> = {
  OPEN: '#f59e0b',
  PARTIAL: '#38bdf8',
  CLOSED: '#10b981',
};

interface QuotationItem {
  purchaseRequestItemId: number;
  materialName: string;
  unit: string;
  shortageQty: number;
  priceReference: number;
  quantity: number;
  unitCost: string;
  ipiValue: string;
  icmsValue: string;
  stValue: string;
  totalPaid: string;
  notes: string;
}

interface QuotationFormData {
  purchaseRequestId: string;
  supplierPersonId: string;
  validUntil: string;
  paymentTerms: string;
  freightMode: string;
  freightCost: string;
  deliveryLeadTimeDays: string;
  warrantyDays: string;
  notes: string;
  items: QuotationItem[];
}

const safeNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: unknown) => safeNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value: unknown) => safeNumber(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const formatDate = (value: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

const QuotationsList: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [comparisonRequestId, setComparisonRequestId] = useState<number | null>(null);
  
  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<QuotationFormData>({
    defaultValues: {
      freightMode: 'CIF',
      items: []
    }
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "items"
  });

  const watchedItems = watch('items');
  const watchedRequestId = watch('purchaseRequestId');
  const watchedFreight = watch('freightCost');

  const getPersonName = (person: any) => {
    if (!person) return '-';
    return person.naturalPerson?.name || person.legalPerson?.corporateName || '-';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsData, quotationsData, peopleData] = await Promise.all([
        api.get('/service-orders/purchase-requests'),
        api.get('/service-orders/purchase-quotations'),
        api.get('/people'),
      ]);
      setPurchaseRequests(Array.isArray(requestsData) ? requestsData : []);
      setQuotations(Array.isArray(quotationsData) ? quotationsData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch {
      showToast('Erro ao carregar módulo de cotações.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Atualizar itens quando a solicitação muda
  useEffect(() => {
    const requestId = Number(watchedRequestId);
    if (!requestId) {
      replace([]);
      return;
    }
    const request = purchaseRequests.find(r => r.id === requestId);
    if (request) {
      const pending = (request.items || []).filter((item: any) => Number(item.shortageQty || 0) > 0 && item.status !== 'PURCHASED');
      replace(pending.map((item: any) => ({
        purchaseRequestItemId: item.id,
        materialName: item.material?.name,
        unit: item.unit || item.material?.unit,
        shortageQty: item.shortageQty,
        priceReference: item.material?.price || 0,
        quantity: item.shortageQty,
        unitCost: String(item.material?.price || ''),
        ipiValue: '',
        icmsValue: '',
        stValue: '',
        totalPaid: '',
        notes: ''
      })));
    }
  }, [watchedRequestId, purchaseRequests, replace]);

  const handleCalcItemTotal = (index: number) => {
    const item = watchedItems[index];
    const qty = safeNumber(item.quantity);
    const cost = safeNumber(item.unitCost);
    const ipi = safeNumber(item.ipiValue);
    const icms = safeNumber(item.icmsValue);
    const st = safeNumber(item.stValue);
    const total = (qty * cost) + ipi + icms + st;
    setValue(`items.${index}.totalPaid` as any, total.toFixed(2));
  };

  const onSubmit = async (data: QuotationFormData) => {
    const items = data.items.filter(i => safeNumber(i.quantity) > 0 && safeNumber(i.unitCost) > 0);
    if (!items.length) {
      showToast('Preencha pelo menos um item com quantidade e valor.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.post('/service-orders/purchase-quotations', {
        ...data,
        purchaseRequestId: Number(data.purchaseRequestId),
        supplierPersonId: Number(data.supplierPersonId),
        freightCost: safeNumber(data.freightCost),
        deliveryLeadTimeDays: Number(data.deliveryLeadTimeDays) || null,
        warrantyDays: Number(data.warrantyDays) || null,
        items: items.map(i => ({
          ...i,
          quantity: safeNumber(i.quantity),
          unitCost: safeNumber(i.unitCost),
          ipiValue: safeNumber(i.ipiValue),
          icmsValue: safeNumber(i.icmsValue),
          stValue: safeNumber(i.stValue),
          totalPaid: safeNumber(i.totalPaid)
        }))
      });
      showToast('Cotação enviada com sucesso!');
      reset();
      void fetchData();
    } catch (err) {
      showToast('Erro ao salvar cotação.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getQuotationTotal = useCallback((quotation: any) => {
    const itemsTotal = (quotation.items || []).reduce((acc: number, item: any) => {
      const subtotal = safeNumber(item.quantity) * safeNumber(item.unitCost);
      const taxes = safeNumber(item.ipiValue) + safeNumber(item.icmsValue) + safeNumber(item.stValue);
      return acc + subtotal + taxes;
    }, 0);
    return itemsTotal + safeNumber(quotation.freightCost);
  }, []);

  const summary = useMemo(() => {
    const items = watchedItems || [];
    const filledCount = items.filter(i => safeNumber(i.quantity) > 0 && safeNumber(i.unitCost) > 0).length;
    const totalItems = items.reduce((acc, i) => acc + (safeNumber(i.totalPaid) || (safeNumber(i.quantity) * safeNumber(i.unitCost))), 0);
    return {
      count: items.length,
      filled: filledCount,
      total: totalItems + safeNumber(watchedFreight)
    };
  }, [watchedItems, watchedFreight]);

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: 10, borderRadius: 12 }}>
            <FileText size={24} />
          </div>
          <div>
            <h2 className={styles.title} style={{ margin: 0 }}>Central de Cotações</h2>
            <p style={{ color: '#8a99a8', fontSize: 13, margin: 0 }}>Gestão de propostas e análise de melhor custo-benefício</p>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => void fetchData()}>
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      <div className={pageStyles.contentGrid}>
        {/* Formulário de Nova Cotação */}
        <div className={pageStyles.panelCard}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 18 }}>Nova Proposta</h3>
               <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ padding: '4px 12px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {summary.filled}/{summary.count} itens
                  </div>
                  <div style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {formatCurrency(summary.total)}
                  </div>
               </div>
            </div>

            <div className={pageStyles.twoColumnForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Solicitação (Requisição)</label>
                <select className={styles.searchInput} style={{ width: '100%' }} {...register('purchaseRequestId', { required: true })}>
                  <option value="">Selecione...</option>
                  {purchaseRequests.filter(r => r.status !== 'CLOSED').map(r => (
                    <option key={r.id} value={r.id}>{r.code} - {r.serviceOrder?.traceCode || 'Geral'}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Fornecedor</label>
                <select className={styles.searchInput} style={{ width: '100%' }} {...register('supplierPersonId', { required: true })}>
                  <option value="">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{getPersonName(p)}</option>)}
                </select>
              </div>
            </div>

            <div className={pageStyles.metaGrid} style={{ marginTop: 12 }}>
               <div className={styles.fieldGroup}>
                <label className={styles.label}>Frete</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className={styles.searchInput} style={{ width: 100 }} {...register('freightMode')}>
                    <option value="CIF">CIF</option>
                    <option value="FOB">FOB</option>
                  </select>
                  <input type="number" step="0.01" className={styles.searchInput} placeholder="R$ 0,00" {...register('freightCost')} />
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Entrega (dias)</label>
                <input type="number" className={styles.searchInput} {...register('deliveryLeadTimeDays')} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Validade</label>
                <input type="date" className={styles.searchInput} {...register('validUntil')} />
              </div>
            </div>

            <div className={pageStyles.itemsTableWrap} style={{ marginTop: 24 }}>
               <table className={pageStyles.itemsTable}>
                 <thead>
                   <tr>
                     <th style={{ width: '30%' }}>Material</th>
                     <th>Qtd Pendente</th>
                     <th>Custo Unit.</th>
                     <th>Impostos (R$)</th>
                     <th>Total Item</th>
                   </tr>
                 </thead>
                 <tbody>
                   {fields.map((field, index) => (
                     <tr key={field.id}>
                       <td>
                         <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{field.materialName}</div>
                         <div style={{ fontSize: 11, color: '#94a3b8' }}>Un: {field.unit} | Ref: {formatCurrency(field.priceReference)}</div>
                       </td>
                       <td>
                         <input type="number" step="0.01" className={styles.searchInput} style={{ width: 80 }} {...register(`items.${index}.quantity` as any, { onChange: () => handleCalcItemTotal(index) })} />
                       </td>
                       <td>
                         <input type="number" step="0.01" className={styles.searchInput} style={{ width: 100 }} {...register(`items.${index}.unitCost` as any, { onChange: () => handleCalcItemTotal(index) })} />
                       </td>
                       <td>
                         <div style={{ display: 'flex', gap: 4 }}>
                           <input type="number" step="0.01" placeholder="IPI" className={styles.searchInput} style={{ width: 60, fontSize: 11 }} {...register(`items.${index}.ipiValue` as any, { onChange: () => handleCalcItemTotal(index) })} />
                           <input type="number" step="0.01" placeholder="ICMS" className={styles.searchInput} style={{ width: 60, fontSize: 11 }} {...register(`items.${index}.icmsValue` as any, { onChange: () => handleCalcItemTotal(index) })} />
                         </div>
                       </td>
                       <td>
                         <input type="number" step="0.01" readOnly className={styles.searchInput} style={{ width: 110, background: 'rgba(255,255,255,0.02)', color: '#10b981', fontWeight: 800 }} {...register(`items.${index}.totalPaid` as any)} />
                       </td>
                     </tr>
                   ))}
                   {fields.length === 0 && (
                     <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Aguardando seleção de solicitação...</td></tr>
                   )}
                 </tbody>
               </table>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
               <button type="submit" disabled={saving || fields.length === 0} className={styles.submitBtn} style={{ width: 'auto', padding: '12px 40px' }}>
                  {saving ? 'Gravando...' : <><Save size={18} style={{ marginRight: 8 }} /> Salvar Cotação</>}
               </button>
            </div>
          </form>
        </div>

        {/* Listagem de Cotações e Comparativo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className={pageStyles.panelCard}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f1f5f9', fontSize: 16 }}>Análise de Propostas</h3>
            
            {loading ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                 {[1,2,3].map(i => <Skeleton key={i} height="80px" borderRadius="16px" />)}
               </div>
            ) : quotations.length === 0 ? (
               <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Nenhuma cotação para análise.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {quotations.map(q => {
                  const total = getQuotationTotal(q);
                  return (
                    <div key={q.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                         <div>
                            <div style={{ fontWeight: 800, color: '#f1f5f9' }}>{getPersonName(q.supplierPerson)}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>Ref: {q.purchaseRequest?.code}</div>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#10b981', fontWeight: 800 }}>{formatCurrency(total)}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{q.items?.length || 0} itens</div>
                         </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                         <button className={pageStyles.miniAction} onClick={() => window.open(api.defaults.baseURL + `/service-orders/purchase-quotations/${q.id}/pdf`)}>
                           <Printer size={14} /> PDF
                         </button>
                         {q.status === 'OPEN' && (
                           <button className={pageStyles.miniAction} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }} onClick={async () => {
                             if(window.confirm('Deseja aprovar esta cotação e gerar a compra?')) {
                               await api.post(`/service-orders/purchase-quotations/${q.id}/approve`, {});
                               showToast('Cotação aprovada!');
                               void fetchData();
                             }
                           }}>
                             <CheckCircle2 size={14} /> Aprovar
                           </button>
                         )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationsList;
