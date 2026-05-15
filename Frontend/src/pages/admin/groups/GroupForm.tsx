import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shield, Key, ArrowLeft, Save, Lock, ShieldCheck, ShieldAlert, CheckSquare, Square, Info } from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseForm.module.css';
import { useToast } from '../../../components/ToastProvider';
import Skeleton from '../../../components/Skeleton';

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
      showToast('Selecione ao menos uma regra de acesso.', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const payload = { name: data.name, permissionKeys: data.permissions };
      if (isEdit) {
        await api.put(`/groups/${id}`, payload);
        showToast('Política de acesso atualizada!');
      } else {
        await api.post('/groups', payload);
        showToast('Nova política criada com sucesso!');
      }
      navigate('/groups');
    } catch (err: any) {
      showToast('Erro ao salvar política de segurança.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !id) return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <Skeleton width="100%" height="400px" borderRadius="32px" />
      </div>
    </div>
  );

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h2 className={styles.title}>
              {isView ? 'Visão de Regras' : isEdit ? 'Edição de Política' : 'Novo Perfil de Acesso'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Defina as permissões granulares para os módulos do ecossistema ProMEC
            </p>
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/groups')}>
            <ArrowLeft size={16} /> <span>Voltar</span>
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nome Identificador da Política</label>
              <div className={`${styles.inputWrapper} ${errors.name ? styles.inputError : ''}`}>
                <Shield className={styles.inputIcon} size={18} />
                <input
                  className={styles.formInput}
                  type="text"
                  disabled={isView}
                  {...register('name', { 
                    required: 'O nome é obrigatório',
                    minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                  })}
                  placeholder="Ex: Gestor Financeiro, Operador de Almoxarifado..."
                />
              </div>
            </div>
          </div>

          <div className={styles.fullWidth}>
            <div className={styles.sectionTitle} style={{ marginTop: 24, marginBottom: 20 }}>
              <Lock size={18} /> Matriz de Permissões
            </div>
            
            <div className={styles.permissionBentoGrid}>
              {availablePermissions.map(perm => {
                const isActive = selectedPermissions.includes(perm.name);
                return (
                  <div 
                    key={perm.id} 
                    className={`${styles.permissionCard} ${isActive ? styles.permissionCardActive : ''}`}
                    onClick={() => handleTogglePermission(perm.name)}
                  >
                    <div className={styles.permissionCardHeader}>
                      <div className={styles.permissionIconWrapper}>
                        {isActive ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                      </div>
                      <div className={styles.checkboxWrapper}>
                        {isActive ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} color="var(--text-muted)" />}
                      </div>
                    </div>
                    <div className={styles.permissionCardBody}>
                      <h4 className={styles.permissionName}>{perm.name}</h4>
                      <p className={styles.permissionDesc}>{perm.description || 'Controle de acesso granular ao módulo correspondente.'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!isView && (
            <div className={styles.formFooter} style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 32, marginTop: 40, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                  <Info size={14} />
                  <span>{selectedPermissions.length} regras selecionadas para este perfil.</span>
               </div>
               <button className={styles.submitBtn} type="submit" disabled={loading} style={{ width: 'auto', padding: '14px 40px' }}>
                <Save size={18} />
                <span>{id ? 'Atualizar Política' : 'Efetivar Regras'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default GroupForm;
