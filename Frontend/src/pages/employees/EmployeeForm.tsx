import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { User, Briefcase, Map, Shield, ArrowLeft, Save, Hash, Check } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';
import { useToast } from '../../components/ToastProvider';
import { maskCNPJ, maskCPF } from '../../utils/masks';
import Skeleton from '../../components/Skeleton';

interface EmployeeFormData {
  personId: string;
  jobRoleId: string;
  workAreaId: string;
  matricula: string;
  status: string;
  userId: string;
}

interface EmployeeFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    defaultValues: {
      personId: '',
      jobRoleId: '',
      workAreaId: '',
      matricula: '',
      status: 'Ativo',
      userId: ''
    }
  });
  
  const [people, setPeople] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const dataPromises = [
      api.get('/people').catch(() => []),
      api.get('/job-roles').catch(() => []),
      api.get('/work-areas').catch(() => []),
      api.get('/users').catch(() => [])
    ];

    Promise.all(dataPromises)
      .then(([peopleData, rolesData, areasData, usersData]: any[]) => {
        setPeople(peopleData);
        setRoles(rolesData);
        setAreas(areasData);
        setUsers(usersData);
      })
      .catch(() => showToast('Erro ao carregar dados de suporte.', 'error'));

    if (id && (isEdit || isView)) {
      api.get(`/employees/${id}`)
        .then((data: any) => {
          reset({
            personId: data.personId?.toString() || '',
            jobRoleId: data.jobRoleId?.toString() || '',
            workAreaId: data.workAreaId?.toString() || '',
            matricula: data.matricula || '',
            status: data.status || 'Ativo',
            userId: data.userId?.toString() || ''
          });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, isEdit, isView, showToast, reset]);

  const onSubmit = async (data: EmployeeFormData) => {
    if (isView) return;
    
    setLoading(true);
    try {
      const payload = {
        personId: parseInt(data.personId),
        jobRoleId: parseInt(data.jobRoleId),
        workAreaId: parseInt(data.workAreaId),
        matricula: data.matricula,
        status: data.status,
        userId: data.userId ? parseInt(data.userId) : null
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

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <User size={18} /> Vínculo Pessoal
          </div>
          
          <div className={`${styles.fieldGroup} ${errors.personId ? styles.error : ''}`}>
            <label className={styles.label}>Pessoa Relacionada</label>
            <div className={`${styles.inputWrapper} ${errors.personId ? styles.inputError : ''}`}>
              <User className={styles.inputIcon} size={18} />
              <select 
                className={styles.formSelect} 
                {...register('personId', { required: 'Vínculo pessoal é obrigatório' })}
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
            {errors.personId && <span className={styles.errorMessage}>{errors.personId.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Matrícula / ID Interno</label>
            <div className={`${styles.inputWrapper} ${errors.matricula ? styles.inputError : ''}`}>
              <Hash className={styles.inputIcon} size={18} />
              <input 
                className={styles.formInput} 
                {...register('matricula', { required: 'Matrícula é obrigatória' })}
                disabled={isView} 
                placeholder="Ex: PROMEC-001" 
              />
            </div>
            {errors.matricula && <span className={styles.errorMessage}>{errors.matricula.message}</span>}
          </div>

          <div className={styles.fullWidth + ' ' + styles.sectionTitle}>
            <Briefcase size={18} /> Profissional
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Cargo</label>
            <div className={`${styles.inputWrapper} ${errors.jobRoleId ? styles.inputError : ''}`}>
              <Briefcase className={styles.inputIcon} size={18} />
              <select 
                className={styles.formSelect} 
                {...register('jobRoleId', { required: 'Cargo é obrigatório' })}
                disabled={isView}
              >
                <option value="">Selecione...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {errors.jobRoleId && <span className={styles.errorMessage}>{errors.jobRoleId.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Área de Trabalho</label>
            <div className={`${styles.inputWrapper} ${errors.workAreaId ? styles.inputError : ''}`}>
              <Map className={styles.inputIcon} size={18} />
              <select 
                className={styles.formSelect} 
                {...register('workAreaId', { required: 'Área de trabalho é obrigatória' })}
                disabled={isView}
              >
                <option value="">Selecione...</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {errors.workAreaId && <span className={styles.errorMessage}>{errors.workAreaId.message}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Vincular Usuário (Acesso ao Sistema)</label>
            <div className={styles.inputWrapper}>
              <Shield className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} {...register('userId')} disabled={isView}>
                <option value="">Nenhum acesso</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>)}
              </select>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Status do Funcionário</label>
            <div className={styles.inputWrapper}>
              <Check className={styles.inputIcon} size={18} />
              <select className={styles.formSelect} {...register('status')} disabled={isView}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Afastado">Afastado</option>
                <option value="Férias">Férias</option>
              </select>
            </div>
          </div>

          {!isView && (
            <div className={styles.fullWidth} style={{ marginTop: 32 }}>
              <button className={styles.submitBtn} type="submit" disabled={loading || isSubmitting}>
                <Save size={18} style={{ marginRight: 8 }} />
                {loading || isSubmitting ? 'Salvando...' : 'Salvar Registro Oficial'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
