import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shield, Key, ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';

interface GroupFormData {
  name: string;
  permissions: string[];
}

interface GroupFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const GroupForm: React.FC<GroupFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<GroupFormData>({
    defaultValues: {
      name: '',
      permissions: []
    }
  });

  const selectedPermissions = watch('permissions') || [];
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/groups/permissions')
      .then((data: any) => setAvailablePermissions(data || []))
      .catch(() => showToast('Erro ao carregar permissões.', 'error'))
      .finally(() => {
        if (!id) setLoading(false);
      });

    if (id && (isEdit || isView)) {
      api.get(`/groups/${id}`)
        .then((data: any) => {
          reset({
            name: data.name || '',
            permissions: data.permissions ? data.permissions.map((p: any) => p.permission?.name || p.name) : []
          });
        })
        .catch(() => showToast('Erro ao carregar grupo.', 'error'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView, reset, showToast]);

  const handleTogglePermission = (perm: string) => {
    if (isView) return;
    const current = selectedPermissions;
    const next = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
    setValue('permissions', next, { shouldDirty: true });
  };

  const onSubmit = async (data: GroupFormData) => {
    if (isView) return;
    
    if (data.permissions.length === 0) {
      showToast('Selecione ao menos um módulo de acesso.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const payload = { name: data.name, permissionKeys: data.permissions };
      if (isEdit) {
        await api.put(`/groups/${id}`, payload);
        showToast('Grupo atualizado com sucesso!');
      } else {
        await api.post('/groups', payload);
        showToast('Grupo criado com sucesso!');
      }
      navigate('/groups');
    } catch (err: any) {
      showToast('Erro ao salvar grupo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Visualizar Grupo' : isEdit ? 'Editar Grupo' : 'Novo Grupo de Acesso'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/groups')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <Shield size={16} /> Nome Identificador do Grupo
            </label>
            <div className={`${styles.inputWrapper} ${errors.name ? styles.inputError : ''}`}>
              <Shield className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="text"
                disabled={isView}
                {...register('name', { required: 'Obrigatório' })}
                placeholder="Ex: Equipe de Vendas, Operadores de Pista..."
              />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <Key size={18} /> Módulos Disponíveis para este Grupo
          </div>

          <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {availablePermissions.map(perm => (
              <label 
                key={perm.id} 
                style={{ 
                   background: selectedPermissions.includes(perm.name) ? 'rgba(0, 230, 176, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                   border: `1px solid ${selectedPermissions.includes(perm.name) ? '#00e6b0' : 'rgba(255, 255, 255, 0.05)'}`,
                   padding: '16px',
                   borderRadius: 14,
                   display: 'flex',
                   alignItems: 'center',
                   gap: 12,
                   cursor: isView ? 'default' : 'pointer',
                   transition: 'all 0.2s',
                   boxShadow: selectedPermissions.includes(perm.name) ? '0 4px 12px rgba(0, 230, 176, 0.1)' : 'none'
                }}
              >
                <input
                  type="checkbox"
                  disabled={isView}
                  checked={selectedPermissions.includes(perm.name)}
                  onChange={() => handleTogglePermission(perm.name)}
                  style={{ width: 18, height: 18, accentColor: '#00e6b0' }}
                />
                <div>
                  <div style={{ color: selectedPermissions.includes(perm.name) ? '#00e6b0' : '#fff', fontWeight: 700, fontSize: 14 }}>
                    {perm.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a99a8', marginTop: 2, lineHeight: 1.4 }}>
                    {perm.description}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {!isView && (
            <button className={styles.fullWidth + ' ' + styles.submitBtn} type="submit" disabled={loading}>
              <Save size={18} style={{ marginRight: 8 }} />
              {loading ? 'Sincronizando...' : 'Salvar Grupo de Permissões'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default GroupForm;
