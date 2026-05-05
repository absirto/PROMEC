import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, RefreshCw, Search, WandSparkles } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import pageStyles from './QuotationsList.module.css';
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

type ItemInput = {
  quantity: string;
  unitCost: string;
  totalPaid: string;
  notes: string;
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
  const [itemInputs, setItemInputs] = useState<Record<number, ItemInput>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkUnitCost, setBulkUnitCost] = useState('');

  const pageSize = 20;

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

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    return pendingItems.filter((item: any) => {
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
      const isFilled = Number(input.quantity || 0) > 0 && Number(input.unitCost || 0) > 0;
      if (onlyFilled && !isFilled) return false;
      if (!query) return true;
      const name = String(item.material?.name || '').toLowerCase();
      const unit = String(item.unit || item.material?.unit || '').toLowerCase();
      return name.includes(query) || unit.includes(query) || String(item.id).includes(query);
    });
  }, [pendingItems, itemInputs, itemSearch, onlyFilled]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  useEffect(() => {
    if (!selectedRequest) {
      setItemInputs({});
      setItemSearch('');
      setOnlyFilled(false);
      setPage(1);
      return;
    }

    const nextInputs: Record<number, ItemInput> = {};
    pendingItems.forEach((item: any) => {
      nextInputs[item.id] = {
        quantity: String(Number(item.shortageQty || 0)),
        unitCost: String(Number(item.material?.price || 0) || ''),
        totalPaid: '',
        notes: '',
      };
    });
    setItemInputs(nextInputs);
    setPage(1);
  }, [selectedRequest, pendingItems]);

  const handleItemInput = (itemId: number, field: keyof ItemInput, value: string) => {
    setItemInputs((prev) => {
      const current = prev[itemId] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
      const next = { ...current, [field]: value };

      if ((field === 'quantity' || field === 'unitCost') && !next.totalPaid) {
        const qty = Number(next.quantity || 0);
        const cost = Number(next.unitCost || 0);
        if (qty > 0 && cost > 0) {
          next.totalPaid = String((qty * cost).toFixed(2));
        }
      }

      return { ...prev, [itemId]: next };
    });
  };

  const applyBulkUnitCost = () => {
    const value = Number(bulkUnitCost || 0);
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Informe um custo unitário válido para aplicar em massa.', 'warning');
      return;
    }

    setItemInputs((prev) => {
      const next = { ...prev };
      filteredItems.forEach((item: any) => {
        const current = next[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
        const quantity = Number(current.quantity || 0);
        next[item.id] = {
          ...current,
          unitCost: String(value),
          totalPaid: quantity > 0 ? String((quantity * value).toFixed(2)) : current.totalPaid,
        };
      });
      return next;
    });

    showToast(`Custo aplicado em ${filteredItems.length} item(ns) filtrado(s).`, 'success');
  };

  const autoFillFromCurrentPrice = () => {
    setItemInputs((prev) => {
      const next = { ...prev };
      filteredItems.forEach((item: any) => {
        const current = next[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
        const materialPrice = Number(item.material?.price || 0);
        if (materialPrice <= 0) return;
        const quantity = Number(current.quantity || 0);
        next[item.id] = {
          ...current,
          unitCost: String(materialPrice),
          totalPaid: quantity > 0 ? String((quantity * materialPrice).toFixed(2)) : current.totalPaid,
        };
      });
      return next;
    });
    showToast('Preços atuais dos materiais aplicados nos itens filtrados.', 'success');
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
      const quantity = Number(input.quantity || 0);
      const unitCost = Number(input.unitCost || 0);
      const totalPaid = input.totalPaid ? Number(input.totalPaid) : undefined;
      return {
        purchaseRequestItemId: Number(item.id),
        quantity,
        unitCost,
        totalPaid,
        notes: input.notes || undefined,
      };
    }).filter((item: any) => item.quantity > 0 && item.unitCost > 0);

    if (!payloadItems.length) {
      showToast('Preencha pelo menos 1 item com quantidade e custo unitário.', 'warning');
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

      showToast(`Cotação registrada com ${payloadItems.length} item(ns).`, 'success');
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

  const summary = useMemo(() => {
    const all = pendingItems.map((item: any) => {
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
      const quantity = Number(input.quantity || 0);
      const totalPaid = input.totalPaid ? Number(input.totalPaid) : quantity * Number(input.unitCost || 0);
      return {
        quantity: Number.isFinite(quantity) ? quantity : 0,
        totalPaid: Number.isFinite(totalPaid) ? totalPaid : 0,
        filled: quantity > 0 && Number(input.unitCost || 0) > 0,
      };
    });

    return {
      itemsCount: pendingItems.length,
      filledCount: all.filter((i: { filled: boolean }) => i.filled).length,
      totalQty: all.reduce((acc: number, i: { quantity: number }) => acc + i.quantity, 0),
      totalValue: all.reduce((acc: number, i: { totalPaid: number }) => acc + i.totalPaid, 0),
    };
  }, [pendingItems, itemInputs]);

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: 10, borderRadius: 12 }}>
            <FileText size={24} />
          </div>
          <div>
            <h2 className={styles.title} style={{ margin: 0 }}>Central de Cotações</h2>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>Preparada para volume alto: filtre, preencha em massa e aprove a melhor proposta.</div>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => void fetchData()}>
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      <div className={pageStyles.contentGrid}>
        <div className={pageStyles.panelCard}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: 12 }}>Nova Cotação</div>

          <div className={pageStyles.twoColumnForm}>
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

          <div className={pageStyles.metaGrid}>
            <input className={styles.searchInput} type="date" value={form.validUntil} onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))} />
            <input className={styles.searchInput} placeholder="Observações gerais da cotação" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>

          {!selectedRequest ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Selecione uma solicitação para iniciar a cotação.</div>
          ) : pendingItems.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Esta solicitação não possui itens pendentes.</div>
          ) : (
            <>
              <div className={pageStyles.actionsToolbar}>
                <div className={pageStyles.searchFieldWrap}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#64748b' }} />
                  <input
                    className={styles.searchInput}
                    style={{ paddingLeft: 30 }}
                    placeholder="Buscar item por nome/unidade/id..."
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                <div className={pageStyles.bulkControlsWrap}>
                  <input
                    className={styles.searchInput}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Custo em massa"
                    value={bulkUnitCost}
                    onChange={(e) => setBulkUnitCost(e.target.value)}
                  />
                  <button className={styles.newBtn} type="button" onClick={applyBulkUnitCost} style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
                    Aplicar
                  </button>
                  <button className={styles.newBtn} type="button" onClick={autoFillFromCurrentPrice} style={{ background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)' }}>
                    <WandSparkles size={16} /> Preço atual
                  </button>
                  <label className={pageStyles.onlyFilledToggle}>
                    <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} />
                    Somente preenchidos
                  </label>
                </div>
              </div>

              <div className={pageStyles.summaryGrid}>
                <div style={{ background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 10, padding: 8 }}>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Itens pendentes</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 800 }}>{summary.itemsCount}</div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 10, padding: 8 }}>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Itens preenchidos</div>
                  <div style={{ color: '#86efac', fontWeight: 800 }}>{summary.filledCount}</div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 10, padding: 8 }}>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Quantidade cotada</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 800 }}>{summary.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 10, padding: 8 }}>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Valor estimado</div>
                  <div style={{ color: '#86efac', fontWeight: 800 }}>{summary.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
              </div>

              <div className={pageStyles.tableShell}>
                <div className={pageStyles.tableScroll}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Material</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Falta</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Qtd</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Unit.</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Total</th>
                        <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map((item: any) => {
                        const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '', notes: '' };
                        return (
                          <tr key={item.id}>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)', color: '#e2e8f0' }}>
                              <div style={{ fontWeight: 700 }}>{item.material?.name}</div>
                              <div style={{ color: '#64748b', fontSize: 11 }}>{item.unit || item.material?.unit || ''}</div>
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)', color: '#cbd5e1', textAlign: 'right' }}>
                              {Number(item.shortageQty || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <input className={`${styles.searchInput} ${pageStyles.tableInputSm}`} type="number" min={0} step="0.01" value={input.quantity} onChange={(e) => handleItemInput(item.id, 'quantity', e.target.value)} />
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <input className={`${styles.searchInput} ${pageStyles.tableInputMd}`} type="number" min={0} step="0.01" value={input.unitCost} onChange={(e) => handleItemInput(item.id, 'unitCost', e.target.value)} />
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <input className={`${styles.searchInput} ${pageStyles.tableInputMd}`} type="number" min={0} step="0.01" value={input.totalPaid} onChange={(e) => handleItemInput(item.id, 'totalPaid', e.target.value)} />
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <input className={`${styles.searchInput} ${pageStyles.tableInputLg}`} value={input.notes} onChange={(e) => handleItemInput(item.id, 'notes', e.target.value)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={pageStyles.paginationRow}>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  Exibindo {pagedItems.length} de {filteredItems.length} item(ns) filtrado(s) - pagina {page}/{totalPages}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={styles.newBtn} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>Anterior</button>
                  <button className={styles.newBtn} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>Próxima</button>
                </div>
              </div>
            </>
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

        <div className={pageStyles.panelCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Clock3 size={18} color="#f59e0b" />
            <strong style={{ color: '#e2e8f0' }}>Cotações Registradas</strong>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8' }}>Carregando cotações...</div>
          ) : quotations.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>Nenhuma cotação registrada.</div>
          ) : (
            <div className={pageStyles.historyScroll}>
              {quotations.map((quotation: any) => {
                const total = (quotation.items || []).reduce((acc: number, item: any) => acc + Number(item.totalPaid || 0), 0);
                const requestStatus = quotation.purchaseRequest?.status || 'OPEN';
                return (
                  <div key={quotation.id} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 12, background: 'rgba(15,23,42,0.45)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <div style={{ color: '#fff', fontWeight: 800 }}>{quotation.code}</div>
                      <span style={{ border: `1px solid ${quotationStatusColor[quotation.status] || '#64748b'}55`, background: `${quotationStatusColor[quotation.status] || '#64748b'}22`, color: quotationStatusColor[quotation.status] || '#cbd5e1', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{quotation.status}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Solicitação: {quotation.purchaseRequest?.code || '-'} | Status compra: <span style={{ color: requestStatusColor[requestStatus] || '#94a3b8' }}>{requestStatus}</span></div>
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
