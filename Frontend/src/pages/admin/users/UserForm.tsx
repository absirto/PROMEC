import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { User, Mail, Lock, Shield, Eye, EyeOff, ArrowLeft, Save, UserPlus, ShieldCheck, Key, Info } from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseForm.module.css';
import { useToast } from '../../../components/ToastProvider';
import Skeleton from '../../../components/Skeleton';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  groupId: string;
}

interface UserFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ isEdit, isView }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      groupId: ''
    }
  });
  
  const [groups, setGroups] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then((res: any) => setGroups((Array.isArray(res) ? res : res?.data) || []))
      .catch(() => showToast('Erro ao carregar grupos.', 'error'));

    if (id && (isEdit || isView)) {
      setLoading(true);
      api.get(`/users/${id}`)
        .then((user: any) => {
          reset({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            password: '',
            groupId: user.groupId?.toString() || ''
          });
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView, showToast, reset]);

  const onSubmit = async (data: UserFormData) => {
    if (isView) return;

    setLoading(true);
    try {
      const payload: any = { ...data, groupId: data.groupId ? parseInt(data.groupId) : null };
      if (!payload.password) delete payload.password;

      if (id && isEdit) {
        await api.put(`/users/${id}`, payload);
        showToast('Credenciais atualizadas com sucesso!');
      } else {
        await api.post('/users', payload);
        showToast('Nova conta criada com sucesso!');
      }

      navigate('/users');
    } catch (err: any) {
      showToast('Erro ao salvar conta. E-mail pode já estar em uso.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !id) return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <Skeleton width="300px" height="40px" />
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Skeleton height="150px" borderRadius="20px" />
          <Skeleton height="150px" borderRadius="20px" />
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.formContainer}>
      <div className={styles.glassCard}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h2 className={styles.title}>
              {isView ? 'Perfil de Acesso' : isEdit ? 'Ajustes de Segurança' : 'Novo Usuário do Sistema'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {isView ? 'Informações de login e nível de permissão' : 'Configure as credenciais e o grupo de acesso para o novo integrante'}
            </p>
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/users')}>
            <ArrowLeft size={16} /> <span>Voltar</span>
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          {/* Sessão Identidade */}
          <div className={styles.fullWidth}>
            <div className={styles.sectionTitle}>
              <UserPlus size={18} /> Identidade Digital
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Primeiro Nome</label>
            <div className={`${styles.inputWrapper} ${errors.firstName ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                {...register('firstName', { 
                  required: 'O primeiro nome é obrigatório',
                  minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                })}
                disabled={isView}
                placeholder="Ex: João"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Sobrenome</label>
            <div className={`${styles.inputWrapper} ${errors.lastName ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                {...register('lastName', { 
                  required: 'O sobrenome é obrigatório',
                  minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                })}
                disabled={isView}
                placeholder="Ex: Silva"
              />
            </div>
          </div>

          {/* Sessão Segurança */}
          <div className={styles.fullWidth}>
            <div className={styles.sectionTitle} style={{ marginTop: 24 }}>
              <ShieldCheck size={18} /> Configurações de Acesso
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>E-mail Institucional (Login)</label>
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <Mail className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="email"
                {...register('email', { 
                  required: 'O e-mail é obrigatório',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'E-mail inválido'
                  }
                })}
                disabled={isView}
                placeholder="nome@promec.com.br"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Política de Permissões</label>
            <div className={`${styles.inputWrapper} ${errors.groupId ? styles.inputError : ''}`}>
              <Shield className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                {...register('groupId', { required: 'O grupo é obrigatório' })}
                disabled={isView}
              >
                <option value="">Selecione o grupo...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          {!isView && (
            <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
              <label className={styles.label}>
                {isEdit ? 'Renovação de Senha (Opcional)' : 'Senha de Primeiro Acesso'}
              </label>
              <div className={`${styles.inputWrapper} ${errors.password ? styles.inputError : ''}`}>
                <Key className={styles.inputIcon} size={18} />
                <input
                  className={styles.formInput}
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { 
                    required: !isEdit ? 'A senha é obrigatória' : false,
                    minLength: { value: 6, message: 'A senha deve ter pelo menos 6 caracteres' }
                  })}
                  placeholder={isEdit ? "Deixe em branco para manter a atual" : "••••••••"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.visibilityBtn}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>
                <Info size={10} /> {isEdit ? "Utilize esta opção apenas se precisar resetar a senha do usuário." : "Recomendamos uma senha forte com letras e números."}
              </p>
            </div>
          )}

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 40 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
                <Save size={18} />
                <span>{id ? 'Atualizar Credenciais' : 'Concluir Cadastro'}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default UserForm;
