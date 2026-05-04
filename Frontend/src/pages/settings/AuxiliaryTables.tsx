import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Map, Plus, Edit2, Trash2, Save, X, Settings2 } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';

const AuxiliaryTables: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'roles' | 'areas'>('roles');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'roles' ? '/job-roles' : '/work-areas';
      const result = await api.get(endpoint);
      setData(result);
    } catch (err) {
      showToast('Erro ao carregar dados.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      const endpoint = activeTab === 'roles' ? '/job-roles' : '/work-areas';
      await api.post(endpoint, { name: newName });
      showToast('Cadastrado com sucesso!');
      setNewName('');
      fetchData();
    } catch (err) {
      showToast('Erro ao cadastrar.', 'error');
    }
  };

  const handleUpdate = async (id: number) => {
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
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: 10, borderRadius: 12 }}>
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
            background: activeTab === 'roles' ? 'rgba(0, 230, 176, 0.1)' : 'transparent',
            color: activeTab === 'roles' ? '#00e6b0' : '#8a99a8',
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
          }}
        >
          <Briefcase size={20} /> Cargos Disponíveis
        </button>
        <button 
          onClick={() => setActiveTab('areas')}
          style={{ 
            padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: activeTab === 'areas' ? 'rgba(0, 230, 176, 0.1)' : 'transparent',
            color: activeTab === 'areas' ? '#00e6b0' : '#8a99a8',
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
          }}
        >
          <Map size={20} /> Áreas de Trabalho
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: 40 }}>
        {/* Formulário de Adição */}
        <div style={{ background: '#23283a', padding: 32, borderRadius: 24, border: '1px solid rgba(255,255,255,0.03)', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18 }}>Novo {activeTab === 'roles' ? 'Cargo' : 'Área'}</h3>
          <form onSubmit={handleAdd}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Nome Identificador</label>
              <input 
                type="text" 
                className={styles.searchInput} 
                style={{ width: '100%', paddingLeft: 16 }}
                placeholder="Ex: Supervisor, Oficina Sul..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={styles.newBtn} style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={20} /> Adicionar Item
            </button>
          </form>
        </div>

        {/* Listagem Estilizada */}
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
                <tr><td colSpan={2} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Carregando...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhum item encontrado.</td></tr>
              ) : data.map(item => (
                <tr key={item.id} className={styles.tableRow}>
                  <td style={{ padding: '16px 20px' }}>
                    {editingId === item.id ? (
                      <input 
                        className={styles.searchInput} 
                        style={{ padding: '8px 12px', fontSize: 14 }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      {editingId === item.id ? (
                        <>
                          <button onClick={() => handleUpdate(item.id)} style={{ background: '#00e6b0', color: '#181c24', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><Save size={16} /></button>
                          <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={16} /></button>
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
