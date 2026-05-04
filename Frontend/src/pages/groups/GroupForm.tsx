import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, Key, ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseForm.module.css';



interface GroupFormProps {
  isEdit?: boolean;
  isView?: boolean;
}

const GroupForm: React.FC<GroupFormProps> = ({ isEdit, isView }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Carregar todas as permissões disponíveis
    api.get('/groups/permissions')
      .then((data: any) => setAvailablePermissions(data))
      .catch(console.error);

    if (id && (isEdit || isView)) {
      setLoading(true);
      api.get(`/groups/${id}`)
        .then((data: any) => {
          setName(data.name || '');
          if (data.permissions) {
             setPermissions(data.permissions.map((p: any) => p.permission?.name || p.name));
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, isView]);

  const handleTogglePermission = (perm: string) => {
    if (isView) return;
    setPermissions(perms => perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;
    
    if (!name || permissions.length === 0) {
      setError('Preencha o nome e selecione ao menos um módulo.');
      return;
    }
    
    setLoading(true);
    try {
      const payload = { name, permissionKeys: permissions };
      if (isEdit) {
        await api.put(`/groups/${id}`, payload);
      } else {
        await api.post('/groups', payload);
      }
      navigate('/groups');
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Erro ao salvar grupo.');
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

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.fullWidth + ' ' + styles.fieldGroup}>
            <label className={styles.label}>
              <Shield size={16} /> Nome Identificador do Grupo
            </label>
            <div className={styles.inputWrapper}>
              <Shield className={styles.inputIcon} size={18} />
              <input
                className={styles.formInput}
                type="text"
                disabled={isView}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Equipe de Vendas, Operadores de Pista..."
                required
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
                   background: permissions.includes(perm.name) ? 'rgba(0, 230, 176, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                   border: `1px solid ${permissions.includes(perm.name) ? '#00e6b0' : 'rgba(255, 255, 255, 0.05)'}`,
                   padding: '12px 16px',
                   borderRadius: 12,
                   display: 'flex',
                   alignItems: 'center',
                   gap: 12,
                   cursor: isView ? 'default' : 'pointer',
                   transition: 'all 0.2s'
                }}
              >
                <input
                  type="checkbox"
                  disabled={isView}
                  checked={permissions.includes(perm.name)}
                  onChange={() => handleTogglePermission(perm.name)}
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <div style={{ color: permissions.includes(perm.name) ? '#00e6b0' : '#fff', fontWeight: 600, fontSize: 14 }}>
                    {perm.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a99a8', marginTop: 2 }}>
                    {perm.description}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {error && <div className={styles.fullWidth + ' ' + styles.errorMsg}>{error}</div>}

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
