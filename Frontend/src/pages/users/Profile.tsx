import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Lock, Save, Camera } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';

const Profile: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const u = JSON.parse(userStr);
      setUserData(u);
      setFormData(prev => ({
        ...prev,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || ''
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      showToast('As novas senhas não coincidem.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // Simulação de atualização de perfil
      // No backend precisaria de uma rota /users/profile e validação de senha atual
      await api.put(`/users/${userData.id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.newPassword || undefined
      });
      
      showToast('Perfil atualizado com sucesso!');
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      showToast('Erro ao atualizar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.glassCard} style={{ maxWidth: 800 }}>
        <div className={styles.header}>
          <h2 className={styles.title}>Meu Perfil</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ 
              width: 120, height: 120, borderRadius: '50%', background: '#23283a', border: '3px solid #00e6b0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: '#00e6b0'
            }}>
              {formData.firstName?.charAt(0)}
            </div>
            <button style={{ 
              position: 'absolute', bottom: 0, right: 0, 
              width: 36, height: 36, borderRadius: '50%', background: '#00e6b0', color: '#181c24',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #1c222d', cursor: 'pointer'
            }}>
              <Camera size={18} />
            </button>
          </div>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formData.firstName} {formData.lastName}</div>
            <div style={{ color: '#00e6b0', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }}>
              <Shield size={14} /> {userData?.group?.name || 'Acesso Padrão'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <User size={18} /> Informações Pessoais
          </div>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nome</label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} size={18} />
              <input className={styles.formInput} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Sobrenome</label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} size={18} />
              <input className={styles.formInput} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>E-mail de Acesso</label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} size={18} />
              <input className={styles.formInput} type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            </div>
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <Lock size={18} /> Segurança (Alteração de Senha)
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nova Senha</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input className={styles.formInput} type="password" placeholder="Preencha apenas para alterar" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Confirmar Nova Senha</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input className={styles.formInput} type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
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
