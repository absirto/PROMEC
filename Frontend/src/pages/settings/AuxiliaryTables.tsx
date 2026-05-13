import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Briefcase, Map, Plus, Edit2, Trash2, Save, X, Settings2 } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import Skeleton from '../../components/Skeleton';

interface NewItemFormData {
  name: string;
}

const AuxiliaryTables: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'roles' | 'areas'>('roles');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewItemFormData>({
    defaultValues: { name: '' }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'roles' ? '/job-roles' : '/work-areas';
      const result = await api.get(endpoint);
      setData(result || []);
    } catch (err) {
      showToast('Erro ao carregar dados.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    void fetchData();
    setEditingId(null);
  }, [fetchData]);

  const onAddItem = async (formData: NewItemFormData) => {
    try {
      const endpoint = activeTab === 'roles' ? '/job-roles' : '/work-areas';
      await api.post(endpoint, formData);
      showToast('Cadastrado com sucesso!');
      reset();
      fetchData();
    } catch (err) {
      showToast('Erro ao cadastrar.', 'error');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName) return;
    try {
      const endpoint = activeTab === 'roles' ? '/job-roles' : '/work-areas';
      await api.put(`${endpoint}/${id}`, { name: editName });
      showToast('Atualizado com sucesso!');
      setEditingId(null);
      fetchData();
    } catch (err) {
      showToast('Erro ao atualizar.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Excluir este item? Isso pode afetar funcionários vinculados.')) return;
    try {
      const endpoint = activeTab === 'roles' ? '/job-roles' : '/work-areas';
      await api.delete(`${endpoint}/${id}`);
      showToast('Excluído com sucesso!');
      fetchData();
    } catch (err) {
      showToast('Erro ao excluir. Verifique se existem dependências.', 'error');
    }
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: 10, borderRadius: 12 }}>
            <Settings2 size={24} />
          </div>
          <div>
            <h2 className={styles.title} style={{ margin: 0 }}>Tabelas Auxiliares</h2>
            <p style={{ color: '#8a99a8', fontSize: 13, margin: 0 }}>Gerencie as opções básicas do sistema</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, marginTop: 24 }}>
        <button 
          onClick={() => setActiveTab('roles')}
          style={{ 
            padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: activeTab === 'roles' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            color: activeTab === 'roles' ? '#38bdf8' : '#8a99a8',
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
          }}
        >
          <Briefcase size={20} /> Cargos Disponíveis
        </button>
        <button 
          onClick={() => setActiveTab('areas')}
          style={{ 
            padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: activeTab === 'areas' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            color: activeTab === 'areas' ? '#38bdf8' : '#8a99a8',
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
          }}
        >
          <Map size={20} /> Áreas de Trabalho
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: 40 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: 32, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18, color: '#e2e8f0' }}>Novo {activeTab === 'roles' ? 'Cargo' : 'Área'}</h3>
          <form onSubmit={handleSubmit(onAddItem)}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Nome Identificador</label>
              <input 
                type="text" 
                className={`${styles.searchInput} ${errors.name ? styles.inputError : ''}`}
                style={{ width: '100%', paddingLeft: 16 }}
                placeholder="Ex: Supervisor, Oficina Sul..."
                {...register('name', { required: true })}
              />
            </div>
            <button type="submit" className={styles.newBtn} style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={20} /> Adicionar Item
            </button>
          </form>
        </div>

        <div className={styles.tableContainer}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className={styles.tableHeader}>
                <th style={{ padding: '16px 20px', textAlign: 'left' }}>Nome Cadastrado</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} style={{ padding: 20 }}>
                    <Skeleton height="40px" borderRadius="8px" />
                    <div style={{ marginTop: 10 }}><Skeleton height="40px" borderRadius="8px" /></div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhum item encontrado.</td></tr>
              ) : data.map(item => (
                <tr key={item.id} className={styles.tableRow}>
                  <td style={{ padding: '16px 20px' }}>
                    {editingId === item.id ? (
                      <input 
                        className={styles.searchInput} 
                        style={{ padding: '8px 12px', fontSize: 14, width: '100%' }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{item.name}</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      {editingId === item.id ? (
                        <>
                          <button onClick={() => handleUpdate(item.id)} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><Save size={16} /></button>
                          <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(item.id); setEditName(item.name); }} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(item.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuxiliaryTables;
