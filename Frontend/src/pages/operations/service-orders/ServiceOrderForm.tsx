import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import {
  Wrench, User, ClipboardList, ArrowLeft, Save,
  Plus, Trash2, Package, Hammer, Settings, 
  Layers, DollarSign, Calendar, Clock, Activity,
  ShieldCheck, Info, FileText, CheckCircle2, AlertCircle,
  Percent, TrendingUp
} from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseForm.module.css';
import { useToast } from '../../../components/ToastProvider';
import Skeleton from '../../../components/Skeleton';

interface OSItemMaterial {
  materialId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OSItemService {
  serviceId: string;
  employeeId: string;
  description: string;
  hoursWorked: number;
  unitPrice: number;
  totalPrice: number;
}

interface ServiceOrderFormData {
  description: string;
  problemDescription: string;
  technicalDiagnosis: string;
  status: string;
  personId: string;
  openingDate: string;
  estimatedFinishDate: string;
  workCenter: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedHours: number;
  taxPercent: number;
  profitPercent: number;
  materials: OSItemMaterial[];
  services: OSItemService[];
}

interface ServiceOrderFormProps {
  isEdit?: boolean;
  isView?: boolean;
  showFinancialData?: boolean;
  listPath?: string;
}

const ServiceOrderForm: React.FC<ServiceOrderFormProps> = ({ 
  isEdit, 
  isView, 
  showFinancialData: propShowFinancialData = true, 
  listPath = '/service-orders' 
}) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'items' | 'operations'>('general');
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const hasFinanceAccess = user?.role === 'admin' || user?.group?.permissions?.includes('financeiro:visualizar');
  const showFinancialData = propShowFinancialData && hasFinanceAccess;

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<ServiceOrderFormData>({
    defaultValues: {
      status: 'Orçamento',
      openingDate: new Date().toISOString().split('T')[0],
      taxPercent: 0,
      profitPercent: 0,
      materials: [],
      services: []
    }
  });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({ control, name: 'materials' });
  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({ control, name: 'services' });

  const watchedMaterials = useWatch({ control, name: 'materials' }) || [];
  const watchedServices = useWatch({ control, name: 'services' }) || [];
  const watchedTax = useWatch({ control, name: 'taxPercent' }) || 0;
  const watchedProfit = useWatch({ control, name: 'profitPercent' }) || 0;

