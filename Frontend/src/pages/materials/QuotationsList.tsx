import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';

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

const QuotationsList: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [form, setForm] = useState({
    purchaseRequestId: '',
    supplierPersonId: '',
    validUntil: '',
    notes: '',
  });
  const [itemInputs, setItemInputs] = useState<Record<number, { quantity: string; unitCost: string; totalPaid: string; notes: string }>>({});

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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedRequest = useMemo(() => {
    const requestId = Number(form.purchaseRequestId || 0);
    if (!requestId || !Number.isFinite(requestId)) return null;
    return purchaseRequests.find((request) => Number(request.id) === requestId) || null;
  }, [form.purchaseRequestId, purchaseRequests]);

  const pendingItems = useMemo(() => {
    const items = selectedRequest?.items || [];
    return items.filter((item: any) => Number(item.shortageQty || 0) > 0 && item.status !== 'PURCHASED');
  }, [selectedRequest]);

  useEffect(() => {
    if (!selectedRequest) {
      setItemInputs({});
      return;
    }

    const nextInputs: Record<number, { quantity: string; unitCost: string; totalPaid: string; notes: string }> = {};
    pendingItems.forEach((item: any) => {
      nextInputs[item.id] = {
        quantity: String(Number(item.shortageQty || 0)),
        unitCost: String(Number(item.material?.price || 0) || ''),
        totalPaid: '',
        notes: '',
      };
    });
    setItemInputs(nextInputs);
  }, [selectedRequest, pendingItems]);

  const handleItemInput = (itemId: number, field: 'quantity' | 'unitCost' | 'totalPaid' | 'notes', value: string) => {
    setItemInputs((prev) => ({
      ...prev,
      [itemId]: {
        quantity: prev[itemId]?.quantity || '',
        unitCost: prev[itemId]?.unitCost || '',
        totalPaid: prev[itemId]?.totalPaid || '',
        notes: prev[itemId]?.notes || '',
        [field]: value,
      }
    }));
  };

  const handleCreateQuotation = async () => {
    const purchaseRequestId = Number(form.purchaseRequestId || 0);
    const supplierPersonId = Number(form.supplierPersonId || 0);

    if (!purchaseRequestId || !supplierPersonId) {
      showToast('Selecione a solicitação e o fornecedor.', 'warning');
      return;
    }

    if (!pendingItems.length) {
      showToast('A solicitação não possui itens pendentes para cotação.', 'warning');
      return;
    }

    const payloadItems = pendingItems.map((item: any) => {
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
      return {
        purchaseRequestItemId: Number(item.id),
        quantity: Number(input.quantity || 0),
        unitCost: Number(input.unitCost || 0),
        totalPaid: input.totalPaid ? Number(input.totalPaid) : undefined,
        notes: input.notes || undefined,
      };
    }).filter((item: any) => item.quantity > 0 && item.unitCost > 0);

    if (!payloadItems.length) {
      showToast('Informe quantidade e custo unitário para os itens cotados.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await api.post('/service-orders/purchase-quotations', {
        purchaseRequestId,
        supplierPersonId,
        validUntil: form.validUntil || null,
        notes: form.notes || null,
        items: payloadItems,
      });

      showToast('Cotação registrada com sucesso.', 'success');
      setForm({ purchaseRequestId: '', supplierPersonId: '', validUntil: '', notes: '' });
      setItemInputs({});
      void fetchData();
    } catch (error: any) {
      showToast(String(error || 'Erro ao registrar cotação.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveQuotation = async (quotationId: number) => {
    setApprovingId(quotationId);
    try {
      await api.post(`/service-orders/purchase-quotations/${quotationId}/approve`, {});
      showToast('Cotação aprovada e compra registrada no estoque.', 'success');
      void fetchData();
    } catch (error: any) {
      showToast(String(error || 'Erro ao aprovar cotação.'), 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const openRequests = purchaseRequests.filter((request: any) => request.status !== 'CLOSED');

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: 10, borderRadius: 12 }}>
            <FileText size={24} />
          </div>
          <div>
            <h2 className={styles.title} style={{ margin: 0 }}>Central de Cotações</h2>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>Compare fornecedores por solicitação de compra e aprove a melhor proposta.</div>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => void fetchData()}>
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(2,6,23,0.35)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 18, padding: 16 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: 12 }}>Nova Cotação</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <select className={styles.searchInput} value={form.purchaseRequestId} onChange={(e) => setForm((prev) => ({ ...prev, purchaseRequestId: e.target.value }))}>
              <option value="">Selecione a solicitação</option>
              {openRequests.map((request: any) => (
                <option key={request.id} value={request.id}>{request.code} {request.serviceOrder?.traceCode ? `- ${request.serviceOrder.traceCode}` : ''}</option>
              ))}
            </select>

            <select className={styles.searchInput} value={form.supplierPersonId} onChange={(e) => setForm((prev) => ({ ...prev, supplierPersonId: e.target.value }))}>
              <option value="">Selecione o fornecedor</option>
              {people.map((person: any) => (
                <option key={person.id} value={person.id}>{getPersonName(person)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 12 }}>
            <input className={styles.searchInput} type="date" value={form.validUntil} onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))} />
            <input className={styles.searchInput} placeholder="Observações da cotação" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>

          {!selectedRequest ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Selecione uma solicitação para preencher os itens da cotação.</div>
          ) : pendingItems.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Esta solicitação não possui itens pendentes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {pendingItems.map((item: any) => {
                const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
                return (
                  <div key={item.id} style={{ border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 10, background: 'rgba(15,23,42,0.45)' }}>
                    <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>{item.material?.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Falta {Number(item.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} {item.unit || item.material?.unit || ''}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input className={styles.searchInput} type="number" min={0} step="0.01" value={input.quantity} onChange={(e) => handleItemInput(item.id, 'quantity', e.target.value)} placeholder="Qtd" />
                      <input className={styles.searchInput} type="number" min={0} step="0.01" value={input.unitCost} onChange={(e) => handleItemInput(item.id, 'unitCost', e.target.value)} placeholder="Custo unitário" />
                      <input className={styles.searchInput} type="number" min={0} step="0.01" value={input.totalPaid} onChange={(e) => handleItemInput(item.id, 'totalPaid', e.target.value)} placeholder="Total pago" />
                    </div>
                    <input className={styles.searchInput} value={input.notes} onChange={(e) => handleItemInput(item.id, 'notes', e.target.value)} placeholder="Observação do item" />
                  </div>
                );
              })}
            </div>
          )}

          <button
            className={styles.newBtn}
            type="button"
            onClick={() => void handleCreateQuotation()}
            disabled={saving}
            style={{ width: '100%', background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)' }}
          >
            {saving ? 'Salvando cotação...' : 'Registrar Cotação'}
          </button>
        </div>

        <div style={{ background: 'rgba(2,6,23,0.35)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 18, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Clock3 size={18} color="#f59e0b" />
            <strong style={{ color: '#e2e8f0' }}>Cotações Registradas</strong>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8' }}>Carregando cotações...</div>
          ) : quotations.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>Nenhuma cotação registrada.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '72vh', overflowY: 'auto' }}>
              {quotations.map((quotation: any) => {
                const total = (quotation.items || []).reduce((acc: number, item: any) => acc + Number(item.totalPaid || 0), 0);
                const requestStatus = quotation.purchaseRequest?.status || 'OPEN';
                return (
                  <div key={quotation.id} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 12, background: 'rgba(15,23,42,0.45)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{quotation.code}</div>
                      <span style={{ border: `1px solid ${quotationStatusColor[quotation.status] || '#64748b'}55`, background: `${quotationStatusColor[quotation.status] || '#64748b'}22`, color: quotationStatusColor[quotation.status] || '#cbd5e1', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{quotation.status}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Solicitação: {quotation.purchaseRequest?.code || '-'} | Status OS compra: <span style={{ color: requestStatusColor[requestStatus] || '#94a3b8' }}>{requestStatus}</span></div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Fornecedor: {getPersonName(quotation.supplierPerson)}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Itens: {(quotation.items || []).length}</div>
                    <div style={{ color: '#86efac', fontWeight: 800, marginTop: 6 }}>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>

                    {quotation.status === 'OPEN' && (
                      <button
                        type="button"
                        className={styles.newBtn}
                        onClick={() => void handleApproveQuotation(Number(quotation.id))}
                        disabled={approvingId === quotation.id}
                        style={{ marginTop: 10, width: '100%', background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}
                      >
                        <CheckCircle2 size={16} /> {approvingId === quotation.id ? 'Aprovando...' : 'Aprovar e gerar compra'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotationsList;
