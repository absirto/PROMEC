import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Package, Banknote, Tag, ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';

interface MaterialFormData {
  name: string;
  description: string;
  price: number;
  unit: string;
  active: boolean;
}

interface MaterialFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const MaterialForm: React.FC<MaterialFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MaterialFormData>({
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      unit: '',
      active: true
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id && (isEdit || isView)) {
      setLoading(true);
      api.get(`/materials/${id}`)
        .then((data: any) => reset(data))
        .catch(() => showToast('Erro ao carregar material.', 'error'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView, showToast, reset]);

  const onSubmit = async (data: MaterialFormData) => {
    if (isView) return;
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/materials/${id}`, data);
        showToast('Material atualizado com sucesso!');
      } else {
        await api.post('/materials', data);
        showToast('Novo material cadastrado!');
      }
      navigate('/materials');
    } catch (err: any) {
      showToast('Erro ao salvar material.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Visualizar Material' : isEdit ? 'Editar Material' : 'Novo Material'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/materials')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>Nome do Material / Item de Estoque</label>
            <div className={`${styles.inputWrapper} ${errors.name ? styles.inputError : ''}`}>
              <Package className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="text"
                disabled={isView}
                {...register('name', { 
                  required: 'O nome do material é obrigatório',
                  minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                })}
                placeholder="Ex: Óleo 5W30, Pastilha de Freio..."
              />
            </div>
            {errors.name && <span className={styles.errorMessage}>{errors.name.message}</span>}
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>Descrição Detalhada</label>
            <textarea
              className={styles.formTextarea}
              disabled={isView}
              {...register('description')}
              placeholder="Especificações técnicas, marca, shelf-life..."
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Preço de Venda Unitário</label>
            <div className={`${styles.inputWrapper} ${errors.price ? styles.inputError : ''}`}>
              <Banknote className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="number"
                step="0.01"
                disabled={isView}
                {...register('price', { 
                  required: 'O preço é obrigatório',
                  min: { value: 0.01, message: 'O preço deve ser maior que zero' },
                  valueAsNumber: true
                })}
              />
            </div>
            {errors.price && <span className={styles.errorMessage}>{errors.price.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Unidade (un, kg, l, m)</label>
            <div className={`${styles.inputWrapper} ${errors.unit ? styles.inputError : ''}`}>
              <Tag className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="text"
                disabled={isView}
                {...register('unit', { required: 'A unidade é obrigatória' })}
                placeholder="un"
              />
            </div>
            {errors.unit && <span className={styles.errorMessage}>{errors.unit.message}</span>}
          </div>

          <div className={styles.fullWidth}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12 }}>
              <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 12, cursor: isView ? 'default' : 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  disabled={isView}
                  {...register('active')}
                  style={{ width: 22, height: 22, cursor: 'pointer' }}
                />
                Material Ativo e Disponível para Ordens de Serviço
              </label>
            </div>
          </div>

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 24 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading || isSubmitting ? 'Salvando...' : 'Atualizar Catálogo'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default MaterialForm;
