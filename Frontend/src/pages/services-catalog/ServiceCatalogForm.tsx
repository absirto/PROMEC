import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tag, FileText, Banknote, ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';

interface ServiceCatalogFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const ServiceCatalogForm: React.FC<ServiceCatalogFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id && (isEdit || isView)) {
      setLoading(true);
      api.get(`/services/${id}`)
        .then((data: any) => setFormData({
          name: data.name || '',
          description: data.description || '',
          price: data.price || 0
        }))
        .catch(() => setError('Erro ao carregar serviço.'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/services/${id}`, formData);
      } else {
        await api.post('/services', formData);
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

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <Tag size={16} /> Nome Amigável do Serviço
            </label>
            <div className={styles.inputWrapper}>
              <Tag className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="text"
                disabled={isView}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Manutenção Preventiva Motor"
                required
              />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <FileText size={16} /> Descrição / Escopo
            </label>
            <textarea
              className={styles.formTextarea}
              disabled={isView}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o que está incluso neste serviço..."
            />
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <Banknote size={16} /> Preço Base de Referência
            </label>
            <div className={styles.inputWrapper}>
              <Banknote className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="number"
                step="0.01"
                disabled={isView}
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          {error && <div className={styles.fullWidth + ' ' + styles.errorMsg}>{error}</div>}

          {!isView && (
            <button className={styles.fullWidth + ' ' + styles.submitBtn} type="submit" disabled={loading}>
              <Save size={18} style={{ marginRight: 8 }} />
              {loading ? 'Salvando...' : 'Salvar no Catálogo'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default ServiceCatalogForm;