  const totals = useMemo(() => {
    const matTotal = watchedMaterials.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);
    const svcTotal = watchedServices.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);
    const subtotal = matTotal + svcTotal;
    const profitAmount = subtotal * (Number(watchedProfit) / 100);
    const baseForTax = subtotal + profitAmount;
    const taxAmount = baseForTax * (Number(watchedTax) / 100);
    return { matTotal, svcTotal, subtotal, profitAmount, taxAmount, total: baseForTax + taxAmount };
  }, [watchedMaterials, watchedServices, watchedTax, watchedProfit]);

  const [people, setPeople] = useState<any[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/people').catch(() => []),
      api.get('/materials').catch(() => []),
      api.get('/services').catch(() => []),
      api.get('/employees').catch(() => [])
    ]).then(([p, m, s, e]) => {
      setPeople((Array.isArray(p) ? p : p?.data) || []);
      setAvailableMaterials(m);
      setAvailableServices(s);
      setEmployees(e);
    });

    if (id && (isEdit || isView)) {
      api.get(`/service-orders/${id}`).then((data: any) => {
        reset({
          ...data,
          personId: data.personId?.toString() || '',
          openingDate: data.openingDate?.split('T')[0] || '',
          estimatedFinishDate: data.estimatedFinishDate?.split('T')[0] || '',
          plannedStartDate: data.plannedStartDate?.split('T')[0] || '',
          plannedEndDate: data.plannedEndDate?.split('T')[0] || '',
          materials: (data.materials || []).map((m: any) => ({ ...m, materialId: m.materialId?.toString() })),
          services: (data.services || []).map((s: any) => ({ ...s, serviceId: s.serviceId?.toString(), employeeId: s.employeeId?.toString() }))
        });
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isEdit, isView, reset]);

  const onSubmit = async (data: ServiceOrderFormData) => {
    if (isView) return;
    setLoading(true);
    try {
      const payload = {
        ...data,
        personId: parseInt(data.personId),
        materials: (data.materials || []).map(m => ({ 
          ...m, 
          materialId: parseInt(m.materialId), 
          quantity: Number(m.quantity) || 0,
          unitPrice: Number(m.unitPrice) || 0,
          totalPrice: (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0)
        })),
        services: (data.services || []).map(s => ({ 
          ...s, 
          serviceId: parseInt(s.serviceId), 
          employeeId: s.employeeId ? parseInt(s.employeeId) : null,
          hoursWorked: Number(s.hoursWorked) || 0,
          unitPrice: Number(s.unitPrice) || 0,
          totalPrice: (Number(s.hoursWorked) || 0) * (Number(s.unitPrice) || 0)
        }))
      };
      if (id) await api.put(`/service-orders/${id}`, payload);
      else await api.post('/service-orders', payload);
      showToast('Ordem de Serviço salva com sucesso!');
      navigate(listPath);
    } catch {
      showToast('Erro ao salvar Ordem de Serviço.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !id) return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <Skeleton width="100%" height="500px" borderRadius="32px" />
      </div>
    </div>
  );

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h2 className={styles.title}>
              {isView ? `Ordem de Serviço #${id}` : isEdit ? `Editando OS #${id}` : 'Novo Orçamento de Serviço'}
            </h2>
            <div className={styles.statusRow}>
              <div className={styles.badgeLabel} style={{ background: 'rgba(45, 212, 191, 0.1)', color: 'var(--primary)' }}>
                <Activity size={12} /> Operacional
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {isView ? 'Histórico completo e apontamentos' : 'Planejamento de recursos e cronograma técnico'}
              </p>
            </div>
          </div>
          <button className={styles.backBtn} onClick={() => navigate(listPath)}>
            <ArrowLeft size={16} /> <span>Voltar</span>
          </button>
        </header>

        {/* Navigation Tabs - Modern Glassmorphism */}
        <nav className={styles.tabsContainer}>
          <button 
            type="button"
            className={`${styles.tabButton} ${activeTab === 'general' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <ClipboardList size={18} /> <span>Geral & Planejamento</span>
          </button>
          <button 
            type="button"
            className={`${styles.tabButton} ${activeTab === 'items' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <Layers size={18} /> <span>Recursos & Custos</span>
          </button>
          <button 
            type="button"
            className={`${styles.tabButton} ${activeTab === 'operations' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            <Wrench size={18} /> <span>Execução Técnica</span>
          </button>
        </nav>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, animation: 'fadeIn 0.4s var(--spring-smooth)' }}>
              <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
                <label className={styles.label}>Objeto do Serviço / Título</label>
                <div className={styles.inputWrapper}>
                  <FileText className={styles.inputIcon} size={18} />
                  <input 
                    className={styles.formInput} 
                    disabled={isView} 
                    {...register('description', { required: 'Título é obrigatório' })} 
                    placeholder="Ex: Revisão Geral de 60.000km - Unidade Móvel" 
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Cliente / Beneficiário</label>
                <div className={styles.inputWrapper}>
                  <User className={styles.inputIcon} size={18} />
                  <select className={styles.formSelect} disabled={isView} {...register('personId', { required: true })}>
                    <option value="">Selecione o cliente...</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.naturalPerson?.name || p.legalPerson?.corporateName}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Status da Operação</label>
                <div className={styles.inputWrapper}>
                  <CheckCircle2 className={styles.inputIcon} size={18} />
                  <select className={styles.formSelect} disabled={isView} {...register('status')}>
                    <option value="Orçamento">Orçamento / Planejamento</option>
                    <option value="Aprovada">Aprovada para Execução</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Concluída">Finalizada</option>
                    <option value="Cancelada">Cancelada / Suspensa</option>
                  </select>
                </div>
              </div>

              <div className={styles.fullWidth}>
                <div className={styles.bentoSection}>
                  <div className={styles.sectionHeaderMini}>
                    <Calendar size={16} /> Planejamento de Cronograma (PCP)
                  </div>
                  <div className={styles.bentoGrid3}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Centro de Trabalho</label>
                      <input className={styles.formInput} disabled={isView} {...register('workCenter')} placeholder="Ex: Oficina Central" />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Início Previsto</label>
                      <input type="date" className={styles.formInput} disabled={isView} {...register('plannedStartDate')} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Entrega Estimada</label>
                      <input type="date" className={styles.formInput} disabled={isView} {...register('plannedEndDate')} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Solicitação do Cliente / Problema Relatado</label>
                <textarea className={styles.formTextarea} disabled={isView} {...register('problemDescription')} style={{ minHeight: 140 }} placeholder="Descreva os sintomas ou a solicitação original..." />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Diagnóstico Técnico / Observações</label>
                <textarea className={styles.formTextarea} disabled={isView} {...register('technicalDiagnosis')} style={{ minHeight: 140 }} placeholder="Parecer técnico preliminar..." />
              </div>
            </div>
          )}

          {/* TAB: ITEMS & FINANCE */}
          {activeTab === 'items' && (
            <div className={styles.fullWidth} style={{ animation: 'fadeIn 0.4s var(--spring-smooth)' }}>
              
              {/* Materiais Grid */}
              <div style={{ marginBottom: 48 }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Package size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: 18 }}>Materiais & Peças</h3>
                  </div>
                  {!isView && (
                    <button type="button" onClick={() => appendMaterial({ materialId: '', quantity: 1, unitPrice: 0, totalPrice: 0 })} className={styles.addItemBtn}>
                      <Plus size={16} /> Adicionar Item
                    </button>
                  )}
                </header>

                <div className={styles.tableWrapper}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Item de Estoque</th>
                        <th style={{ width: 100 }}>Qtd</th>
                        <th style={{ width: 140, textAlign: 'right' }}>Unitário</th>
                        <th style={{ width: 140, textAlign: 'right' }}>Total</th>
                        {!isView && <th style={{ width: 60 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {materialFields.map((field, idx) => (
                        <tr key={field.id}>
                          <td>
                            <select className={styles.formSelect} disabled={isView} {...register(`materials.${idx}.materialId`, {
                              onChange: (e) => {
                                const m = availableMaterials.find(x => x.id.toString() === e.target.value);
                                if (m) { 
                                  setValue(`materials.${idx}.unitPrice`, m.price); 
                                  setValue(`materials.${idx}.totalPrice`, (watchedMaterials[idx]?.quantity || 1) * m.price); 
                                }
                              }
                            })}>
                              <option value="">Selecione um material...</option>
                              {availableMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="number" className={styles.formInput} disabled={isView} {...register(`materials.${idx}.quantity`, { 
                              onChange: (e) => setValue(`materials.${idx}.totalPrice`, (parseFloat(e.target.value) || 0) * (watchedMaterials[idx]?.unitPrice || 0)) 
                            })} />
                          </td>
                          <td>
                            <input type="number" step="0.01" className={styles.formInput} style={{ textAlign: 'right' }} disabled={isView} {...register(`materials.${idx}.unitPrice`, { 
                              onChange: (e) => setValue(`materials.${idx}.totalPrice`, (parseFloat(e.target.value) || 0) * (watchedMaterials[idx]?.quantity || 0)) 
                            })} />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                            R$ {(watchedMaterials[idx]?.totalPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          {!isView && (
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" onClick={() => removeMaterial(idx)} className={styles.removeBtn}><Trash2 size={16} /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {materialFields.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                            Nenhum material adicionado a este orçamento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary Bento */}
              {showFinancialData && (
                <div className={styles.financialBento}>
                  <div className={styles.financialInputs}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Carga Tributária (%)</label>
                      <div className={styles.inputWrapper}>
                        <Percent className={styles.inputIcon} size={16} />
                        <input type="number" className={styles.formInput} {...register('taxPercent')} placeholder="0" />
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Margem Operacional (%)</label>
                      <div className={styles.inputWrapper}>
                        <TrendingUp className={styles.inputIcon} size={16} />
                        <input type="number" className={styles.formInput} {...register('profitPercent')} placeholder="0" />
                      </div>
                    </div>
                    <div className={styles.infoBox}>
                      <Info size={16} />
                      <p>Os totais são calculados em tempo real incluindo insumos e mão de obra planejada.</p>
                    </div>
                  </div>

                  <div className={styles.financialSummary}>
                    <div className={styles.summaryRow}>
                      <span>Subtotal Materiais</span>
                      <span>{totals.matTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Subtotal Serviços</span>
                      <span>{totals.svcTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.totalBlock}>
                      <span className={styles.totalLabel}>INVESTIMENTO TOTAL</span>
                      <span className={styles.totalValue}>{totals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: OPERATIONS (Real-time monitoring placeholder) */}
          {activeTab === 'operations' && (
            <div className={styles.fullWidth} style={{ animation: 'fadeIn 0.4s var(--spring-smooth)' }}>
              <div className={styles.emptyModuleState}>
                <Wrench size={48} className={styles.spinningIcon} />
                <h3>Monitoramento de Linha de Produção</h3>
                <p>O controle de apontamentos e produtividade em tempo real estará disponível assim que a OS for movida para o status "Em Execução".</p>
                <div className={styles.opStatsGrid}>
                  <div className={styles.opStatCard}>
                    <Clock size={20} />
                    <div>
                      <span className={styles.opStatVal}>0.0h</span>
                      <span className={styles.opStatLab}>Apontadas</span>
                    </div>
                  </div>
                  <div className={styles.opStatCard}>
                    <Activity size={20} />
                    <div>
                      <span className={styles.opStatVal}>0%</span>
                      <span className={styles.opStatLab}>Eficiência</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isView && (
            <div className={styles.formFooter}>
              <div className={styles.footerInfo}>
                <ShieldCheck size={16} />
                <span>Dados validados conforme padrões ProMEC de segurança.</span>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                <Save size={18} />
                <span>{id ? 'Salvar Alterações' : 'Confirmar & Iniciar OS'}</span>
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};

export default ServiceOrderForm;
