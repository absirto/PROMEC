import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Briefcase, Map, Shield, ArrowLeft, Save, Hash, Check } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';
import { maskCNPJ, maskCPF } from '../../utils/masks';
import Skeleton from '../../components/Skeleton';

interface EmployeeFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    personId: '',
    jobRoleId: '',
    workAreaId: '',
    matricula: '',
    status: 'Ativo',
    userId: ''
  });
  
  const [people, setPeople] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setLoading(true);
    const dataPromises = [
      api.get('/people'),
      api.get('/job-roles'),
      api.get('/work-areas'),
      api.get('/users')
    ];

    Promise.all(dataPromises)
      .then(([peopleData, rolesData, areasData, usersData]: any[]) => {
        setPeople(peopleData.data || peopleData);
        setRoles(rolesData);
        setAreas(areasData);
        setUsers(usersData);
      })
      .catch(() => showToast('Erro ao carregar dados de suporte.', 'error'));

    if (id && (isEdit || isView)) {
      api.get(`/employees/${id}`)
        .then((data: any) => setFormData({
          personId: data.personId?.toString() || '',
          jobRoleId: data.jobRoleId?.toString() || '',
          workAreaId: data.workAreaId?.toString() || '',
          matricula: data.matricula || '',
          status: data.status || 'Ativo',
          userId: data.userId?.toString() || ''
        }))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isEdit, isView, showToast]);

  const validate = () => {
    const newErrors: any = {};
    if (!formData.personId) newErrors.personId = 'Vínculo pessoal é obrigatório.';
    if (!formData.matricula) newErrors.matricula = 'Matrícula é obrigatória.';
    if (!formData.jobRoleId) newErrors.jobRoleId = 'Cargo é obrigatório.';
    if (!formData.workAreaId) newErrors.workAreaId = 'Área de trabalho é obrigatória.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;
    
    if (!validate()) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        personId: parseInt(formData.personId),
        jobRoleId: parseInt(formData.jobRoleId),
        workAreaId: parseInt(formData.workAreaId),
        matricula: formData.matricula,
        status: formData.status,
        userId: formData.userId ? parseInt(formData.userId) : null
      };

      if (isEdit) {
        await api.put(`/employees/${id}`, payload);
        showToast('Funcionário atualizado com sucesso!');
      } else {
        await api.post('/employees', payload);
        showToast('Funcionário cadastrado com sucesso!');
      }
      navigate('/employees');
    } catch (err: any) {
      showToast('Erro ao salvar funcionário. Verifique se a matrícula já existe.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !id) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.glassCard}>
          <div className={styles.header}>
             <Skeleton width="250px" height="32px" />
             <Skeleton width="80px" height="36px" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 30 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i}><Skeleton height="45px" borderRadius="10px" /></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isView ? 'Ficha do Funcionário' : isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h2>
          <button className={styles.backBtn} onClick={() => navigate('/employees')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <User size={18} /> Vínculo Pessoal
          </div>
          
          <div className={`${styles.fieldGroup} ${errors.personId ? styles.error : ''}`}>
            <label className={styles.label}>Pessoa Relacionada</label>
            <div className={`${styles.inputWrapper} ${errors.personId ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <select 
                className={styles.formSelect} 
                value={formData.personId} 
                onChange={e => setFormData({...formData, personId: e.target.value})}
                disabled={isView || isEdit}
              >
                <option value="">Selecione uma pessoa...</option>
                {people.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.naturalPerson?.name || p.legalPerson?.corporateName} (Doc: {p.type === 'F' ? maskCPF(p.naturalPerson?.cpf || '') : maskCNPJ(p.legalPerson?.cnpj || '')})
                    </option>
                ))}
              </select>
            </div>
            {errors.personId && <span className={styles.errorMessage}>{errors.personId}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Matrícula / ID Interno</label>
            <div className={`${styles.inputWrapper} ${errors.matricula ? styles.inputError : ''}`}>
              <Hash className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                value={formData.matricula} 
                onChange={e => setFormData({...formData, matricula: e.target.value})} 
                disabled={isView} 
                placeholder="Ex: PROMEC-001" 
              />
            </div>
            {errors.matricula && <span className={styles.errorMessage}>{errors.matricula}</span>}
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <Briefcase size={18} /> Profissional
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Cargo</label>
            <div className={`${styles.inputWrapper} ${errors.jobRoleId ? styles.inputError : ''}`}>
              <Briefcase className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} value={formData.jobRoleId} onChange={e => setFormData({...formData, jobRoleId: e.target.value})} disabled={isView}>
                <option value="">Selecione...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {errors.jobRoleId && <span className={styles.errorMessage}>{errors.jobRoleId}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Área de Trabalho</label>
            <div className={`${styles.inputWrapper} ${errors.workAreaId ? styles.inputError : ''}`}>
              <Map className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} value={formData.workAreaId} onChange={e => setFormData({...formData, workAreaId: e.target.value})} disabled={isView}>
                <option value="">Selecione...</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {errors.workAreaId && <span className={styles.errorMessage}>{errors.workAreaId}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Vincular Usuário (Acesso ao Sistema)</label>
            <div className={styles.inputWrapper}>
              <Shield className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} disabled={isView}>
                <option value="">Nenhum acesso</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
              </select>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Status do Funcionário</label>
            <div className={styles.inputWrapper}>
              <Check className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} disabled={isView}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Afastado">Afastado</option>
                <option value="Férias">Férias</option>
              </select>
            </div>
          </div>

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 32 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading ? 'Salvando...' : 'Salvar Registro Oficial'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
