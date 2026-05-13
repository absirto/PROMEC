import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import {
  Wrench, User, ClipboardList, ArrowLeft, Save,
  FileDown, Plus, Trash2,
  Package, Hammer, Percent, TrendingUp,
  Settings, Layers, DollarSign
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
  const [materialsCoverage, setMaterialsCoverage] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/people').catch(() => []),
      api.get('/materials').catch(() => []),
      api.get('/services').catch(() => []),
      api.get('/employees').catch(() => [])
    ]).then(([p, m, s, e]) => {
      setPeople(p);
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
        materials: data.materials.map(m => ({ ...m, materialId: parseInt(m.materialId), totalPrice: m.quantity * m.unitPrice })),
        services: data.services.map(s => ({ ...s, serviceId: parseInt(s.serviceId), totalPrice: s.hoursWorked * s.unitPrice }))
      };
      if (id) await api.put(`/service-orders/${id}`, payload);
      else await api.post('/service-orders', payload);
      showToast('Operação realizada com sucesso!');
      navigate(listPath);
    } catch {
      showToast('Erro ao salvar Ordem de Serviço.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <Skeleton width="100%" height="400px" borderRadius="32px" />
      </div>
    </div>
  );

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Visualizar OS' : isEdit ? 'Edição de Planejamento' : 'Novo Orçamento'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate(listPath)}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        {/* Sistema de Abas */}
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'general' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={18} /> Geral & Planejamento
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'items' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <Layers size={18} /> Itens & Financeiro
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'operations' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            <Wrench size={18} /> Operações
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          
          {/* ABA GERAL */}
          {activeTab === 'general' && (
            <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, animation: 'fadeIn 0.4s var(--spring)' }}>
              <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
                <label className={styles.label}>Título da Ordem / Descrição</label>
                <div className={styles.inputWrapper}>
                  <ClipboardList className={styles.inputIcon} size={18} />
                  <input className={styles.formInput} disabled={isView} {...register('description', { required: true })} placeholder="Ex: Manutenção Preventiva Corretiva" />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Cliente</label>
                <select className={styles.formSelect} disabled={isView} {...register('personId', { required: true })}>
                  <option value="">Selecione o cliente...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.naturalPerson?.name || p.legalPerson?.corporateName}</option>)}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Status</label>
                <select className={styles.formSelect} disabled={isView} {...register('status')}>
                  <option value="Orçamento">Orçamento / Aberto</option>
                  <option value="Aprovada">Aprovada</option>
                  <option value="Em Andamento">Em Execução</option>
                  <option value="Concluída">Finalizada</option>
                </select>
              </div>

              <div className={styles.fullWidth} style={{ background: 'rgba(255,255,255,0.02)', padding: 24, borderRadius: 24, border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div className={styles.fieldGroup}><label className={styles.label}>Centro de Trabalho</label><input className={styles.formInput} disabled={isView} {...register('workCenter')} /></div>
                <div className={styles.fieldGroup}><label className={styles.label}>Início Planejado</label><input type="date" className={styles.formInput} disabled={isView} {...register('plannedStartDate')} /></div>
                <div className={styles.fieldGroup}><label className={styles.label}>Fim Planejado</label><input type="date" className={styles.formInput} disabled={isView} {...register('plannedEndDate')} /></div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Relato do Problema</label>
                <textarea className={styles.formTextarea} disabled={isView} {...register('problemDescription')} style={{ minHeight: 120 }} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Diagnóstico Técnico</label>
                <textarea className={styles.formTextarea} disabled={isView} {...register('technicalDiagnosis')} style={{ minHeight: 120 }} />
              </div>
            </div>
          )}

          {/* ABA ITENS E FINANCEIRO */}
          {activeTab === 'items' && (
            <div className={styles.fullWidth} style={{ animation: 'fadeIn 0.4s var(--spring)' }}>
              
              {/* Seção de Materiais */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 12 }}><Package size={22} /> Peças e Insumos</h3>
                  {!isView && <button type="button" onClick={() => appendMaterial({ materialId: '', quantity: 1, unitPrice: 0, totalPrice: 0 })} className={styles.backBtn} style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}><Plus size={18} /> Adicionar Peça</button>}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <tr><th style={{ padding: 16, textAlign: 'left' }}>Item</th><th style={{ padding: 16, width: 100 }}>Qtd</th><th style={{ padding: 16, width: 150, textAlign: 'right' }}>Unitário</th><th style={{ padding: 16, width: 150, textAlign: 'right' }}>Total</th>{!isView && <th style={{ width: 60 }}></th>}</tr>
                    </thead>
                    <tbody>
                      {materialFields.map((field, idx) => (
                        <tr key={field.id} style={{ borderTop: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: 12 }}>
                            <select className={styles.formSelect} disabled={isView} {...register(`materials.${idx}.materialId`, {
                              onChange: (e) => {
                                const m = availableMaterials.find(x => x.id.toString() === e.target.value);
                                if (m) { setValue(`materials.${idx}.unitPrice`, m.price); setValue(`materials.${idx}.totalPrice`, (watchedMaterials[idx]?.quantity || 1) * m.price); }
                              }
                            })}>
                              <option value="">Selecione...</option>
                              {availableMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: 12 }}><input type="number" className={styles.formInput} disabled={isView} {...register(`materials.${idx}.quantity`, { onChange: (e) => setValue(`materials.${idx}.totalPrice`, (parseFloat(e.target.value) || 0) * (watchedMaterials[idx]?.unitPrice || 0)) })} /></td>
                          <td style={{ padding: 12 }}><input type="number" step="0.01" className={styles.formInput} style={{ textAlign: 'right' }} disabled={isView} {...register(`materials.${idx}.unitPrice`, { onChange: (e) => setValue(`materials.${idx}.totalPrice`, (parseFloat(e.target.value) || 0) * (watchedMaterials[idx]?.quantity || 0)) })} /></td>
                          <td style={{ padding: 12, textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>R$ {(watchedMaterials[idx]?.totalPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          {!isView && <td style={{ textAlign: 'center' }}><button type="button" onClick={() => removeMaterial(idx)} className={styles.actionBtn} style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo Financeiro */}
              {showFinancialData && (
                <div style={{ background: 'var(--bg-card)', padding: 40, borderRadius: 32, border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                   <div style={{ display: 'grid', gap: 20 }}>
                      <div className={styles.fieldGroup}><label className={styles.label}>Impostos (%)</label><input type="number" className={styles.formInput} {...register('taxPercent')} /></div>
                      <div className={styles.fieldGroup}><label className={styles.label}>Margem de Lucro (%)</label><input type="number" className={styles.formInput} {...register('profitPercent')} /></div>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}><span>Subtotal Direto</span><span style={{ color: '#fff' }}>{totals.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                      <div style={{ height: 1, background: 'var(--glass-border)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                         <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 900 }}>TOTAL FINAL</div>
                         <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--success)', fontFamily: 'Outfit' }}>{totals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* ABA OPERAÇÕES */}
          {activeTab === 'operations' && (
            <div className={styles.fullWidth} style={{ animation: 'fadeIn 0.4s var(--spring)' }}>
               <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.01)', borderRadius: 32, border: '1px solid var(--glass-border)' }}>
                  <Wrench size={48} color="var(--primary)" style={{ marginBottom: 20 }} />
                  <h3 style={{ color: '#fff' }}>Monitoramento de Produção</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Este módulo permite o apontamento em tempo real da eficiência do chão de fábrica vinculado a esta OS.</p>
                  <div style={{ marginTop: 32, display: 'inline-flex', gap: 16 }}>
                     <div style={{ background: 'var(--bg-card)', padding: '16px 32px', borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>HORAS APONTADAS</div>
                        <div style={{ fontSize: 24, fontWeight: 900 }}>0.0h</div>
                     </div>
                     <div style={{ background: 'var(--bg-card)', padding: '16px 32px', borderRadius: 20, border: '1px solid var(--glass-border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>STATUS PROD.</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--warning)' }}>Aguardando</div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 48, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting} style={{ width: 'auto', padding: '16px 48px' }}>
                <Save size={20} /> {id ? 'Atualizar Ordem' : 'Confirmar & Gerar'}
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};

export default ServiceOrderForm;
