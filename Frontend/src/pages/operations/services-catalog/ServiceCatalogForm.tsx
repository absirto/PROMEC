import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Tag, FileText, Banknote, ArrowLeft, Save } from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseForm.module.css';

interface ServiceCatalogFormData {
  name: string;
  description: string;
  price: number;
  active: boolean;
}

interface ServiceCatalogFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const ServiceCatalogForm: React.FC<ServiceCatalogFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ServiceCatalogFormData>({
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      active: true,
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id && (isEdit || isView)) {
      setLoading(true);
      api.get(`/services/${id}`)
        .then((data: any) => reset({
          name: data.name || '',
          description: data.description || '',
          price: data.price || 0,
          active: data.active !== undefined ? data.active : true,
        }))
        .catch(() => setError('Erro ao carregar serviço.'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView, reset]);

  const onSubmit = async (data: ServiceCatalogFormData) => {
    if (isView) return;
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/services/${id}`, data);
      } else {
        await api.post('/services', data);
      }
      navigate('/services-catalog');
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Erro ao salvar serviço.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Visualizar Serviço' : isEdit ? 'Editar Serviço' : 'Novo Serviço no Catálogo'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/services-catalog')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <Tag size={16} /> Nome Amigável do Serviço
            </label>
            <div className={`${styles.inputWrapper} ${errors.name ? styles.inputError : ''}`}>
              <Tag className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="text"
                disabled={isView}
                {...register('name', { 
                  required: 'O nome é obrigatório',
                  minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                })}
                placeholder="Ex: Manutenção Preventiva Motor"
              />
            </div>
            {errors.name && <span className={styles.errorMessage}>{errors.name.message}</span>}
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <FileText size={16} /> Descrição / Escopo
            </label>
            <textarea
              className={styles.formTextarea}
              disabled={isView}
              {...register('description')}
              placeholder="Descreva o que está incluso neste serviço..."
            />
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <Banknote size={16} /> Preço Base de Referência
            </label>
            <div className={`${styles.inputWrapper} ${errors.price ? styles.inputError : ''}`}>
              <Banknote className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="number"
                step="0.01"
                disabled={isView}
                {...register('price', { 
                  required: 'O preço é obrigatório',
                  valueAsNumber: true
                })}
              />
            </div>
            {errors.price && <span className={styles.errorMessage}>{errors.price.message}</span>}
          </div>

          {error && <div className={styles.fullWidth + ' ' + styles.errorMsg}>{error}</div>}

          {!isView && (
            <button className={styles.fullWidth + ' ' + styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
              <Save size={18} style={{ marginRight: 8 }} />
              {loading || isSubmitting ? 'Salvando...' : 'Salvar no Catálogo'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default ServiceCatalogForm;
