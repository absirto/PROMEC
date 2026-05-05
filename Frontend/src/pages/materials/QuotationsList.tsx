import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
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
  ipiValue: string;
  icmsValue: string;
  stValue: string;
  totalPaid: string;
  notes: string;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: unknown) => safeNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatNumber = (value: unknown) => safeNumber(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const formatDate = (value: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const formatDateTime = (value: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const formatFreightMode = (value: unknown) => {
  const mode = String(value || '').toUpperCase();
  if (mode === 'CIF') return 'CIF';
  if (mode === 'FOB') return 'FOB';
  if (mode === 'PICKUP') return 'Retirada';
  if (mode === 'NONE') return 'Sem frete';
  return mode || '-';
};

const getItemTaxTotal = (item: Partial<ItemInput> | any) => {
  return safeNumber(item?.ipiValue) + safeNumber(item?.icmsValue) + safeNumber(item?.stValue);
};

const getDraftItemSubtotal = (item: Partial<ItemInput> | any) => {
  return safeNumber(item?.quantity) * safeNumber(item?.unitCost);
};

const getDraftItemTotal = (item: Partial<ItemInput> | any) => {
  return getDraftItemSubtotal(item) + getItemTaxTotal(item);
};

const getVariationMeta = (referenceValue: unknown, quoteValue: unknown) => {
  const reference = safeNumber(referenceValue);
  const current = safeNumber(quoteValue);

  if (reference <= 0 || current <= 0) {
    return {
      label: 'Sem histórico',
      tone: '#64748b',
      direction: 'neutral' as const,
    };
  }

  const delta = ((current - reference) / reference) * 100;
  if (Math.abs(delta) < 0.5) {
    return {
      label: 'Em linha',
      tone: '#38bdf8',
      direction: 'neutral' as const,
    };
  }

  if (delta < 0) {
    return {
      label: `${Math.abs(delta).toFixed(1)}% abaixo`,
      tone: '#10b981',
      direction: 'down' as const,
    };
  }

  return {
    label: `${delta.toFixed(1)}% acima`,
    tone: '#f97316',
    direction: 'up' as const,
  };
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
    paymentTerms: '',
    freightMode: 'CIF',
    freightCost: '',
    deliveryLeadTimeDays: '',
    warrantyDays: '',
    notes: '',
  });
  const [itemInputs, setItemInputs] = useState<Record<number, ItemInput>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkUnitCost, setBulkUnitCost] = useState('');
  const [comparisonRequestId, setComparisonRequestId] = useState<number | null>(null);

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
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
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
        ipiValue: '',
        icmsValue: '',
        stValue: '',
        totalPaid: '',
        notes: '',
      };
    });
    setItemInputs(nextInputs);
    setPage(1);
  }, [selectedRequest, pendingItems]);

  const handleItemInput = (itemId: number, field: keyof ItemInput, value: string) => {
    setItemInputs((prev) => {
      const current = prev[itemId] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
      const next = { ...current, [field]: value };

      if (field !== 'notes' && field !== 'totalPaid') {
        const qty = Number(next.quantity || 0);
        const cost = Number(next.unitCost || 0);
        if (qty > 0 && cost > 0) {
          next.totalPaid = String(getDraftItemTotal(next).toFixed(2));
        } else {
          next.totalPaid = '';
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
        const current = next[item.id] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
        const updatedDraft = { ...current, unitCost: String(value) };
        next[item.id] = {
          ...updatedDraft,
          unitCost: String(value),
          totalPaid: safeNumber(current.quantity) > 0 ? String(getDraftItemTotal(updatedDraft).toFixed(2)) : current.totalPaid,
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
        const current = next[item.id] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
        const materialPrice = Number(item.material?.price || 0);
        if (materialPrice <= 0) return;
        next[item.id] = {
          ...current,
          unitCost: String(materialPrice),
          totalPaid: safeNumber(current.quantity) > 0 ? String(getDraftItemTotal({ ...current, unitCost: String(materialPrice) }).toFixed(2)) : current.totalPaid,
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
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
      const quantity = Number(input.quantity || 0);
      const unitCost = Number(input.unitCost || 0);
      const totalPaid = input.totalPaid ? Number(input.totalPaid) : undefined;
      return {
        purchaseRequestItemId: Number(item.id),
        quantity,
        unitCost,
        ipiValue: safeNumber(input.ipiValue),
        icmsValue: safeNumber(input.icmsValue),
        stValue: safeNumber(input.stValue),
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
        paymentTerms: form.paymentTerms || null,
        freightMode: form.freightMode || null,
        freightCost: form.freightCost ? safeNumber(form.freightCost) : null,
        deliveryLeadTimeDays: form.deliveryLeadTimeDays ? Math.round(safeNumber(form.deliveryLeadTimeDays)) : null,
        warrantyDays: form.warrantyDays ? Math.round(safeNumber(form.warrantyDays)) : null,
        notes: form.notes || null,
        items: payloadItems,
      });

      showToast(`Cotação registrada com ${payloadItems.length} item(ns).`, 'success');
      setForm({ purchaseRequestId: '', supplierPersonId: '', validUntil: '', paymentTerms: '', freightMode: 'CIF', freightCost: '', deliveryLeadTimeDays: '', warrantyDays: '', notes: '' });
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

  const getQuotationTaxesTotal = useCallback((quotation: any) => {
    return (quotation.items || []).reduce((acc: number, item: any) => acc + getItemTaxTotal(item), 0);
  }, []);

  const getQuotationTotal = useCallback((quotation: any) => {
    const itemsTotal = (quotation.items || []).reduce((acc: number, item: any) => {
      const subtotal = safeNumber(item.quantity) * safeNumber(item.unitCost);
      const taxes = getItemTaxTotal(item);
      return acc + (taxes > 0 ? subtotal + taxes : safeNumber(item.totalPaid || subtotal));
    }, 0);

    return itemsTotal + safeNumber(quotation.freightCost);
  }, []);

  const quotationOverview = useMemo(() => {
    const totals = quotations.map((quotation: any) => ({
      id: Number(quotation.id),
      total: getQuotationTotal(quotation),
      validUntil: quotation.validUntil,
      status: String(quotation.status || 'OPEN'),
    }));

    const bestOpen = totals
      .filter((quotation) => quotation.status === 'OPEN' && quotation.total > 0)
      .sort((left, right) => left.total - right.total)[0] || null;

    const nextExpiry = totals
      .filter((quotation) => quotation.status === 'OPEN' && quotation.validUntil)
      .sort((left, right) => new Date(String(left.validUntil)).getTime() - new Date(String(right.validUntil)).getTime())[0] || null;

    return {
      count: totals.length,
      openCount: totals.filter((quotation) => quotation.status === 'OPEN').length,
      approvedCount: totals.filter((quotation) => quotation.status === 'APPROVED').length,
      totalQuoted: totals.reduce((acc, quotation) => acc + quotation.total, 0),
      bestOpen,
      nextExpiry,
    };
  }, [getQuotationTotal, quotations]);

  const comparisonGroups = useMemo(() => {
    const grouped = new Map<number, { requestId: number; request: any; quotations: any[]; latestAt: number }>();

    quotations.forEach((quotation: any) => {
      const requestId = Number(quotation.purchaseRequest?.id || quotation.purchaseRequestId || 0);
      if (!requestId) return;

      const current = grouped.get(requestId);
      const createdAt = new Date(String(quotation.createdAt || 0)).getTime();
      if (!current) {
        grouped.set(requestId, {
          requestId,
          request: quotation.purchaseRequest || null,
          quotations: [quotation],
          latestAt: createdAt,
        });
        return;
      }

      current.quotations.push(quotation);
      current.latestAt = Math.max(current.latestAt, createdAt);
      if (!current.request && quotation.purchaseRequest) {
        current.request = quotation.purchaseRequest;
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        quotations: group.quotations.sort((left, right) => getQuotationTotal(left) - getQuotationTotal(right)),
      }))
      .sort((left, right) => right.latestAt - left.latestAt);
  }, [getQuotationTotal, quotations]);

  useEffect(() => {
    if (!comparisonGroups.length) {
      setComparisonRequestId(null);
      return;
    }

    const hasCurrent = comparisonGroups.some((group) => group.requestId === comparisonRequestId);
    if (!hasCurrent) {
      setComparisonRequestId(comparisonGroups[0].requestId);
    }
  }, [comparisonGroups, comparisonRequestId]);

  useEffect(() => {
    const requestId = Number(form.purchaseRequestId || 0);
    if (requestId && comparisonGroups.some((group) => group.requestId === requestId)) {
      setComparisonRequestId(requestId);
    }
  }, [comparisonGroups, form.purchaseRequestId]);

  const comparisonGroup = useMemo(() => {
    if (!comparisonRequestId) return null;
    return comparisonGroups.find((group) => group.requestId === comparisonRequestId) || null;
  }, [comparisonGroups, comparisonRequestId]);

  const comparisonQuotations = useMemo(() => comparisonGroup?.quotations || [], [comparisonGroup]);

  const comparisonBestQuotation = useMemo(() => {
    return comparisonQuotations
      .filter((quotation: any) => safeNumber(getQuotationTotal(quotation)) > 0)
      .sort((left: any, right: any) => getQuotationTotal(left) - getQuotationTotal(right))[0] || null;
  }, [comparisonQuotations, getQuotationTotal]);

  const comparisonItems = useMemo(() => {
    const rows = new Map<number, any>();
    const requestItems = comparisonGroup?.request?.items || [];

    requestItems.forEach((item: any) => {
      rows.set(Number(item.id), {
        id: Number(item.id),
        materialName: item.material?.name || 'Material sem nome',
        unit: item.unit || item.material?.unit || '-',
        shortageQty: safeNumber(item.shortageQty || item.requestedQty),
        requestedQty: safeNumber(item.requestedQty),
        referenceUnitCost: safeNumber(item.material?.price),
        quotesByQuotationId: {},
      });
    });

    comparisonQuotations.forEach((quotation: any) => {
      (quotation.items || []).forEach((item: any) => {
        const rowId = Number(item.purchaseRequestItemId || item.purchaseRequestItem?.id || item.id);
        if (!rowId) return;

        if (!rows.has(rowId)) {
          rows.set(rowId, {
            id: rowId,
            materialName: item.material?.name || 'Material sem nome',
            unit: item.purchaseRequestItem?.unit || item.material?.unit || '-',
            shortageQty: safeNumber(item.purchaseRequestItem?.shortageQty || item.quantity),
            requestedQty: safeNumber(item.purchaseRequestItem?.requestedQty || item.quantity),
            referenceUnitCost: safeNumber(item.material?.price),
            quotesByQuotationId: {},
          });
        }

        const current = rows.get(rowId);
        current.quotesByQuotationId[quotation.id] = item;
      });
    });

    return Array.from(rows.values()).sort((left, right) => left.materialName.localeCompare(right.materialName, 'pt-BR'));
  }, [comparisonGroup, comparisonQuotations]);

  const requestContext = useMemo(() => {
    if (!selectedRequest) return null;

    return {
      code: selectedRequest.code || '-',
      traceCode: selectedRequest.serviceOrder?.traceCode || '-',
      description: selectedRequest.serviceOrder?.description || 'Sem descrição técnica vinculada.',
      status: selectedRequest.status || 'OPEN',
      createdAt: selectedRequest.createdAt,
      requestedByEmail: selectedRequest.requestedByEmail || '-',
      itemsCount: (selectedRequest.items || []).length,
    };
  }, [selectedRequest]);

  const comparisonText = useMemo(() => {
    if (!comparisonGroup) return '';

    const lines = [
      `Comparativo da solicitação ${comparisonGroup.request?.code || comparisonGroup.requestId}`,
      `OS/Trace: ${comparisonGroup.request?.serviceOrder?.traceCode || '-'}`,
      `Total de propostas: ${comparisonQuotations.length}`,
    ];

    comparisonQuotations.forEach((quotation: any, index: number) => {
      lines.push(`${index + 1}. ${getPersonName(quotation.supplierPerson)} | ${quotation.code} | ${formatCurrency(getQuotationTotal(quotation))} | prazo ${quotation.deliveryLeadTimeDays ? `${quotation.deliveryLeadTimeDays} dia(s)` : '-'} | pagamento ${quotation.paymentTerms || '-'} | frete ${formatFreightMode(quotation.freightMode)} ${safeNumber(quotation.freightCost) > 0 ? `(${formatCurrency(quotation.freightCost)})` : ''} | validade ${formatDate(quotation.validUntil)}`);
    });

    return lines.join('\n');
  }, [comparisonGroup, comparisonQuotations, getQuotationTotal]);

  const handleCopyComparison = async () => {
    if (!comparisonText) {
      showToast('Selecione uma solicitação com cotações para copiar o resumo.', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(comparisonText);
      showToast('Resumo comparativo copiado para a área de transferência.', 'success');
    } catch {
      showToast('Não foi possível copiar o resumo comparativo.', 'error');
    }
  };

  const handleExportQuotationPDF = async (quotationId: number, quotationCode?: string) => {
    try {
      const blob = await api.get(`/service-orders/purchase-quotations/${quotationId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cotacao-${quotationCode || quotationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      showToast('Não foi possível gerar o PDF da cotação.', 'error');
    }
  };

  const handlePrintComparison = () => {
    if (!comparisonGroup) {
      showToast('Selecione uma solicitação com cotações para imprimir.', 'warning');
      return;
    }

    window.print();
  };

  const handleApproveBestQuotation = async () => {
    if (!comparisonBestQuotation) {
      showToast('Nenhuma cotação disponível para aprovação.', 'warning');
      return;
    }

    await handleApproveQuotation(Number(comparisonBestQuotation.id));
  };

  const summary = useMemo(() => {
    const all = pendingItems.map((item: any) => {
      const input = itemInputs[item.id] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
      const quantity = Number(input.quantity || 0);
      const grossValue = getDraftItemSubtotal(input);
      const taxesValue = getItemTaxTotal(input);
      const totalPaid = input.totalPaid ? Number(input.totalPaid) : grossValue + taxesValue;
      return {
        quantity: Number.isFinite(quantity) ? quantity : 0,
        grossValue,
        taxesValue,
        totalPaid: Number.isFinite(totalPaid) ? totalPaid : 0,
        filled: quantity > 0 && Number(input.unitCost || 0) > 0,
      };
    });

    const freightValue = safeNumber(form.freightCost);

    return {
      itemsCount: pendingItems.length,
      filledCount: all.filter((i: { filled: boolean }) => i.filled).length,
      totalQty: all.reduce((acc: number, i: { quantity: number }) => acc + i.quantity, 0),
      grossValue: all.reduce((acc: number, i: { grossValue: number }) => acc + i.grossValue, 0),
      taxesValue: all.reduce((acc: number, i: { taxesValue: number }) => acc + i.taxesValue, 0),
      freightValue,
      totalValue: all.reduce((acc: number, i: { totalPaid: number }) => acc + i.totalPaid, 0) + freightValue,
    };
  }, [form.freightCost, pendingItems, itemInputs]);

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

      <div className={pageStyles.overviewGrid}>
        <div className={pageStyles.overviewCard}>
          <div className={pageStyles.overviewLabel}>Total cotado</div>
          <div className={pageStyles.overviewValue}>{formatCurrency(quotationOverview.totalQuoted)}</div>
          <div className={pageStyles.overviewHint}>Volume consolidado em {quotationOverview.count} cotações registradas.</div>
        </div>
        <div className={pageStyles.overviewCard}>
          <div className={pageStyles.overviewLabel}>Melhor proposta em aberto</div>
          <div className={pageStyles.overviewValue}>{quotationOverview.bestOpen ? formatCurrency(quotationOverview.bestOpen.total) : '-'}</div>
          <div className={pageStyles.overviewHint}>{quotationOverview.bestOpen ? `Cotação #${quotationOverview.bestOpen.id} pronta para análise.` : 'Nenhuma cotação aberta no momento.'}</div>
        </div>
        <div className={pageStyles.overviewCard}>
          <div className={pageStyles.overviewLabel}>Em análise</div>
          <div className={pageStyles.overviewValue}>{quotationOverview.openCount}</div>
          <div className={pageStyles.overviewHint}>{quotationOverview.approvedCount} aprovada(s) já convertida(s) em compra.</div>
        </div>
        <div className={pageStyles.overviewCard}>
          <div className={pageStyles.overviewLabel}>Próxima validade</div>
          <div className={pageStyles.overviewValue}>{quotationOverview.nextExpiry ? formatDate(quotationOverview.nextExpiry.validUntil) : '-'}</div>
          <div className={pageStyles.overviewHint}>Evita perder preço negociado por expiração.</div>
        </div>
      </div>

      <div className={pageStyles.contentGrid}>
        <div className={pageStyles.panelCard}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: 12 }}>Nova Cotação</div>

          {requestContext && (
            <div className={pageStyles.requestContextCard}>
              <div className={pageStyles.requestContextHeader}>
                <div>
                  <div className={pageStyles.requestCode}>{requestContext.code}</div>
                  <div className={pageStyles.requestSubtext}>OS/Trace: {requestContext.traceCode}</div>
                </div>
                <span style={{ border: `1px solid ${requestStatusColor[requestContext.status] || '#64748b'}55`, background: `${requestStatusColor[requestContext.status] || '#64748b'}22`, color: requestStatusColor[requestContext.status] || '#cbd5e1', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                  {requestContext.status}
                </span>
              </div>
              <div className={pageStyles.requestMetaGrid}>
                <div>
                  <span className={pageStyles.requestMetaLabel}>Solicitante</span>
                  <strong>{requestContext.requestedByEmail}</strong>
                </div>
                <div>
                  <span className={pageStyles.requestMetaLabel}>Data de emissão</span>
                  <strong>{formatDateTime(requestContext.createdAt)}</strong>
                </div>
                <div>
                  <span className={pageStyles.requestMetaLabel}>Itens</span>
                  <strong>{requestContext.itemsCount}</strong>
                </div>
              </div>
              <div className={pageStyles.requestDescription}>{requestContext.description}</div>
            </div>
          )}

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

          <div className={pageStyles.commercialGrid}>
            <input className={styles.searchInput} placeholder="Condição de pagamento" value={form.paymentTerms} onChange={(e) => setForm((prev) => ({ ...prev, paymentTerms: e.target.value }))} />
            <select className={styles.searchInput} value={form.freightMode} onChange={(e) => setForm((prev) => ({ ...prev, freightMode: e.target.value }))}>
              <option value="CIF">Frete CIF</option>
              <option value="FOB">Frete FOB</option>
              <option value="PICKUP">Retirada</option>
              <option value="NONE">Sem frete</option>
            </select>
            <input className={styles.searchInput} type="number" min={0} step="0.01" placeholder="Valor do frete" value={form.freightCost} onChange={(e) => setForm((prev) => ({ ...prev, freightCost: e.target.value }))} />
            <input className={styles.searchInput} type="number" min={0} step="1" placeholder="Prazo de entrega (dias)" value={form.deliveryLeadTimeDays} onChange={(e) => setForm((prev) => ({ ...prev, deliveryLeadTimeDays: e.target.value }))} />
            <input className={styles.searchInput} type="number" min={0} step="1" placeholder="Garantia (dias)" value={form.warrantyDays} onChange={(e) => setForm((prev) => ({ ...prev, warrantyDays: e.target.value }))} />
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
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Itens pendentes</div>
                  <div className={pageStyles.metricValue}>{summary.itemsCount}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Itens preenchidos</div>
                  <div className={pageStyles.metricValue} style={{ color: '#86efac' }}>{summary.filledCount}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Quantidade cotada</div>
                  <div className={pageStyles.metricValue}>{formatNumber(summary.totalQty)}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Total bruto</div>
                  <div className={pageStyles.metricValue}>{formatCurrency(summary.grossValue)}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Impostos</div>
                  <div className={pageStyles.metricValue}>{formatCurrency(summary.taxesValue)}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Frete</div>
                  <div className={pageStyles.metricValue}>{formatCurrency(summary.freightValue)}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Total líquido</div>
                  <div className={pageStyles.metricValue} style={{ color: '#86efac' }}>{formatCurrency(summary.totalValue)}</div>
                </div>
              </div>

              <div className={pageStyles.tableShell}>
                <div className={pageStyles.tableScroll}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Material</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Falta</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Histórico</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Qtd</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Unit.</th>
                        <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Impostos</th>
                        <th style={{ textAlign: 'right', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Total</th>
                        <th style={{ textAlign: 'left', padding: 8, color: '#94a3b8', borderBottom: '1px solid rgba(148,163,184,0.16)' }}>Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map((item: any) => {
                        const input = itemInputs[item.id] || { quantity: '', unitCost: '', ipiValue: '', icmsValue: '', stValue: '', totalPaid: '', notes: '' };
                        return (
                          <tr key={item.id}>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)', color: '#e2e8f0' }}>
                              <div style={{ fontWeight: 700 }}>{item.material?.name}</div>
                              <div style={{ color: '#64748b', fontSize: 11 }}>{item.unit || item.material?.unit || ''}</div>
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)', color: '#cbd5e1', textAlign: 'right' }}>
                              {Number(item.shortageQty || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)', textAlign: 'right' }}>
                              <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{formatCurrency(item.material?.price)}</div>
                              <div style={{ color: '#64748b', fontSize: 11 }}>última compra</div>
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <input className={`${styles.searchInput} ${pageStyles.tableInputSm}`} type="number" min={0} step="0.01" value={input.quantity} onChange={(e) => handleItemInput(item.id, 'quantity', e.target.value)} />
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <input className={`${styles.searchInput} ${pageStyles.tableInputMd}`} type="number" min={0} step="0.01" value={input.unitCost} onChange={(e) => handleItemInput(item.id, 'unitCost', e.target.value)} />
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
                              <div className={pageStyles.taxInputs}>
                                <input className={`${styles.searchInput} ${pageStyles.tableInputXs}`} type="number" min={0} step="0.01" placeholder="IPI" value={input.ipiValue} onChange={(e) => handleItemInput(item.id, 'ipiValue', e.target.value)} />
                                <input className={`${styles.searchInput} ${pageStyles.tableInputXs}`} type="number" min={0} step="0.01" placeholder="ICMS" value={input.icmsValue} onChange={(e) => handleItemInput(item.id, 'icmsValue', e.target.value)} />
                                <input className={`${styles.searchInput} ${pageStyles.tableInputXs}`} type="number" min={0} step="0.01" placeholder="ST" value={input.stValue} onChange={(e) => handleItemInput(item.id, 'stValue', e.target.value)} />
                              </div>
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
          <div className={pageStyles.comparisonHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart3 size={18} color="#38bdf8" />
              <strong style={{ color: '#e2e8f0' }}>Comparativo de Fornecedores</strong>
            </div>

            <div className={pageStyles.comparisonActions}>
              <select className={styles.searchInput} value={comparisonRequestId || ''} onChange={(e) => setComparisonRequestId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Selecione a solicitação</option>
                {comparisonGroups.map((group) => (
                  <option key={group.requestId} value={group.requestId}>
                    {group.request?.code || `Solicitação ${group.requestId}`} ({group.quotations.length} fornecedor(es))
                  </option>
                ))}
              </select>
              <button className={styles.newBtn} type="button" onClick={handleCopyComparison} style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}>
                <Copy size={16} /> Copiar resumo
              </button>
              <button className={styles.newBtn} type="button" onClick={handlePrintComparison} style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
                <Printer size={16} /> Imprimir
              </button>
              {comparisonBestQuotation && (
                <button
                  className={styles.newBtn}
                  type="button"
                  onClick={() => handleExportQuotationPDF(comparisonBestQuotation.id, comparisonBestQuotation.code)}
                  style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}
                >
                  <FileDown size={16} /> PDF melhor proposta
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8' }}>Carregando cotações...</div>
          ) : quotations.length === 0 ? (
            <div style={{ color: '#94a3b8' }}>Nenhuma cotação registrada.</div>
          ) : !comparisonGroup ? (
            <div style={{ color: '#94a3b8' }}>Selecione uma solicitação para comparar fornecedores lado a lado.</div>
          ) : (
            <>
              <div className={pageStyles.comparisonOverview}>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Solicitação</div>
                  <div className={pageStyles.metricValue}>{comparisonGroup.request?.code || comparisonGroup.requestId}</div>
                  <div className={pageStyles.metricHint}>{comparisonGroup.request?.serviceOrder?.traceCode || 'Sem OS vinculada'}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Menor proposta</div>
                  <div className={pageStyles.metricValue}>{comparisonBestQuotation ? formatCurrency(getQuotationTotal(comparisonBestQuotation)) : '-'}</div>
                  <div className={pageStyles.metricHint}>{comparisonBestQuotation ? getPersonName(comparisonBestQuotation.supplierPerson) : 'Nenhum fornecedor ainda'}</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Impostos comparados</div>
                  <div className={pageStyles.metricValue}>{formatCurrency(comparisonQuotations.reduce((acc: number, quotation: any) => acc + getQuotationTaxesTotal(quotation), 0))}</div>
                  <div className={pageStyles.metricHint}>IPI, ICMS e ST já entram na análise total.</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Validade mais próxima</div>
                  <div className={pageStyles.metricValue}>{comparisonQuotations.filter((quotation: any) => quotation.validUntil).sort((left: any, right: any) => new Date(String(left.validUntil)).getTime() - new Date(String(right.validUntil)).getTime())[0] ? formatDate(comparisonQuotations.filter((quotation: any) => quotation.validUntil).sort((left: any, right: any) => new Date(String(left.validUntil)).getTime() - new Date(String(right.validUntil)).getTime())[0].validUntil) : '-'}</div>
                  <div className={pageStyles.metricHint}>Evita perder fornecedor com melhor valor.</div>
                </div>
                <div className={pageStyles.metricCard}>
                  <div className={pageStyles.metricLabel}>Ações</div>
                  <button
                    type="button"
                    className={styles.newBtn}
                    onClick={() => void handleApproveBestQuotation()}
                    disabled={!comparisonBestQuotation || approvingId === comparisonBestQuotation.id}
                    style={{ marginTop: 6, width: '100%', background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}
                  >
                    <CheckCircle2 size={16} /> {comparisonBestQuotation && approvingId === comparisonBestQuotation.id ? 'Aprovando...' : 'Aprovar melhor proposta'}
                  </button>
                </div>
              </div>

              <div className={pageStyles.quoteCardGrid}>
                {comparisonQuotations.map((quotation: any) => {
                  const total = getQuotationTotal(quotation);
                  const isBest = Number(comparisonBestQuotation?.id) === Number(quotation.id);
                  const requestStatus = quotation.purchaseRequest?.status || 'OPEN';
                  const differenceToBest = comparisonBestQuotation ? total - getQuotationTotal(comparisonBestQuotation) : 0;

                  return (
                    <div key={quotation.id} className={`${pageStyles.quoteCard} ${isBest ? pageStyles.quoteCardBest : ''}`}>
                      <div className={pageStyles.quoteCardHeader}>
                        <div>
                          <div className={pageStyles.quoteCode}>{quotation.code}</div>
                          <div className={pageStyles.quoteSupplier}>{getPersonName(quotation.supplierPerson)}</div>
                        </div>
                        <span style={{ border: `1px solid ${quotationStatusColor[quotation.status] || '#64748b'}55`, background: `${quotationStatusColor[quotation.status] || '#64748b'}22`, color: quotationStatusColor[quotation.status] || '#cbd5e1', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                          {quotation.status}
                        </span>
                      </div>

                      <div className={pageStyles.quoteCardTotal}>{formatCurrency(total)}</div>
                      <div className={pageStyles.quoteMetaGrid}>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Status da compra</span>
                          <strong style={{ color: requestStatusColor[requestStatus] || '#cbd5e1' }}>{requestStatus}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Validade</span>
                          <strong>{formatDate(quotation.validUntil)}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Emissão</span>
                          <strong>{formatDateTime(quotation.createdAt)}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Itens</span>
                          <strong>{(quotation.items || []).length}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Pagamento</span>
                          <strong>{quotation.paymentTerms || '-'}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Frete</span>
                          <strong>{formatFreightMode(quotation.freightMode)} {safeNumber(quotation.freightCost) > 0 ? `• ${formatCurrency(quotation.freightCost)}` : ''}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Prazo</span>
                          <strong>{quotation.deliveryLeadTimeDays ? `${quotation.deliveryLeadTimeDays} dia(s)` : '-'}</strong>
                        </div>
                        <div>
                          <span className={pageStyles.requestMetaLabel}>Garantia</span>
                          <strong>{quotation.warrantyDays ? `${quotation.warrantyDays} dia(s)` : '-'}</strong>
                        </div>
                      </div>

                      <div className={pageStyles.quoteDeltaRow}>
                        {isBest ? (
                          <span className={pageStyles.bestBadge}><ArrowDownCircle size={14} /> Menor preço atual</span>
                        ) : (
                          <span className={pageStyles.deltaBadge}><ArrowUpCircle size={14} /> {differenceToBest > 0 ? `${formatCurrency(differenceToBest)} acima da melhor` : 'Empate com a melhor'}</span>
                        )}
                      </div>

                      {quotation.notes && <div className={pageStyles.quoteNotes}>{quotation.notes}</div>}

                      {quotation.status === 'OPEN' && (
                        <button
                          type="button"
                          className={styles.newBtn}
                          onClick={() => void handleApproveQuotation(Number(quotation.id))}
                          disabled={approvingId === quotation.id}
                          style={{ marginTop: 10, width: '100%', background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}
                        >
                          <CheckCircle2 size={16} /> {approvingId === quotation.id ? 'Aprovando...' : 'Converter em compra'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.newBtn}
                        onClick={() => void handleExportQuotationPDF(Number(quotation.id), quotation.code)}
                        style={{ marginTop: 8, width: '100%', background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
                      >
                        <FileDown size={16} /> Exportar PDF
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className={pageStyles.tableShell}>
                <div className={pageStyles.tableScrollWide}>
                  <table className={pageStyles.comparisonTable}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qtd.</th>
                        <th>Preço histórico</th>
                        {comparisonQuotations.map((quotation: any) => (
                          <th key={quotation.id}>{getPersonName(quotation.supplierPerson)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonItems.map((row: any) => (
                        <tr key={row.id}>
                          <td>
                            <div className={pageStyles.comparisonItemName}>{row.materialName}</div>
                            <div className={pageStyles.comparisonItemSub}>{row.unit}</div>
                          </td>
                          <td>
                            <div className={pageStyles.comparisonQty}>{formatNumber(row.shortageQty || row.requestedQty)}</div>
                            <div className={pageStyles.comparisonItemSub}>solicitado</div>
                          </td>
                          <td>
                            <div className={pageStyles.comparisonPrice}>{formatCurrency(row.referenceUnitCost)}</div>
                            <div className={pageStyles.comparisonItemSub}>última compra</div>
                          </td>
                          {comparisonQuotations.map((quotation: any) => {
                            const item = row.quotesByQuotationId[quotation.id];
                            if (!item) {
                              return <td key={quotation.id}><span className={pageStyles.emptyQuote}>Não cotado</span></td>;
                            }

                            const variation = getVariationMeta(row.referenceUnitCost, item.unitCost);
                            const taxesTotal = getItemTaxTotal(item);
                            return (
                              <td key={quotation.id}>
                                <div className={pageStyles.quoteCellValue}>{formatCurrency(item.unitCost)}</div>
                                <div className={pageStyles.quoteCellSub}>unitário</div>
                                <div className={pageStyles.quoteCellValue}>{formatCurrency(item.totalPaid)}</div>
                                <div className={pageStyles.quoteCellSub}>total</div>
                                <div className={pageStyles.quoteCellSub}>IPI {formatCurrency(item.ipiValue)} | ICMS {formatCurrency(item.icmsValue)} | ST {formatCurrency(item.stValue)}</div>
                                {taxesTotal > 0 && <div className={pageStyles.quoteCellSub}>Tributos: {formatCurrency(taxesTotal)}</div>}
                                <span className={pageStyles.variationBadge} style={{ borderColor: `${variation.tone}55`, background: `${variation.tone}18`, color: variation.tone }}>
                                  {variation.label}
                                </span>
                                {item.notes && <div className={pageStyles.quoteCellNote}>{item.notes}</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={pageStyles.historySectionHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock3 size={18} color="#f59e0b" />
                  <strong style={{ color: '#e2e8f0' }}>Linha do tempo das cotações</strong>
                </div>
                <span style={{ color: '#64748b', fontSize: 12 }}>Últimos registros para rastreabilidade e revisão rápida.</span>
              </div>

              <div className={pageStyles.historyScroll}>
                {quotations.map((quotation: any) => {
                  const total = getQuotationTotal(quotation);
                  return (
                    <div key={quotation.id} style={{ border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: 12, background: 'rgba(15,23,42,0.45)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <div style={{ color: '#fff', fontWeight: 800 }}>{quotation.code}</div>
                        <span style={{ border: `1px solid ${quotationStatusColor[quotation.status] || '#64748b'}55`, background: `${quotationStatusColor[quotation.status] || '#64748b'}22`, color: quotationStatusColor[quotation.status] || '#cbd5e1', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{quotation.status}</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Solicitação: {quotation.purchaseRequest?.code || '-'} | Fornecedor: {getPersonName(quotation.supplierPerson)}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Emitida em {formatDateTime(quotation.createdAt)} | Validade {formatDate(quotation.validUntil)}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Pagamento: {quotation.paymentTerms || '-'} | Frete: {formatFreightMode(quotation.freightMode)} {safeNumber(quotation.freightCost) > 0 ? `(${formatCurrency(quotation.freightCost)})` : ''}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>Prazo: {quotation.deliveryLeadTimeDays ? `${quotation.deliveryLeadTimeDays} dia(s)` : '-'} | Garantia: {quotation.warrantyDays ? `${quotation.warrantyDays} dia(s)` : '-'}</div>
                      <div style={{ color: '#86efac', fontWeight: 800, marginTop: 6 }}>{formatCurrency(total)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotationsList;
