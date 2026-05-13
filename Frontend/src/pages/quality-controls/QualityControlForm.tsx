import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ClipboardCheck, Package, Wrench, ShieldAlert, ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';

interface QualityControlFormData {
  description: string;
  status: string;
  serviceOrderId: string;
  materialId: string;
}

interface QualityControlFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const QualityControlForm: React.FC<QualityControlFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<QualityControlFormData>({
    defaultValues: {
      description: '',
      status: 'Pendente',
      serviceOrderId: '',
      materialId: ''
    }
  });
  
  const [orders, setOrders] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/service-orders').catch(() => []),
      api.get('/materials').catch(() => [])
    ]).then(([ordersData, materialsData]: any[]) => {
      setOrders((Array.isArray(ordersData) ? ordersData : ordersData?.data) || []);
      setMaterials((Array.isArray(materialsData) ? materialsData : materialsData?.data) || []);
    }).catch(() => setError('Erro ao carregar dados de referência.'));

    if (id && (isEdit || isView)) {
      api.get(`/quality-controls/${id}`)
        .then((data: any) => reset({
          description: data.description || '',
          status: data.status || 'Pendente',
          serviceOrderId: data.serviceOrderId?.toString() || '',
          materialId: data.materialId?.toString() || ''
        }))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isEdit, isView, reset]);

  const onSubmit = async (data: QualityControlFormData) => {
    if (isView) return;
    
    setLoading(true);
    try {
      const payload = {
        ...data,
        serviceOrderId: data.serviceOrderId ? parseInt(data.serviceOrderId) : null,
        materialId: data.materialId ? parseInt(data.materialId) : null,
      };

      if (isEdit) {
        await api.put(`/quality-controls/${id}`, payload);
      } else {
        await api.post('/quality-controls', payload);
      }
      navigate('/quality-controls');
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Erro ao salvar controle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Inspeção Detalhada' : isEdit ? 'Editar Inspeção' : 'Novo Controle de Qualidade'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/quality-controls')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <ClipboardCheck size={16} /> Relatório de Inspeção / Observações
            </label>
            <textarea
              className={styles.formTextarea}
              disabled={isView}
              {...register('description', { required: 'A descrição é obrigatória' })}
              placeholder="Descreva aqui o resultado da inspeção ou controle realizado..."
            />
            {errors.description && <span className={styles.errorMsg}>{errors.description.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Wrench size={16} /> Ordem de Serviço Relacionada
            </label>
            <div className={styles.inputWrapper}>
              <Wrench className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                disabled={isView}
                {...register('serviceOrderId')}
              >
                <option value="">Nenhuma (Inspeção Geral)</option>
                {orders.map(o => <option key={o.id} value={o.id}>OS #{o.id} - {o.description}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Package size={16} /> Material Inspecionado
            </label>
            <div className={styles.inputWrapper}>
              <Package className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                disabled={isView}
                {...register('materialId')}
              >
                <option value="">Nenhum</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <ShieldAlert size={16} /> Status da Avaliação
            </label>
            <div className={styles.inputWrapper}>
              <ShieldAlert className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                disabled={isView}
                {...register('status')}
              >
                <option value="Pendente">🟡 Pendente / Aguardando</option>
                <option value="Aprovado">🟢 Aprovado / Conforme</option>
                <option value="Reprovado">🔴 Reprovado / Não Conforme</option>
                <option value="Aprovado com Restrição">🟠 Aprovado com Restrição</option>
              </select>
            </div>
          </div>

          {error && <div className={styles.fullWidth + ' ' + styles.errorMsg}>{error}</div>}

          {!isView && (
            <button className={styles.fullWidth + ' ' + styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
              <Save size={18} style={{ marginRight: 8 }} />
              {loading || isSubmitting ? 'Registrando...' : 'Salvar Controle de Qualidade'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default QualityControlForm;
