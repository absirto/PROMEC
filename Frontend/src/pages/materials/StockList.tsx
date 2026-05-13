import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';

const StockList: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [purchaseLogs, setPurchaseLogs] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    materialId: '',
    quantity: '',
    type: 'IN',
    description: '',
    supplierPersonId: '',
    unitCost: '',
    totalPaid: ''
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.type === 'IN') {
      if (!formData.supplierPersonId) {
        showToast('Selecione o fornecedor da compra.', 'warning');
        return;
      }
      if (!formData.unitCost && !formData.totalPaid) {
        showToast('Informe custo unitário ou valor total pago.', 'warning');
        return;
      }
    }

    try {
      await api.post('/stock', {
        ...formData,
        supplierPersonId: formData.type === 'IN' ? Number(formData.supplierPersonId) : undefined,
        unitCost: formData.unitCost ? Number(formData.unitCost) : undefined,
        totalPaid: formData.totalPaid ? Number(formData.totalPaid) : undefined,
      });
      showToast('Movimentação registrada com sucesso!');
      setShowModal(false);
      setFormData({ materialId: '', quantity: '', type: 'IN', description: '', supplierPersonId: '', unitCost: '', totalPaid: '' });
      void fetchData();
    } catch (err) {
      showToast('Erro ao registrar movimentação.', 'error');
    }
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(0, 230, 176, 0.1)', color: '#00e6b0', padding: 10, borderRadius: 12 }}>
            <History size={24} />
          </div>
          <h2 className={styles.title} style={{ margin: 0 }}>Histórico de Movimentações</h2>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <Plus size={20} /> Nova Movimentação
        </button>
      </div>

      <div className={styles.tableContainer} style={{ marginTop: 20 }}>
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
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Carregando histórico...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhuma movimentação encontrada.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className={styles.tableRow}>
                <td style={{ padding: '16px 20px' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '16px 20px', fontWeight: 600 }}>{log.material?.name}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ 
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: log.type === 'IN' ? '#00e6b0' : '#ef4444',
                    fontWeight: 700, fontSize: 13
                  }}>
                    {log.type === 'IN' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                    {log.type === 'IN' ? 'ENTRADA' : 'SAÍDA'}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 700 }}>{log.quantity} {log.material?.unit}</td>
                <td style={{ padding: '16px 20px' }}>{getPersonName(log.supplierPerson)}</td>
                <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                  {log.totalPaid ? Number(log.totalPaid).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                </td>
                <td style={{ padding: '16px 20px', color: '#8a99a8', fontSize: 13 }}>{log.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableContainer} style={{ marginTop: 20 }}>
        <h3 style={{ margin: '0 0 14px 0', color: '#e2e8f0' }}>Histórico de Compras de Peças</h3>
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
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Carregando compras...</td></tr>
            ) : purchaseLogs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhuma compra registrada.</td></tr>
            ) : purchaseLogs.map(log => (
              <tr key={`purchase-${log.id}`} className={styles.tableRow}>
                <td style={{ padding: '16px 20px' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '16px 20px', fontWeight: 600 }}>{log.material?.name}</td>
                <td style={{ padding: '16px 20px' }}>{log.supplierName || getPersonName(log.supplierPerson)}</td>
                <td style={{ padding: '16px 20px', fontWeight: 700 }}>{log.quantity} {log.material?.unit}</td>
                <td style={{ padding: '16px 20px' }}>
                  {log.unitCost ? Number(log.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                  {log.totalPaid ? Number(log.totalPaid).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Simples de Movimentação */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1c222d', width: 500, padding: 32, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20 }}>Registrar Movimentação</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Material</label>
                <select 
                  style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  value={formData.materialId}
                  onChange={e => setFormData({...formData, materialId: e.target.value})}
                  required
                >
                  <option value="">Selecione...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Tipo</label>
                  <select 
                    style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="IN">Entrada (+)</option>
                    <option value="OUT">Saída (-)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Quantidade</label>
                  <input 
                    type="number" step="0.01" required
                    style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: e.target.value})}
                  />
                </div>
              </div>

              {formData.type === 'IN' && (
                <>
                  <div>
                    <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Fornecedor</label>
                    <select
                      style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      value={formData.supplierPersonId}
                      onChange={e => setFormData({ ...formData, supplierPersonId: e.target.value })}
                      required
                    >
                      <option value="">Selecione...</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.naturalPerson?.name || p.legalPerson?.corporateName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Custo Unitário (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                        value={formData.unitCost}
                        onChange={e => setFormData({ ...formData, unitCost: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Valor Total Pago (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                        value={formData.totalPaid}
                        onChange={e => setFormData({ ...formData, totalPaid: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Observação</label>
                <textarea 
                  style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minHeight: 80 }}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#00e6b0', color: '#181c24', fontWeight: 700, cursor: 'pointer' }}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockList;
