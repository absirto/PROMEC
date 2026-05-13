import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Mail, Lock, Shield, Eye, EyeOff, ArrowLeft, Save, UserPlus } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';

interface UserFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ isEdit, isView }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    groupId: ''
  });
  
  const [groups, setGroups] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    api.get('/groups')
      .then((res: any) => setGroups(res?.data || res || []))
      .catch(() => showToast('Erro ao carregar grupos.', 'error'));

    if (id && (isEdit || isView)) {
      setLoading(true);
      api.get(`/users/${id}`)
        .then((user: any) => {
          setFormData({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            password: '',
            groupId: user.groupId?.toString() || ''
          });
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView, showToast]);

  const validate = () => {
    const newErrors: any = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'O primeiro nome é obrigatório.';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail válido obrigatório.';
    }
    if (!isEdit && !formData.password) newErrors.password = 'A senha é obrigatória.';
    if (!formData.groupId) newErrors.groupId = 'Selecione um grupo de acesso.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;

    if (!validate()) {
      showToast('Verifique os campos obrigatórios.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload: any = { ...formData, groupId: parseInt(formData.groupId) };
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

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
             <UserPlus size={18} /> Dados da Conta
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Primeiro Nome</label>
            <div className={`${styles.inputWrapper} ${errors.firstName ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                disabled={isView}
              />
            </div>
            {errors.firstName && <span className={styles.errorMessage}>{errors.firstName}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Sobrenome</label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                disabled={isView}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>E-mail de Login</label>
            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputError : ''}`}>
              <Mail className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                disabled={isView}
                placeholder="email@empresa.com"
              />
            </div>
            {errors.email && <span className={styles.errorMessage}>{errors.email}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Grupo de Permissão</label>
            <div className={`${styles.inputWrapper} ${errors.groupId ? styles.inputError : ''}`}>
              <Shield className={styles.inputIcon} size={18} />
              <select
                className={styles.formSelect}
                value={formData.groupId}
                onChange={e => setFormData({ ...formData, groupId: e.target.value })}
                disabled={isView}
              >
                <option value="">Selecione...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            {errors.groupId && <span className={styles.errorMessage}>{errors.groupId}</span>}
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
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
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
              {errors.password && <span className={styles.errorMessage}>{errors.password}</span>}
            </div>
          )}

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 24 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading ? 'Salvando...' : 'Confirmar Cadastro'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default UserForm;
