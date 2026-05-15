import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Mail, Shield, Lock, Save, Camera } from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseForm.module.css';
import { useToast } from '../../../components/ToastProvider';
import Skeleton from '../../../components/Skeleton';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  newPassword?: string;
  confirmPassword?: string;
}

const Profile: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const newPassword = watch('newPassword');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const u = JSON.parse(userStr);
      setUserData(u);
      reset({
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || ''
      });
    }
    setFetching(false);
  }, [reset]);

  const onSubmit = async (data: ProfileFormData) => {
    if (data.newPassword && data.newPassword !== data.confirmPassword) {
      showToast('As novas senhas não coincidem.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await api.put(`/users/${userData.id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.newPassword || undefined
      });
      
      showToast('Perfil atualizado com sucesso!');
      
      // Atualizar dados no localStorage
      const updatedUser = { ...userData, firstName: data.firstName, lastName: data.lastName, email: data.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUserData(updatedUser);
      
      reset({ ...data, newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast('Erro ao atualizar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.glassCard} style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
            <Skeleton width="120px" height="120px" borderRadius="50%" />
            <div style={{ marginTop: 20 }}><Skeleton width="200px" height="25px" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
             {[1, 2, 3, 4].map(i => <Skeleton key={i} height="50px" borderRadius="10px" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.glassCard} style={{ maxWidth: 800 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Meu Perfil</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ 
              width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '3px solid #38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: '#38bdf8',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)'
            }}>
              {userData?.firstName?.charAt(0)}
            </div>
            <button style={{ 
              position: 'absolute', bottom: 0, right: 0, 
              width: 36, height: 36, borderRadius: '50%', background: '#38bdf8', color: '#1e293b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #0f172a', cursor: 'pointer'
            }}>
              <Camera size={18} />
            </button>
          </div>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{userData?.firstName} {userData?.lastName}</div>
            <div style={{ color: '#38bdf8', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }}>
              <Shield size={14} /> {userData?.group?.name || 'Acesso Padrão'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <User size={18} /> Informações Pessoais
          </div>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nome</label>
            <div className={`${styles.inputWrapper} ${errors.firstName ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <input className={styles.formInput} {...register('firstName', { required: 'Obrigatório' })} />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Sobrenome</label>
            <div className={`${styles.inputWrapper} ${errors.lastName ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <input className={styles.formInput} {...register('lastName', { required: 'Obrigatório' })} />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>E-mail de Acesso</label>
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <Mail className={styles.inputIcon} size={18} />
              <input className={styles.formInput} type="email" {...register('email', { required: 'Obrigatório' })} />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <Lock size={18} /> Segurança (Alteração de Senha)
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nova Senha</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                type="password" 
                placeholder="Preencha apenas para alterar" 
                {...register('newPassword')} 
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Confirmar Nova Senha</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                type="password" 
                {...register('confirmPassword')} 
              />
            </div>
          </div>

          <div className={styles.fullWidth} style={{ marginTop: 24 }}>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              <Save size={18} style={{ marginRight: 8 }} />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
