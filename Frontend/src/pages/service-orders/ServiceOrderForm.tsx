import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Wrench, User, ClipboardList, ArrowLeft, Save,
  FileDown, Plus, Trash2,
  Package, Hammer, Percent, TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';
import Skeleton from '../../components/Skeleton';

declare global {
  interface Window {
    jspdf: any;
  }
}

interface ServiceOrderFormProps {
  isEdit?: boolean;
  isView?: boolean;
  showFinancialData?: boolean;
  listPath?: string;
}

const ServiceOrderForm: React.FC<ServiceOrderFormProps> = ({ isEdit, isView, showFinancialData = true, listPath = '/service-orders' }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const isOperationalView = Boolean(isView && !showFinancialData);
  
  const [formData, setFormData] = useState({
    description: '',
    problemDescription: '',
    technicalDiagnosis: '',
    status: 'Orçamento',
    customerId: '',
    orderDate: new Date().toISOString().split('T')[0],
    estimatedFinishDate: '',
    workCenter: '',
    plannedStartDate: '',
    plannedEndDate: '',
    plannedHours: 0,
    taxPercent: 0,
    profitPercent: 0,
  });

  const [itemsMaterials, setItemsMaterials] = useState<any[]>([]);
  const [itemsServices, setItemsServices] = useState<any[]>([]);
  
  const [people, setPeople] = useState<any[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [financials, setFinancials] = useState<any | null>(null);
  const [materialsCoverage, setMaterialsCoverage] = useState<any | null>(null);
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const [creatingPurchaseRequest, setCreatingPurchaseRequest] = useState(false);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [loadingPurchaseRequests, setLoadingPurchaseRequests] = useState(false);
  const [fulfillingRequestId, setFulfillingRequestId] = useState<number | null>(null);
  const [supplierByRequest, setSupplierByRequest] = useState<Record<number, string>>({});
  const [itemInputs, setItemInputs] = useState<Record<number, { quantity: string; unitCost: string; totalPaid: string }>>({});
  const [operationLogs, setOperationLogs] = useState<any[]>([]);
  const [operationsEfficiency, setOperationsEfficiency] = useState<any | null>(null);
  const [operationForm, setOperationForm] = useState({
    operationType: 'USINAGEM',
    shift: 'MORNING',
    employeeId: '',
    startAt: '',
    endAt: '',
    downtimeMinutes: 0,
    downtimeCategory: 'OUTROS',
    downtimeReason: '',
    notes: '',
  });
  const [savingOperation, setSavingOperation] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Load lists for selection
    Promise.all([
      api.get('/people'),
      api.get('/materials'),
      api.get('/services'),
      api.get('/employees')
    ]).then(([p, m, s, e]: any[]) => {
      setPeople(p.data || p);
      setAvailableMaterials(m.data || m);
      setAvailableServices(s.data || s);
      setEmployees(e.data || e);
    }).catch((err: any) => showToast('Erro ao carregar dados auxiliares.', 'error'));

    if (id && (isEdit || isView)) {
      Promise.all([
        api.get(`/service-orders/${id}`),
        api.get(`/service-orders/${id}/operations`).catch(() => []),
        api.get('/service-orders/operations/efficiency').catch(() => null),
        api.get(`/service-orders/purchase-requests?serviceOrderId=${id}`).catch(() => []),
      ])
        .then(([data, operations, efficiency, requests]: any[]) => {
          setFormData({
            description: data.description || '',
            problemDescription: data.problemDescription || '',
            technicalDiagnosis: data.technicalDiagnosis || '',
            status: data.status || 'Orçamento',
            customerId: data.personId?.toString() || '',
            orderDate: data.openingDate ? data.openingDate.split('T')[0] : '',
            estimatedFinishDate: data.estimatedFinishDate ? data.estimatedFinishDate.split('T')[0] : '',
            workCenter: data.workCenter || '',
            plannedStartDate: data.plannedStartDate ? data.plannedStartDate.split('T')[0] : '',
            plannedEndDate: data.plannedEndDate ? data.plannedEndDate.split('T')[0] : '',
            plannedHours: Number(data.plannedHours) || 0,
            taxPercent: data.taxPercent || 0,
            profitPercent: data.profitPercent || 0,
          });
          setItemsMaterials((data.materials || []).map((m: any) => ({
            ...m,
            materialId: m.materialId?.toString() || '',
            quantity: m.quantity || 0,
            unitPrice: m.unitPrice || 0,
            totalPrice: m.totalPrice || 0
          })));
          setItemsServices((data.services || []).map((s: any) => ({
            ...s,
            serviceId: s.serviceId?.toString() || '',
            employeeId: s.employeeId?.toString() || '',
            hoursWorked: s.hoursWorked || 0,
            unitPrice: s.unitPrice || 0,
            totalPrice: s.totalPrice || 0
          })));
          setFinancials(data.financials || null);
          setOperationLogs(Array.isArray(operations) ? operations : []);
          setOperationsEfficiency(efficiency || null);
          setPurchaseRequests(Array.isArray(requests) ? requests : []);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isEdit, isView, showToast]);

  const loadPurchaseRequests = async () => {
    if (!id) return;
    setLoadingPurchaseRequests(true);
    try {
      const requests = await api.get(`/service-orders/purchase-requests?serviceOrderId=${id}`);
      setPurchaseRequests(Array.isArray(requests) ? requests : []);
    } catch {
      showToast('Erro ao carregar solicitações de compra da OS.', 'error');
    } finally {
      setLoadingPurchaseRequests(false);
    }
  };

  const formatDateTimeLabel = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return '-';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR');
  };

  const addMaterialItem = () => {
    setItemsMaterials([...itemsMaterials, { materialId: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    setMaterialsCoverage(null);
  };

  const removeMaterialItem = (index: number) => {
    setItemsMaterials(itemsMaterials.filter((_, i) => i !== index));
    setMaterialsCoverage(null);
  };

  const updateMaterialItem = (index: number, field: string, value: any) => {
    const newItems = [...itemsMaterials];
    newItems[index][field] = value;

    if (field === 'materialId') {
      const mat = availableMaterials.find(m => m.id.toString() === value);
      if (mat) {
        newItems[index].unitPrice = mat.price;
      }
    }

    newItems[index].totalPrice = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].unitPrice) || 0);
    setItemsMaterials(newItems);
    setMaterialsCoverage(null);
  };

  const checkMaterialsCoverage = async () => {
    const payloadMaterials = itemsMaterials
      .filter(m => m.materialId)
      .map(m => ({
        materialId: parseInt(m.materialId),
        quantity: parseFloat(m.quantity) || 0,
      }))
      .filter(m => Number.isFinite(m.materialId) && m.materialId > 0 && m.quantity > 0);

    if (!payloadMaterials.length) {
      showToast('Adicione materiais para verificar cobertura.', 'warning');
      return;
    }

    setCheckingCoverage(true);
    try {
      const coverage = await api.post('/service-orders/materials/check', { materials: payloadMaterials });
      setMaterialsCoverage(coverage);
      const shortage = Number(coverage?.totals?.shortageQty || 0);
      if (shortage > 0) {
        showToast('Atenção: há ruptura de materiais nesta OS.', 'warning');
      } else {
        showToast('Cobertura de materiais OK para a OS.', 'success');
      }
    } catch (err: any) {
      showToast(typeof err === 'string' ? err : 'Erro ao verificar cobertura de materiais.', 'error');
    } finally {
      setCheckingCoverage(false);
    }
  };

  const handleCreatePurchaseRequest = async () => {
    if (!id) {
      showToast('Salve a OS antes de gerar solicitação de compra.', 'warning');
      return;
    }

    const shortageItems = (materialsCoverage?.items || [])
      .filter((item: any) => item.status === 'SHORTAGE' && Number(item.shortageQty || 0) > 0)
      .map((item: any) => ({
        materialId: Number(item.materialId),
        requestedQty: Number(item.requestedQty || 0),
        stockQty: Number(item.stockQty || 0),
        shortageQty: Number(item.shortageQty || 0),
        unit: item.unit || null,
      }))
      .filter((item: any) => Number.isFinite(item.materialId) && item.materialId > 0 && item.shortageQty > 0);

    if (!shortageItems.length) {
      showToast('Não há ruptura de materiais para solicitar compra.', 'warning');
      return;
    }

    setCreatingPurchaseRequest(true);
    try {
      const created = await api.post('/service-orders/purchase-requests', {
        serviceOrderId: Number(id),
        items: shortageItems,
        notes: `Gerado automaticamente pela OS #${id} após análise de cobertura.`,
      });

      showToast(`Solicitação ${created?.code || ''} gerada com ${shortageItems.length} item(ns).`, 'success');
      await loadPurchaseRequests();
    } catch (err: any) {
      showToast(typeof err === 'string' ? err : 'Erro ao gerar solicitação de compra.', 'error');
    } finally {
      setCreatingPurchaseRequest(false);
    }
  };

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

  const handleFulfillPurchaseRequest = async (request: any) => {
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
      showToast('Informe quantidade e custo (unitário ou total) para os itens pendentes.', 'warning');
      return;
    }

    setFulfillingRequestId(requestId);
    try {
      await api.post(`/service-orders/purchase-requests/${requestId}/fulfill`, {
        supplierPersonId,
        items: payloadItems,
        description: `Compra registrada pela OS #${id}`,
      });

      showToast(`Compra da solicitação ${request.code} registrada com sucesso.`, 'success');
      await loadPurchaseRequests();
      setMaterialsCoverage(null);
    } catch (err: any) {
      showToast(typeof err === 'string' ? err : 'Erro ao registrar compra da solicitação.', 'error');
    } finally {
      setFulfillingRequestId(null);
    }
  };

  const addServiceItem = () => {
    setItemsServices([...itemsServices, { serviceId: '', employeeId: '', hoursWorked: 1, unitPrice: 0, totalPrice: 0, description: '' }]);
  };

  const removeServiceItem = (index: number) => {
    setItemsServices(itemsServices.filter((_, i) => i !== index));
  };

  const updateServiceItem = (index: number, field: string, value: any) => {
    const newItems = [...itemsServices];
    newItems[index][field] = value;

    if (field === 'serviceId') {
      const svc = availableServices.find(s => s.id.toString() === value);
      if (svc) {
        newItems[index].unitPrice = svc.price;
      }
    }

    newItems[index].totalPrice = (Number(newItems[index].hoursWorked) || 0) * (Number(newItems[index].unitPrice) || 0);
    setItemsServices(newItems);
  };

  const calculateTotal = () => {
    const matTotal = itemsMaterials.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
    const svcTotal = itemsServices.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
    const subtotal = matTotal + svcTotal;
    
    const profitAmount = subtotal * (formData.profitPercent / 100);
    const baseForTax = subtotal + profitAmount;
    const taxAmount = baseForTax * (formData.taxPercent / 100);
    
    return baseForTax + taxAmount;
  };

  const validate = () => {
    const newErrors: any = {};
    if (!formData.description.trim()) newErrors.description = 'A descrição breve é obrigatória.';
    if (!formData.customerId) newErrors.customerId = 'Selecione um cliente.';
    
    // Validar se há itens incompletos
    const hasIncompleteMaterial = itemsMaterials.some(m => !m.materialId);
    const hasIncompleteService = itemsServices.some(s => !s.serviceId);

    if (hasIncompleteMaterial) showToast('Existem peças sem seleção.', 'warning');
    if (hasIncompleteService) showToast('Existem serviços sem seleção.', 'warning');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && !hasIncompleteMaterial && !hasIncompleteService;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;
    
    if (!validate()) {
      showToast('Preencha os dados obrigatórios da OS.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        personId: parseInt(formData.customerId),
        openingDate: new Date(formData.orderDate).toISOString(),
        plannedStartDate: formData.plannedStartDate ? new Date(formData.plannedStartDate).toISOString() : null,
        plannedEndDate: formData.plannedEndDate ? new Date(formData.plannedEndDate).toISOString() : null,
        plannedHours: Number(formData.plannedHours) || 0,
        // Filtra apenas itens válidos para garantir integridade
        materials: itemsMaterials
          .filter(m => m.materialId)
          .map(m => ({
            materialId: parseInt(m.materialId),
            quantity: parseFloat(m.quantity) || 0,
            unitPrice: parseFloat(m.unitPrice) || 0,
            totalPrice: (parseFloat(m.quantity) || 0) * (parseFloat(m.unitPrice) || 0)
          })),
        services: itemsServices
          .filter(s => s.serviceId)
          .map(s => ({
            serviceId: parseInt(s.serviceId),
            employeeId: s.employeeId ? parseInt(s.employeeId) : null,
            description: s.description || '',
            hoursWorked: parseFloat(s.hoursWorked) || 0,
            unitPrice: parseFloat(s.unitPrice) || 0,
            totalPrice: (parseFloat(s.hoursWorked) || 0) * (parseFloat(s.unitPrice) || 0)
          })),
      };

      if (isEdit) {
        const updated = await api.put(`/service-orders/${id}`, payload);
        setFinancials(updated?.financials || null);
        showToast('Ordem de Serviço atualizada!');
      } else {
        const created = await api.post('/service-orders', payload);
        setFinancials(created?.financials || null);
        showToast('OS/Orçamento criado com sucesso!');
      }
      navigate('/service-orders');
    } catch (err: any) {
      console.error('Erro ao salvar OS:', err);
      showToast(typeof err === 'string' ? err : 'Erro ao gravar Ordem de Serviço.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(0, 230, 176);
    doc.text('ProMEC Industrial - OS / ORÇAMENTO', 20, 20);
    
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.text(`Identificador: #${id || 'NOVA'} | Emissão: ${new Date().toLocaleString()}`, 20, 28);
    
    doc.setDrawColor(230, 230, 230);
    doc.line(20, 32, 190, 32);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('1. Informações do Cliente', 20, 42);
    doc.setFontSize(9);
    const person = people.find(p => p.id.toString() === formData.customerId);
    doc.text(`Cliente: ${person?.naturalPerson?.name || person?.legalPerson?.corporateName || 'N/A'}`, 25, 50);
    doc.text(`Data Abertura: ${formData.orderDate}`, 25, 55);
    doc.text(`Status: ${formData.status}`, 140, 50);
    
    doc.setFontSize(12);
    doc.text('2. Diagnóstico Técnico', 20, 70);
    doc.setFontSize(9);
    const diag = doc.splitTextToSize(formData.technicalDiagnosis || 'Nenhum diagnóstico registrado.', 160);
    doc.text(diag, 25, 78);
    
    let currentY = 78 + (diag.length * 5) + 10;
    
    doc.setFontSize(12);
    doc.text('3. Peças e Materiais', 20, currentY);
    currentY += 8;
    doc.setFontSize(9);
    itemsMaterials.forEach((m, i) => {
      const matName = availableMaterials.find(am => am.id.toString() === m.materialId.toString())?.name || 'Item';
      const materialLine = showFinancialData
        ? `${matName} (${m.quantity}x) - R$ ${m.totalPrice.toFixed(2)}`
        : `${matName} (${m.quantity}x)`;
      doc.text(materialLine, 25, currentY);
      currentY += 5;
    });

    currentY += 5;
    doc.setFontSize(12);
    doc.text('4. Mão de Obra e Serviços', 20, currentY);
    currentY += 8;
    doc.setFontSize(9);
    itemsServices.forEach((s, i) => {
      const svcName = availableServices.find(as => as.id.toString() === s.serviceId.toString())?.name || 'Serviço';
      const serviceLine = showFinancialData
        ? `${svcName} (${s.hoursWorked}h) - R$ ${s.totalPrice.toFixed(2)}`
        : `${svcName} (${s.hoursWorked}h)`;
      doc.text(serviceLine, 25, currentY);
      currentY += 5;
    });

    if (showFinancialData) {
      currentY += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const matTotal = itemsMaterials.reduce((acc, i) => acc + i.totalPrice, 0);
      const svcTotal = itemsServices.reduce((acc, i) => acc + i.totalPrice, 0);
      const subtotal = matTotal + svcTotal;
      const profitAmt = subtotal * (formData.profitPercent / 100);
      const baseForTax = subtotal + profitAmt;
      const taxAmt = baseForTax * (formData.taxPercent / 100);

      doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, 20, currentY);
      currentY += 5;
      doc.text(`Lucro (${formData.profitPercent}%): R$ ${profitAmt.toFixed(2)}`, 20, currentY);
      currentY += 5;
      doc.text(`Impostos (${formData.taxPercent}% sobre Subtotal + Lucro): R$ ${taxAmt.toFixed(2)}`, 20, currentY);

      currentY += 10;
      doc.setFontSize(14);
      doc.setTextColor(0, 230, 176);
      doc.text(`VALOR TOTAL: R$ ${(baseForTax + taxAmt).toFixed(2)}`, 20, currentY);
    }
    
    doc.save(`OS_ProMEC_${id || 'Nova'}.pdf`);
  };

  const handleAddOperationLog = async () => {
    if (!id || isView) return;

    if (!operationForm.startAt) {
      showToast('Informe início real da operação.', 'warning');
      return;
    }

    setSavingOperation(true);
    try {
      const payload = {
        operationType: operationForm.operationType,
        shift: operationForm.shift,
        employeeId: operationForm.employeeId ? Number(operationForm.employeeId) : null,
        startAt: new Date(operationForm.startAt).toISOString(),
        endAt: operationForm.endAt ? new Date(operationForm.endAt).toISOString() : null,
        downtimeMinutes: Number(operationForm.downtimeMinutes) || 0,
        downtimeCategory: operationForm.downtimeCategory || 'OUTROS',
        downtimeReason: operationForm.downtimeReason || null,
        notes: operationForm.notes || null,
      };

      const created = await api.post(`/service-orders/${id}/operations`, payload);
      setOperationLogs((prev) => [created, ...prev]);
      setOperationForm({
        operationType: operationForm.operationType,
        shift: operationForm.shift,
        employeeId: '',
        startAt: '',
        endAt: '',
        downtimeMinutes: 0,
        downtimeCategory: 'OUTROS',
        downtimeReason: '',
        notes: '',
      });
      const efficiency = await api.get('/service-orders/operations/efficiency').catch(() => null);
      setOperationsEfficiency(efficiency || null);
      showToast('Apontamento operacional registrado.', 'success');
    } catch (err: any) {
      showToast(typeof err === 'string' ? err : 'Erro ao registrar apontamento operacional.', 'error');
    } finally {
      setSavingOperation(false);
    }
  };

  if (loading && !id) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.glassCard}>
          <div className={styles.header}>
             <Skeleton width="300px" height="32px" />
             <Skeleton width="100px" height="36px" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 30 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i}><Skeleton height="45px" borderRadius="10px" /></div>
            ))}
            <div style={{ gridColumn: 'span 2' }}><Skeleton height="150px" borderRadius="10px" /></div>
            <div style={{ gridColumn: 'span 2' }}><Skeleton height="150px" borderRadius="10px" /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Visualizar OS' : isEdit ? 'Editar Planejamento' : 'Novo Orçamento / OS'}
          </h2>
          <div style={{ display: 'flex', gap: 12 }}>
            {id && (
              <button className={styles.backBtn} onClick={handleGeneratePDF} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <FileDown size={18} /> Exportar
              </button>
            )}
            <button className={styles.backBtn} onClick={() => navigate(listPath)}>
              <ArrowLeft size={18} /> Voltar
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          {/* Sessão Cabeçalho */}
          <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
            <label className={styles.label}>Título / Descrição Breve</label>
            <div className={`${styles.inputWrapper} ${errors.description ? styles.inputError : ''}`}>
              <ClipboardList className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                disabled={isView}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Manutenção Preventiva Torno CNC"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Cliente / Solicitante</label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                disabled={isView}
                value={formData.customerId}
                onChange={e => setFormData({ ...formData, customerId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.naturalPerson?.name || p.legalPerson?.corporateName} ({p.type === 'F' ? `CPF: ${p.naturalPerson?.cpf}` : `CNPJ: ${p.legalPerson?.cnpj}`})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Status Geral</label>
            <div className={styles.inputWrapper}>
              <Wrench className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                disabled={isView}
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Orçamento">Orçamento / Aberto</option>
                <option value="Aprovada">Aprovada / Aguardando</option>
                <option value="Em Andamento">Em Execução</option>
                <option value="Aguardando Material">Pendente Peças</option>
                <option value="Concluída">Finalizada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className={styles.fullWidth} style={{ marginTop: 8 }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 14,
              padding: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}>
              <div className={styles.fieldGroup} style={{ margin: 0 }}>
                <label className={styles.label}>Centro de Trabalho (PCP)</label>
                <input
                  className={styles.formInput}
                  disabled={isView}
                  value={formData.workCenter}
                  onChange={e => setFormData({ ...formData, workCenter: e.target.value })}
                  placeholder="Ex: Torno CNC 1"
                />
              </div>

              <div className={styles.fieldGroup} style={{ margin: 0 }}>
                <label className={styles.label}>Início Planejado</label>
                <input
                  type="date"
                  className={styles.formInput}
                  disabled={isView}
                  value={formData.plannedStartDate}
                  onChange={e => setFormData({ ...formData, plannedStartDate: e.target.value })}
                />
              </div>

              <div className={styles.fieldGroup} style={{ margin: 0 }}>
                <label className={styles.label}>Fim Planejado</label>
                <input
                  type="date"
                  className={styles.formInput}
                  disabled={isView}
                  value={formData.plannedEndDate}
                  onChange={e => setFormData({ ...formData, plannedEndDate: e.target.value })}
                />
              </div>

              <div className={styles.fieldGroup} style={{ margin: 0 }}>
                <label className={styles.label}>Horas Planejadas</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className={styles.formInput}
                  disabled={isView}
                  value={formData.plannedHours}
                  onChange={e => setFormData({ ...formData, plannedHours: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Novos campos de detalhamento */}
          <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Relato do Problema (Cliente)</label>
              <textarea
                className={styles.formTextarea}
                disabled={isView}
                value={formData.problemDescription}
                onChange={e => setFormData({ ...formData, problemDescription: e.target.value })}
                placeholder="O que o cliente relatou?"
                style={{ minHeight: 100 }}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Diagnóstico Técnico (Oficina)</label>
              <textarea
                className={styles.formTextarea}
                disabled={isView}
                value={formData.technicalDiagnosis}
                onChange={e => setFormData({ ...formData, technicalDiagnosis: e.target.value })}
                placeholder="Qual o diagnóstico técnico/solução?"
                style={{ minHeight: 100 }}
              />
            </div>
          </div>

          {showFinancialData && (financials || itemsMaterials.length > 0 || itemsServices.length > 0) && (
            <div className={styles.fullWidth} style={{ marginTop: 18 }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 16,
                padding: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Custo de Materiais</div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>
                    R$ {((financials?.materialCost) ?? itemsMaterials.reduce((acc, i) => acc + (i.totalPrice || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Custo de Mão de Obra</div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>
                    R$ {((financials?.laborCost) ?? itemsServices.reduce((acc, i) => acc + (i.totalPrice || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Custo Direto</div>
                  <div style={{ color: '#f59e0b', fontWeight: 700 }}>
                    R$ {((financials?.directCost) ?? (itemsMaterials.reduce((acc, i) => acc + (i.totalPrice || 0), 0) + itemsServices.reduce((acc, i) => acc + (i.totalPrice || 0), 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Total Previsto</div>
                  <div style={{ color: '#10b981', fontWeight: 800 }}>
                    R$ {((financials?.totalEstimated) ?? calculateTotal()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABELA DE MATERIAIS */}
          <div className={styles.fullWidth} style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#00e6b0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={20} /> Peças e Materiais
              </h3>
              {!isView && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={checkMaterialsCoverage} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700 }}>
                    {checkingCoverage ? 'Verificando...' : 'Cobertura'}
                  </button>
                  <button type="button" onClick={addMaterialItem} style={{ background: 'rgba(0, 230, 176, 0.1)', color: '#00e6b0', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                    <Plus size={16} /> Adicionar Peça
                  </button>
                </div>
              )}
            </div>

            {materialsCoverage && (
              <div style={{
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ color: '#e2e8f0' }}>Cobertura de Materiais</strong>
                  <span style={{
                    color: Number(materialsCoverage?.totals?.shortageQty || 0) > 0 ? '#f87171' : '#10b981',
                    fontWeight: 800,
                    fontSize: 12,
                  }}>
                    {Number(materialsCoverage?.totals?.coveragePercent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 8 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Solicitado: <span style={{ color: '#fff' }}>{Number(materialsCoverage?.totals?.requestedQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span></div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Estoque: <span style={{ color: '#fff' }}>{Number(materialsCoverage?.totals?.stockQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span></div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Falta: <span style={{ color: '#f87171' }}>{Number(materialsCoverage?.totals?.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(materialsCoverage?.items || []).map((item: any) => (
                    <div key={item.materialId} style={{
                      fontSize: 12,
                      color: item.status === 'SHORTAGE' ? '#fecaca' : '#bbf7d0',
                      background: item.status === 'SHORTAGE' ? 'rgba(127,29,29,0.25)' : 'rgba(20,83,45,0.25)',
                      borderRadius: 8,
                      padding: '4px 8px'
                    }}>
                      {item.materialName}: solicitado {Number(item.requestedQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} {item.unit || ''}, estoque {Number(item.stockQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} {item.unit || ''}
                      {item.status === 'SHORTAGE' ? `, falta ${Number(item.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ${item.unit || ''}` : ''}
                    </div>
                  ))}
                </div>
                {!isView && id && Number(materialsCoverage?.totals?.shortageQty || 0) > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleCreatePurchaseRequest}
                      disabled={creatingPurchaseRequest}
                      style={{
                        background: 'rgba(248, 113, 113, 0.15)',
                        color: '#fecaca',
                        border: '1px solid rgba(248, 113, 113, 0.35)',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {creatingPurchaseRequest ? 'Gerando Solicitação...' : 'Gerar Solicitação de Compra'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {id && showFinancialData && (
              <div style={{
                background: 'rgba(15,23,42,0.45)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ color: '#e2e8f0' }}>Solicitações de Compra da OS</strong>
                  <button
                    type="button"
                    onClick={loadPurchaseRequests}
                    disabled={loadingPurchaseRequests}
                    style={{
                      border: '1px solid rgba(148,163,184,0.3)',
                      background: 'transparent',
                      color: '#cbd5e1',
                      borderRadius: 8,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {loadingPurchaseRequests ? 'Atualizando...' : 'Atualizar'}
                  </button>
                </div>

                {purchaseRequests.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Nenhuma solicitação registrada para esta OS.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {purchaseRequests.map((request: any) => {
                      const pendingItems = (request.items || []).filter((item: any) => Number(item.shortageQty || 0) > 0 && item.status !== 'PURCHASED');
                      return (
                        <div key={request.id} style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ color: '#e2e8f0', fontWeight: 800 }}>{request.code}</div>
                            <div style={{ color: '#94a3b8', fontSize: 12 }}>Status: {request.status}</div>
                          </div>

                          {pendingItems.length === 0 ? (
                            <div style={{ color: '#86efac', fontSize: 12 }}>Todos os itens desta solicitação já foram comprados.</div>
                          ) : (
                            <>
                              <div style={{ marginBottom: 8 }}>
                                <label className={styles.label}>Fornecedor</label>
                                <select
                                  className={styles.formSelect}
                                  disabled={isView || fulfillingRequestId === request.id}
                                  value={supplierByRequest[request.id] || ''}
                                  onChange={(e) => setSupplierByRequest((prev) => ({ ...prev, [request.id]: e.target.value }))}
                                >
                                  <option value="">Selecione...</option>
                                  {people.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.naturalPerson?.name || p.legalPerson?.corporateName}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                                {pendingItems.map((item: any) => {
                                  const input = itemInputs[item.id] || { quantity: '', unitCost: '', totalPaid: '' };
                                  return (
                                    <div key={item.id} style={{ background: 'rgba(2,6,23,0.4)', borderRadius: 8, padding: 8 }}>
                                      <div style={{ color: '#e2e8f0', fontSize: 12, marginBottom: 6 }}>
                                        {item.material?.name}: falta {Number(item.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} {item.unit || item.material?.unit || ''}
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          className={styles.formInput}
                                          placeholder={`Qtd (padrão ${Number(item.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })})`}
                                          disabled={isView || fulfillingRequestId === request.id}
                                          value={input.quantity}
                                          onChange={(e) => handleItemInputChange(item.id, 'quantity', e.target.value)}
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          className={styles.formInput}
                                          placeholder="Custo unitário"
                                          disabled={isView || fulfillingRequestId === request.id}
                                          value={input.unitCost}
                                          onChange={(e) => handleItemInputChange(item.id, 'unitCost', e.target.value)}
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.01"
                                          className={styles.formInput}
                                          placeholder="Total pago"
                                          disabled={isView || fulfillingRequestId === request.id}
                                          value={input.totalPaid}
                                          onChange={(e) => handleItemInputChange(item.id, 'totalPaid', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {!isView && (
                                <button
                                  type="button"
                                  onClick={() => handleFulfillPurchaseRequest(request)}
                                  disabled={fulfillingRequestId === request.id}
                                  style={{
                                    background: 'rgba(16,185,129,0.15)',
                                    color: '#86efac',
                                    border: '1px solid rgba(16,185,129,0.4)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {fulfillingRequestId === request.id ? 'Registrando Compra...' : 'Registrar Compra e Dar Entrada no Estoque'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: 14 }}>
                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <tr>
                    <th style={{ padding: 12, textAlign: 'left' }}>Item</th>
                    <th style={{ padding: 12, textAlign: 'center', width: 100 }}>Qtd</th>
                    {!isOperationalView && <th style={{ padding: 12, textAlign: 'right', width: 150 }}>Unitário (R$)</th>}
                    {!isOperationalView && <th style={{ padding: 12, textAlign: 'right', width: 150 }}>Total (R$)</th>}
                    {!isView && <th style={{ padding: 12, width: 50 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {itemsMaterials.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 8 }}>
                        <select 
                          className={`${styles.formSelect} ${styles.tableInput}`} disabled={isView}
                          value={item.materialId} onChange={e => updateMaterialItem(idx, 'materialId', e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {availableMaterials.map(m => (
                            <option key={m.id} value={m.id.toString()}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 8 }}>
                        <input 
                          type="number" className={`${styles.formInput} ${styles.tableInput}`} disabled={isView}
                          value={item.quantity} onChange={e => updateMaterialItem(idx, 'quantity', e.target.value)}
                        />
                      </td>
                      {!isOperationalView && (
                        <td style={{ padding: 8 }}>
                          <input 
                            type="number" className={`${styles.formInput} ${styles.tableInput}`} style={{ textAlign: 'right' }} disabled={isView}
                            value={item.unitPrice} onChange={e => updateMaterialItem(idx, 'unitPrice', e.target.value)}
                          />
                        </td>
                      )}
                      {!isOperationalView && (
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>
                          {item.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {!isView && (
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <button type="button" onClick={() => removeMaterialItem(idx)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {itemsMaterials.length === 0 && (
                    <tr><td colSpan={isOperationalView ? 2 : 5} style={{ padding: 20, textAlign: 'center', color: '#8a99a8' }}>Nenhuma peça adicionada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA DE MÃO DE OBRA */}
          <div className={styles.fullWidth} style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Hammer size={20} /> Mão de Obra e Serviços
              </h3>
              {!isView && (
                <button type="button" onClick={addServiceItem} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                  <Plus size={16} /> Adicionar Serviço
                </button>
              )}
            </div>

            <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: 14 }}>
                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <tr>
                    <th style={{ padding: 12, textAlign: 'left' }}>Serviço</th>
                    <th style={{ padding: 12, textAlign: 'left' }}>Responsável</th>
                    <th style={{ padding: 12, textAlign: 'center', width: 80 }}>Horas</th>
                    {!isOperationalView && <th style={{ padding: 12, textAlign: 'right', width: 120 }}>Vl. Hora (R$)</th>}
                    {!isOperationalView && <th style={{ padding: 12, textAlign: 'right', width: 120 }}>Total (R$)</th>}
                    {!isView && <th style={{ padding: 12, width: 50 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {itemsServices.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 8 }}>
                        <select 
                          className={`${styles.formSelect} ${styles.tableInput}`} disabled={isView}
                          value={item.serviceId} onChange={e => updateServiceItem(idx, 'serviceId', e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {availableServices.map(s => (
                            <option key={s.id} value={s.id.toString()}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 8 }}>
                        <select 
                          className={`${styles.formSelect} ${styles.tableInput}`} disabled={isView}
                          value={item.employeeId} onChange={e => updateServiceItem(idx, 'employeeId', e.target.value)}
                        >
                          <option value="">Selecione o técnico...</option>
                          {employees.map(e => (
                            <option key={e.id} value={e.id.toString()}>{e.person?.naturalPerson?.name || 'Funcionário'}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 8 }}>
                        <input 
                          type="number" className={`${styles.formInput} ${styles.tableInput}`} disabled={isView}
                          value={item.hoursWorked} onChange={e => updateServiceItem(idx, 'hoursWorked', e.target.value)}
                        />
                      </td>
                      {!isOperationalView && (
                        <td style={{ padding: 8 }}>
                          <input 
                            type="number" className={`${styles.formInput} ${styles.tableInput}`} style={{ textAlign: 'right' }} disabled={isView}
                            value={item.unitPrice} onChange={e => updateServiceItem(idx, 'unitPrice', e.target.value)}
                          />
                        </td>
                      )}
                      {!isOperationalView && (
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>
                          {item.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {!isView && (
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <button type="button" onClick={() => removeServiceItem(idx)} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {itemsServices.length === 0 && (
                    <tr><td colSpan={isOperationalView ? 3 : 6} style={{ padding: 20, textAlign: 'center', color: '#8a99a8' }}>Nenhum serviço adicionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {id && (
            <div className={styles.fullWidth} style={{ marginTop: 32 }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 16,
                padding: 16,
              }}>
                <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, color: '#38bdf8' }}>Apontamento Real de Produção</h3>

                {!isView && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <div>
                      <label className={styles.label}>Operação</label>
                      <select
                        className={styles.formSelect}
                        value={operationForm.operationType}
                        onChange={(e) => setOperationForm({ ...operationForm, operationType: e.target.value })}
                      >
                        <option value="USINAGEM">Usinagem</option>
                        <option value="CALDEIRARIA">Caldeiraria</option>
                        <option value="MONTAGEM">Montagem</option>
                      </select>
                    </div>
                    <div>
                      <label className={styles.label}>Turno</label>
                      <select
                        className={styles.formSelect}
                        value={operationForm.shift}
                        onChange={(e) => setOperationForm({ ...operationForm, shift: e.target.value })}
                      >
                        <option value="MORNING">Manhã</option>
                        <option value="AFTERNOON">Tarde</option>
                        <option value="NIGHT">Noite</option>
                      </select>
                    </div>
                    <div>
                      <label className={styles.label}>Responsável</label>
                      <select
                        className={styles.formSelect}
                        value={operationForm.employeeId}
                        onChange={(e) => setOperationForm({ ...operationForm, employeeId: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id.toString()}>
                            {emp.person?.naturalPerson?.name || 'Funcionário'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={styles.label}>Início Real</label>
                      <input
                        type="datetime-local"
                        className={styles.formInput}
                        value={operationForm.startAt}
                        onChange={(e) => setOperationForm({ ...operationForm, startAt: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={styles.label}>Fim Real</label>
                      <input
                        type="datetime-local"
                        className={styles.formInput}
                        value={operationForm.endAt}
                        onChange={(e) => setOperationForm({ ...operationForm, endAt: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={styles.label}>Parada (min)</label>
                      <input
                        type="number"
                        min={0}
                        className={styles.formInput}
                        value={operationForm.downtimeMinutes}
                        onChange={(e) => setOperationForm({ ...operationForm, downtimeMinutes: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className={styles.label}>Categoria da Parada</label>
                      <select
                        className={styles.formSelect}
                        value={operationForm.downtimeCategory}
                        onChange={(e) => setOperationForm({ ...operationForm, downtimeCategory: e.target.value })}
                      >
                        <option value="MACHINE">Máquina</option>
                        <option value="MATERIAL">Material</option>
                        <option value="SETUP">Setup</option>
                        <option value="RETRABALHO">Retrabalho</option>
                        <option value="QUALIDADE">Qualidade</option>
                        <option value="OUTROS">Outros</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className={styles.label}>Motivo da Parada</label>
                      <input
                        className={styles.formInput}
                        value={operationForm.downtimeReason}
                        onChange={(e) => setOperationForm({ ...operationForm, downtimeReason: e.target.value })}
                        placeholder="Ex: Falta de matéria-prima"
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className={styles.label}>Observações</label>
                      <input
                        className={styles.formInput}
                        value={operationForm.notes}
                        onChange={(e) => setOperationForm({ ...operationForm, notes: e.target.value })}
                        placeholder="Detalhes do apontamento"
                      />
                    </div>
                  </div>
                )}

                {!isView && (
                  <button
                    type="button"
                    onClick={handleAddOperationLog}
                    disabled={savingOperation}
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.45)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      marginBottom: 12,
                    }}
                  >
                    {savingOperation ? 'Registrando...' : 'Registrar Apontamento'}
                  </button>
                )}

                <div style={{ background: 'rgba(2,6,23,0.4)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.16)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <tr>
                        <th style={{ padding: 10, textAlign: 'left' }}>Operação</th>
                        <th style={{ padding: 10, textAlign: 'left' }}>Responsável</th>
                        <th style={{ padding: 10, textAlign: 'left' }}>Início/Fim</th>
                        <th style={{ padding: 10, textAlign: 'right' }}>Horas</th>
                        <th style={{ padding: 10, textAlign: 'right' }}>Parada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationLogs.map((log) => (
                        <tr key={log.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: 10 }}>
                            <div>{log.operationType}</div>
                            <div style={{ color: '#94a3b8', fontSize: 11 }}>{log.shift || '-'}</div>
                          </td>
                          <td style={{ padding: 10 }}>
                            {log.employee?.person?.naturalPerson?.name || 'Não informado'}
                          </td>
                          <td style={{ padding: 10 }}>
                            <div>{formatDateTimeLabel(log.startAt)}</div>
                            <div style={{ color: '#94a3b8', fontSize: 11 }}>{formatDateTimeLabel(log.endAt)}</div>
                          </td>
                          <td style={{ padding: 10, textAlign: 'right', fontWeight: 700 }}>
                            {Number(log.workedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}h
                          </td>
                          <td style={{ padding: 10, textAlign: 'right' }}>
                            {Number(log.downtimeMinutes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} min
                          </td>
                        </tr>
                      ))}
                      {operationLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>
                            Nenhum apontamento operacional registrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {operationsEfficiency && (
                  <div style={{ marginTop: 14, background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 800, marginBottom: 8 }}>Eficiência Operacional (janela recente)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>Horas trabalhadas</div>
                        <div style={{ color: '#fff', fontWeight: 800 }}>
                          {Number(operationsEfficiency?.totals?.workedHours || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>Paradas</div>
                        <div style={{ color: '#fff', fontWeight: 800 }}>
                          {Number(operationsEfficiency?.totals?.downtimeMinutes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} min
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>Eficiência global</div>
                        <div style={{ color: '#10b981', fontWeight: 900 }}>
                          {Number(operationsEfficiency?.totals?.efficiencyPercent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>Paradas por categoria</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {Object.entries(operationsEfficiency?.downtimeByCategory || {}).map(([key, value]: any) => (
                        <span key={String(key)} style={{
                          background: 'rgba(148,163,184,0.15)',
                          borderRadius: 999,
                          padding: '4px 8px',
                          fontSize: 11,
                          color: '#e2e8f0'
                        }}>
                          {String(key)}: {Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} min
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOTALIZADOR PREMIUM */}
          {showFinancialData && (
          <div className={styles.fullWidth} style={{ 
            marginTop: 50, 
            padding: 40, 
            background: 'rgba(15, 23, 42, 0.6)', 
            borderRadius: 32, 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 40,
            alignItems: 'center'
          }}>
            {/* Controles de Margem */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingRight: 40, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ color: '#94a3b8' }}>
                  <Percent size={14} /> Impostos (%)
                </label>
                <div className={styles.inputWrapper}>
                  <input 
                    type="number" 
                    className={`${styles.formInput} ${styles.tableInput}`}
                    style={{ paddingLeft: 12, height: 50, fontSize: 18 }}
                    value={formData.taxPercent}
                    onChange={e => setFormData({...formData, taxPercent: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Equivale a: <span style={{ color: '#fff' }}>R$ {((itemsMaterials.reduce((acc, i) => acc + i.totalPrice, 0) + itemsServices.reduce((acc, i) => acc + i.totalPrice, 0)) * (1 + formData.profitPercent / 100) * formData.taxPercent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ color: '#94a3b8' }}>
                  <TrendingUp size={14} /> Lucro (%)
                </label>
                <div className={styles.inputWrapper}>
                  <input 
                    type="number" 
                    className={`${styles.formInput} ${styles.tableInput}`}
                    style={{ paddingLeft: 12, height: 50, fontSize: 18 }}
                    value={formData.profitPercent}
                    onChange={e => setFormData({...formData, profitPercent: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Equivale a: <span style={{ color: '#fff' }}>R$ {((itemsMaterials.reduce((acc, i) => acc + i.totalPrice, 0) + itemsServices.reduce((acc, i) => acc + i.totalPrice, 0)) * formData.profitPercent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 14 }}>
                <span>Subtotal (Itens + Serviços)</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>R$ {(itemsMaterials.reduce((acc, i) => acc + i.totalPrice, 0) + itemsServices.reduce((acc, i) => acc + i.totalPrice, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 14 }}>
                <span>Total de Encargos / Lucro</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  R$ {((itemsMaterials.reduce((acc, i) => acc + i.totalPrice, 0) + itemsServices.reduce((acc, i) => acc + i.totalPrice, 0)) * (formData.profitPercent / 100) + 
                       (itemsMaterials.reduce((acc, i) => acc + i.totalPrice, 0) + itemsServices.reduce((acc, i) => acc + i.totalPrice, 0)) * (1 + formData.profitPercent / 100) * (formData.taxPercent / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ 
                marginTop: 10,
                padding: '24px 0',
                borderTop: '2px dashed rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: '#00e6b0', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>VALOR TOTAL FINAL</div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: '#00e6b0', lineHeight: 1 }}>
                    R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ color: '#475569', fontSize: 11, fontStyle: 'italic' }}>
                  Valores em Reais (BRL)
                </div>
              </div>
            </div>
          </div>
          )}

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 32 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading ? 'Sincronizando...' : id ? 'Salvar Alterações' : 'Gerar Orçamento / OS'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ServiceOrderForm;
