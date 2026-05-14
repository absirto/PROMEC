import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { User, Mail, Lock, Shield, Eye, EyeOff, ArrowLeft, Save, UserPlus } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';

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
      .then((res: any) => setGroups(res))
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
      const payload: any = { ...data, groupId: parseInt(data.groupId) };
      if (!payload.password) delete payload.password;

      if (id && isEdit) {
        await api.put(`/users/${id}`, payload);
        showToast('Usuário atualizado!');
      } else {
        await api.post('/users', payload);
        showToast('Usuário criado com sucesso!');
      }

      navigate('/users');
    } catch (err: any) {
      showToast('Erro ao salvar usuário. E-mail pode já estar em uso.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Ficha do Usuário' : isEdit ? 'Configurar Credenciais' : 'Nova Conta de Acesso'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/users')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <UserPlus size={18} /> Dados da Conta
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
              />
            </div>
            {errors.firstName && <span className={styles.errorMessage}>{errors.firstName.message}</span>}
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
              />
            </div>
            {errors.lastName && <span className={styles.errorMessage}>{errors.lastName.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>E-mail de Login</label>
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
                placeholder="email@empresa.com"
              />
            </div>
            {errors.email && <span className={styles.errorMessage}>{errors.email.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Grupo de Permissão</label>
            <div className={`${styles.inputWrapper} ${errors.groupId ? styles.inputError : ''}`}>
              <Shield className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                {...register('groupId', { required: 'O grupo é obrigatório' })}
                disabled={isView}
              >
                <option value="">Selecione...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            {errors.groupId && <span className={styles.errorMessage}>{errors.groupId.message}</span>}
          </div>

          {!isView && (
            <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
              <label className={styles.label}>
                {isEdit ? 'Nova Senha (deixe vazio para não alterar)' : 'Senha Inicial'}
              </label>
              <div className={`${styles.inputWrapper} ${errors.password ? styles.inputError : ''}`}>
                <Lock className={styles.inputIcon} size={18} />
                <input
                  className={styles.formInput}
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { 
                    required: !isEdit ? 'A senha é obrigatória' : false,
                    minLength: { value: 6, message: 'A senha deve ter pelo menos 6 caracteres' }
                  })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', color: '#8a99a8', cursor: 'pointer', paddingRight: 10 }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className={styles.errorMessage}>{errors.password.message}</span>}
            </div>
          )}

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 24 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading || isSubmitting ? 'Salvando...' : 'Confirmar Cadastro'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default UserForm;
