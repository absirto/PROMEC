import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Package, Banknote, Tag, ArrowLeft, Save, Info, AlertTriangle, Layers, CreditCard } from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseForm.module.css';
import { useToast } from '../../../components/ToastProvider';
import Skeleton from '../../../components/Skeleton';

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

  if (loading && !id) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.glassCard}>
           <Skeleton width="300px" height="40px" />
           <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
             <Skeleton height="200px" borderRadius="24px" />
             <Skeleton height="200px" borderRadius="24px" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h2 className={styles.title}>
              {isView ? 'Ficha Técnica do Item' : isEdit ? 'Edição de Material' : 'Novo Registro de Insumo'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {isView ? 'Consulta de especificações e valores de mercado' : 'Preencha os dados técnicos para o catálogo de almoxarifado'}
            </p>
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/materials')}>
            <ArrowLeft size={16} /> <span>Voltar</span>
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          {/* Sessão Identificação */}
          <div className={styles.fullWidth}>
            <div className={styles.sectionTitle}>
              <Layers size={18} /> Especificações Técnicas
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>Designação do Item</label>
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
                placeholder="Ex: Óleo de Motor 5W30 Sintético, Jogo de Pastilhas..."
              />
            </div>
            {errors.name && <span className={styles.errorMessage}>{errors.name.message}</span>}
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>Descrição Detalhada / Aplicação</label>
            <textarea
              className={styles.formTextarea}
              disabled={isView}
              {...register('description')}
              placeholder="Descreva marca, modelo, shelf-life e outras informações relevantes para o técnico."
              rows={4}
            />
          </div>

          {/* Sessão Comercial */}
          <div className={styles.fullWidth}>
            <div className={styles.sectionTitle} style={{ marginTop: 24 }}>
              <CreditCard size={18} /> Configuração Comercial
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Preço Unitário (Venda)</label>
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
                placeholder="0.00"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Unidade de Medida</label>
            <div className={`${styles.inputWrapper} ${errors.unit ? styles.inputError : ''}`}>
              <Tag className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} {...register('unit', { required: true })} disabled={isView}>
                <option value="un">Unidade (un)</option>
                <option value="l">Litro (l)</option>
                <option value="kg">Quilograma (kg)</option>
                <option value="m">Metro (m)</option>
                <option value="par">Par (par)</option>
                <option value="kit">Kit (kit)</option>
              </select>
            </div>
          </div>

          <div className={styles.fullWidth}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 14, cursor: isView ? 'default' : 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  disabled={isView}
                  {...register('active')}
                  style={{ width: 22, height: 22, cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <div>
                  Disponibilidade em Linha
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400, marginTop: 4 }}>
                    Itens desativados não aparecerão na criação de novas Ordens de Serviço.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 40 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
                <Save size={18} />
                <span>{id ? 'Atualizar Catálogo' : 'Confirmar Cadastro'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default MaterialForm;
