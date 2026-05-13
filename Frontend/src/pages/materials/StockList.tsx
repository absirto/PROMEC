import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, ArrowUpCircle, ArrowDownCircle, History, Save, X } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import Skeleton from '../../components/Skeleton';

interface StockMovementFormData {
  materialId: string;
  quantity: string;
  type: 'IN' | 'OUT';
  description: string;
  supplierPersonId?: string;
  unitCost?: string;
  totalPaid?: string;
}

const StockList: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [purchaseLogs, setPurchaseLogs] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<StockMovementFormData>({
    defaultValues: {
      type: 'IN',
      materialId: '',
      quantity: '',
      description: '',
      supplierPersonId: '',
      unitCost: '',
      totalPaid: ''
    }
  });

  const watchedType = watch('type');

  const getPersonName = (person: any) => {
    if (!person) return '-';
    return person.naturalPerson?.name || person.legalPerson?.corporateName || '-';
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, purchasesData, materialsData, peopleData] = await Promise.all([
        api.get('/stock'),
        api.get('/stock/purchases'),
        api.get('/materials'),
        api.get('/people')
      ]);
      setLogs((Array.isArray(logsData) ? logsData : logsData?.data) || []);
      setPurchaseLogs((Array.isArray(purchasesData) ? purchasesData : purchasesData?.data) || []);
      setMaterials(Array.isArray(materialsData) ? materialsData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch (err) {
      showToast('Erro ao carregar dados de estoque.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onSubmit = async (data: StockMovementFormData) => {
    if (data.type === 'IN') {
      if (!data.supplierPersonId) {
        showToast('Selecione o fornecedor da compra.', 'warning');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.post('/stock', {
        ...data,
        supplierPersonId: data.type === 'IN' ? Number(data.supplierPersonId) : undefined,
        unitCost: data.unitCost ? Number(data.unitCost) : undefined,
        totalPaid: data.totalPaid ? Number(data.totalPaid) : undefined,
      });
      showToast('Movimentação registrada com sucesso!');
      setShowModal(false);
      reset();
      void fetchData();
    } catch (err) {
      showToast('Erro ao registrar movimentação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(0, 230, 176, 0.12)', color: '#00e6b0', padding: 10, borderRadius: 12 }}>
            <History size={24} />
          </div>
          <h2 className={styles.title} style={{ margin: 0 }}>Histórico de Movimentações</h2>
        </div>
        <button className={styles.newBtn} onClick={() => { reset(); setShowModal(true); }}>
          <Plus size={20} /> Nova Movimentação
        </button>
      </div>

      <div className={styles.tableContainer} style={{ marginTop: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr className={styles.tableHeader}>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Data</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Material</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Tipo</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Qtd</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Fornecedor</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Valor Pago</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i}><td colSpan={7} style={{ padding: '10px 20px' }}><Skeleton height="45px" borderRadius="10px" /></td></tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhuma movimentação encontrada.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className={styles.tableRow}>
                <td style={{ padding: '16px 20px', fontSize: 13, color: '#8a99a8' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '16px 20px', fontWeight: 600, color: '#f1f5f9' }}>{log.material?.name}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ 
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: log.type === 'IN' ? '#10b981' : '#f43f5e',
                    fontWeight: 700, fontSize: 11, textTransform: 'uppercase'
                  }}>
                    {log.type === 'IN' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                    {log.type === 'IN' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 700, color: '#f8fafc' }}>{log.quantity} {log.material?.unit}</td>
                <td style={{ padding: '16px 20px', color: '#94a3b8' }}>{getPersonName(log.supplierPerson)}</td>
                <td style={{ padding: '16px 20px', fontWeight: 700, color: '#10b981' }}>
                  {log.totalPaid ? Number(log.totalPaid).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                </td>
                <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 13 }}>{log.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableContainer} style={{ marginTop: 40, background: 'rgba(255,255,255,0.01)' }}>
        <h3 style={{ margin: '20px 20px 14px 20px', color: '#f1f5f9', fontSize: 18 }}>Histórico de Compras de Peças</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr className={styles.tableHeader}>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Data</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Material</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Fornecedor</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Qtd Comprada</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Custo Unitário</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Total Pago</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               [1, 2, 3].map(i => (
                <tr key={i}><td colSpan={6} style={{ padding: '10px 20px' }}><Skeleton height="45px" borderRadius="10px" /></td></tr>
              ))
            ) : purchaseLogs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhuma compra registrada.</td></tr>
            ) : purchaseLogs.map(log => (
              <tr key={`purchase-${log.id}`} className={styles.tableRow}>
                <td style={{ padding: '16px 20px', fontSize: 13, color: '#8a99a8' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '16px 20px', fontWeight: 600, color: '#f1f5f9' }}>{log.material?.name}</td>
                <td style={{ padding: '16px 20px', color: '#94a3b8' }}>{log.supplierName || getPersonName(log.supplierPerson)}</td>
                <td style={{ padding: '16px 20px', fontWeight: 700, color: '#f8fafc' }}>{log.quantity} {log.material?.unit}</td>
                <td style={{ padding: '16px 20px', color: '#38bdf8' }}>
                  {log.unitCost ? Number(log.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 700, color: '#10b981' }}>
                  {log.totalPaid ? Number(log.totalPaid).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1e293b', width: 500, padding: 32, borderRadius: 28, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: -0.5 }}>Registrar Movimentação</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#8a99a8', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Material</label>
                <select 
                  className={`${styles.searchInput} ${errors.materialId ? styles.inputError : ''}`}
                  style={{ width: '100%', minWidth: 'unset' }}
                  {...register('materialId', { required: true })}
                >
                  <option value="">Selecione o material...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Operação</label>
                  <select 
                    className={styles.searchInput}
                    style={{ width: '100%', minWidth: 'unset' }}
                    {...register('type')}
                  >
                    <option value="IN">Entrada (+)</option>
                    <option value="OUT">Saída (-)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Quantidade</label>
                  <input 
                    type="number" step="0.01" 
                    className={`${styles.searchInput} ${errors.quantity ? styles.inputError : ''}`}
                    style={{ width: '100%', minWidth: 'unset' }}
                    {...register('quantity', { required: true })}
                  />
                </div>
              </div>

              {watchedType === 'IN' && (
                <div style={{ animation: 'slideDown 0.3s ease-out' }}>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Fornecedor</label>
                    <select
                      className={`${styles.searchInput} ${errors.supplierPersonId ? styles.inputError : ''}`}
                      style={{ width: '100%', minWidth: 'unset' }}
                      {...register('supplierPersonId')}
                    >
                      <option value="">Selecione o fornecedor...</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.naturalPerson?.name || p.legalPerson?.corporateName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Custo Unit. (R$)</label>
                      <input
                        type="number" step="0.01"
                        className={styles.searchInput}
                        style={{ width: '100%', minWidth: 'unset' }}
                        {...register('unitCost')}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Total Pago (R$)</label>
                      <input
                        type="number" step="0.01"
                        className={styles.searchInput}
                        style={{ width: '100%', minWidth: 'unset' }}
                        {...register('totalPaid')}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Notas / Motivo</label>
                <textarea 
                  className={styles.searchInput}
                  style={{ width: '100%', minWidth: 'unset', minHeight: 80, paddingTop: 12 }}
                  placeholder="Descreva o motivo da movimentação..."
                  {...register('description')}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                   {submitting ? 'Gravando...' : <><Save size={18} /> Confirmar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockList;
