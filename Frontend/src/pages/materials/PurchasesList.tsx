import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { ShoppingCart, RefreshCw, Filter, CheckCircle2, Clock3, FileDown, Sheet } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';

const requestStatusColor: Record<string, string> = {
  OPEN: '#f59e0b',
  PARTIAL: '#38bdf8',
  CLOSED: '#10b981',
};

const PurchasesList: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingRequestId, setSavingRequestId] = useState<number | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    supplierPersonId: '',
    status: '',
  });
  const [supplierByRequest, setSupplierByRequest] = useState<Record<number, string>>({});
  const [itemInputs, setItemInputs] = useState<Record<number, { quantity: string; unitCost: string; totalPaid: string }>>({});

  const getPersonName = (person: any) => {
    if (!person) return '-';
    return person.naturalPerson?.name || person.legalPerson?.corporateName || '-';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const purchaseRequestParams = new URLSearchParams();
      const purchaseHistoryParams = new URLSearchParams();

      if (filters.startDate) {
        purchaseRequestParams.set('startDate', filters.startDate);
        purchaseHistoryParams.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        purchaseRequestParams.set('endDate', filters.endDate);
        purchaseHistoryParams.set('endDate', filters.endDate);
      }
      if (filters.status) {
        purchaseRequestParams.set('status', filters.status);
      }
      if (filters.supplierPersonId) {
        purchaseHistoryParams.set('supplierPersonId', filters.supplierPersonId);
      }

      const [requestsData, historyData, peopleData] = await Promise.all([
        api.get(`/service-orders/purchase-requests${purchaseRequestParams.toString() ? `?${purchaseRequestParams.toString()}` : ''}`),
        api.get(`/stock/purchases${purchaseHistoryParams.toString() ? `?${purchaseHistoryParams.toString()}` : ''}`),
        api.get('/people'),
      ]);

      setPurchaseRequests(Array.isArray(requestsData) ? requestsData : []);
      setPurchaseHistory(Array.isArray(historyData) ? historyData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch {
      showToast('Erro ao carregar central de compras.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('start', filters.startDate);
    if (filters.endDate) params.set('end', filters.endDate);
    if (filters.status) params.set('status', filters.status);
    if (filters.supplierPersonId) params.set('supplierPersonId', filters.supplierPersonId);
    return params.toString();
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const query = buildQueryString();
      const token = localStorage.getItem('token');
      const baseURL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3001/v1' : '/v1');
      const response = await axios.get(`${baseURL}/reports/operational/purchases/pdf${query ? `?${query}` : ''}`, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      downloadBlob(response.data, 'relatorio_compras.pdf');
    } catch {
      showToast('Erro ao exportar PDF do relatório de compras.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportXlsx = () => {
    const summaryRows = [
      { Indicador: 'Solicitações totais', Valor: purchaseRequests.length },
      { Indicador: 'Solicitações abertas/parciais', Valor: purchaseRequests.filter((request) => request.status !== 'CLOSED').length },
      { Indicador: 'Compras registradas', Valor: purchaseHistory.length },
      { Indicador: 'Valor total comprado', Valor: purchaseHistory.reduce((acc, log) => acc + Number(log.totalPaid || 0), 0) },
      { Indicador: 'Período inicial', Valor: filters.startDate || '-' },
      { Indicador: 'Período final', Valor: filters.endDate || '-' },
      { Indicador: 'Status filtrado', Valor: filters.status || 'Todos' },
      { Indicador: 'Fornecedor filtrado', Valor: people.find((person) => String(person.id) === filters.supplierPersonId)?.naturalPerson?.name || people.find((person) => String(person.id) === filters.supplierPersonId)?.legalPerson?.corporateName || 'Todos' },
    ];

    const requestRows = purchaseRequests.flatMap((request) =>
      (request.items || []).map((item: any) => ({
        Codigo: request.code,
        Status: request.status,
        OS: request.serviceOrder?.traceCode || '',
        DescricaoOS: request.serviceOrder?.description || '',
        Material: item.material?.name || '',
        QuantidadeSolicitada: Number(item.requestedQty || 0),
        QuantidadeEmFalta: Number(item.shortageQty || 0),
        Unidade: item.unit || item.material?.unit || '',
        StatusItem: item.status,
        DataCriacao: new Date(request.createdAt).toLocaleString('pt-BR'),
      }))
    );

    const historyRows = purchaseHistory.map((log) => ({
      Material: log.material?.name || '',
      Fornecedor: log.supplierName || getPersonName(log.supplierPerson),
      Quantidade: Number(log.quantity || 0),
      Unidade: log.material?.unit || '',
      CustoUnitario: Number(log.unitCost || 0),
      TotalPago: Number(log.totalPaid || 0),
      DataCompra: new Date(log.createdAt).toLocaleString('pt-BR'),
      Observacao: log.description || '',
    }));

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const requestsSheet = XLSX.utils.json_to_sheet(requestRows);
    const historySheet = XLSX.utils.json_to_sheet(historyRows);
    summarySheet['!cols'] = [{ wch: 28 }, { wch: 24 }];
    requestsSheet['!cols'] = [
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 36 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
      { wch: 22 },
    ];
    historySheet['!cols'] = [
      { wch: 28 },
      { wch: 30 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
    XLSX.utils.book_append_sheet(workbook, requestsSheet, 'Solicitacoes');
    XLSX.utils.book_append_sheet(workbook, historySheet, 'Compras');
    XLSX.writeFile(workbook, 'relatorio_compras.xlsx');
  };

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleItemInputChange = (itemId: number, field: 'quantity' | 'unitCost' | 'totalPaid', value: string) => {
    setItemInputs((prev) => ({
      ...prev,
      [itemId]: {
        quantity: prev[itemId]?.quantity || '',
        unitCost: prev[itemId]?.unitCost || '',
        totalPaid: prev[itemId]?.totalPaid || '',
        [field]: value,
      }
    }));
  };

  const handleFulfillRequest = async (request: any) => {
    const requestId = Number(request.id);
    const supplierPersonId = Number(supplierByRequest[requestId] || 0);
    if (!supplierPersonId || !Number.isFinite(supplierPersonId) || supplierPersonId <= 0) {
      showToast('Selecione o fornecedor para registrar a compra.', 'warning');
      return;
    }

    const pendingItems = (request.items || []).filter((item: any) => Number(item.shortageQty || 0) > 0 && item.status !== 'PURCHASED');
    if (!pendingItems.length) {
      showToast('Não há itens pendentes nesta solicitação.', 'warning');
      return;
    }

    const payloadItems = pendingItems.map((item: any) => {
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '' };
      const quantity = input.quantity ? Number(input.quantity) : Number(item.shortageQty || 0);
      const unitCost = input.unitCost ? Number(input.unitCost) : undefined;
      const totalPaid = input.totalPaid ? Number(input.totalPaid) : undefined;
      return {
        purchaseRequestItemId: Number(item.id),
        quantity,
        unitCost,
        totalPaid,
      };
    });

    const invalid = payloadItems.some((item: any) => !Number.isFinite(item.quantity) || item.quantity <= 0 || ((!item.unitCost || item.unitCost <= 0) && (!item.totalPaid || item.totalPaid <= 0)));
    if (invalid) {
      showToast('Informe quantidade e custo unitário ou total pago para os itens pendentes.', 'warning');
      return;
    }

    setSavingRequestId(requestId);
    try {
      await api.post(`/service-orders/purchase-requests/${requestId}/fulfill`, {
        supplierPersonId,
        description: `Compra registrada na Central de Compras para ${request.code}`,
        items: payloadItems,
      });
      showToast(`Compra da solicitação ${request.code} registrada.`, 'success');
      void fetchData();
    } catch {
      showToast('Erro ao registrar compra da solicitação.', 'error');
    } finally {
      setSavingRequestId(null);
    }
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: 10, borderRadius: 12 }}>
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className={styles.title} style={{ margin: 0 }}>Central de Compras</h2>
            <div style={{ color: '#94a3b8', marginTop: 6 }}>Solicitações pendentes e histórico de compras em uma única operação.</div>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => void fetchData()}>
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className={styles.newBtn} type="button" onClick={handleExportXlsx} style={{ background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)' }}>
          <Sheet size={18} /> Exportar XLSX
        </button>
        <button className={styles.newBtn} type="button" onClick={() => void handleExportPdf()} disabled={exportingPdf} style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}>
          <FileDown size={18} /> {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
        </button>
      </div>

      <div style={{
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 18,
        padding: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontWeight: 800 }}>
          <Filter size={16} /> Filtros da Central
        </div>
        <input type="date" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} value={filters.startDate} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
        <input type="date" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} value={filters.endDate} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
        <select className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} value={filters.supplierPersonId} onChange={(e) => setFilters((prev) => ({ ...prev, supplierPersonId: e.target.value }))}>
          <option value="">Todos os fornecedores</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{getPersonName(person)}</option>
          ))}
        </select>
        <select className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">Todos os status</option>
          <option value="OPEN">Abertas</option>
          <option value="PARTIAL">Parciais</option>
          <option value="CLOSED">Fechadas</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ background: 'rgba(2,6,23,0.35)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 18, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Clock3 size={18} color="#f59e0b" />
            <strong style={{ color: '#e2e8f0' }}>Solicitações de Compra</strong>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8' }}>Carregando solicitações...</div>
          ) : purchaseRequests.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>Nenhuma solicitação encontrada para os filtros atuais.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {purchaseRequests.map((request) => {
                const pendingItems = (request.items || []).filter((item: any) => Number(item.shortageQty || 0) > 0 && item.status !== 'PURCHASED');
                return (
                  <div key={request.id} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 12, background: 'rgba(15,23,42,0.45)' }}>
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

                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
                      Criada em {new Date(request.createdAt).toLocaleString('pt-BR')}
                    </div>

                    {pendingItems.length === 0 ? (
                      <div style={{ color: '#86efac', fontSize: 12 }}>Todos os itens desta solicitação já foram comprados.</div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 10 }}>
                          <select
                            className={styles.searchInput}
                            style={{ minWidth: 'unset', width: '100%' }}
                            value={supplierByRequest[request.id] || ''}
                            onChange={(e) => setSupplierByRequest((prev) => ({ ...prev, [request.id]: e.target.value }))}
                          >
                            <option value="">Selecione o fornecedor</option>
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>{getPersonName(person)}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                          {pendingItems.map((item: any) => {
                            const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '' };
                            return (
                              <div key={item.id} style={{ background: 'rgba(2,6,23,0.45)', borderRadius: 10, padding: 10 }}>
                                <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 6 }}>
                                  {item.material?.name}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                                  Falta {Number(item.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} {item.unit || item.material?.unit || ''}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                  <input type="number" min={0} step="0.01" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} placeholder="Quantidade" value={input.quantity} onChange={(e) => handleItemInputChange(item.id, 'quantity', e.target.value)} />
                                  <input type="number" min={0} step="0.01" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} placeholder="Custo unitário" value={input.unitCost} onChange={(e) => handleItemInputChange(item.id, 'unitCost', e.target.value)} />
                                  <input type="number" min={0} step="0.01" className={styles.searchInput} style={{ minWidth: 'unset', width: '100%' }} placeholder="Total pago" value={input.totalPaid} onChange={(e) => handleItemInputChange(item.id, 'totalPaid', e.target.value)} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleFulfillRequest(request)}
                          disabled={savingRequestId === request.id}
                          style={{
                            width: '100%',
                            border: '1px solid rgba(16,185,129,0.35)',
                            background: 'rgba(16,185,129,0.14)',
                            color: '#86efac',
                            borderRadius: 12,
                            padding: '12px 14px',
                            cursor: 'pointer',
                            fontWeight: 800,
                          }}
                        >
                          {savingRequestId === request.id ? 'Registrando compra...' : 'Registrar compra e dar entrada no estoque'}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'rgba(2,6,23,0.35)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 18, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <CheckCircle2 size={18} color="#10b981" />
            <strong style={{ color: '#e2e8f0' }}>Histórico de Compras</strong>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8' }}>Carregando histórico...</div>
          ) : purchaseHistory.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>Nenhuma compra encontrada para os filtros atuais.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {purchaseHistory.map((log) => (
                <div key={log.id} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 12, background: 'rgba(15,23,42,0.45)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ color: '#fff', fontWeight: 800 }}>{log.material?.name}</div>
                    <div style={{ color: '#86efac', fontWeight: 800 }}>
                      {Number(log.totalPaid || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Fornecedor: {log.supplierName || getPersonName(log.supplierPerson)}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Quantidade: {Number(log.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} {log.material?.unit || ''}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Custo unitário: {Number(log.unitCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchasesList;
