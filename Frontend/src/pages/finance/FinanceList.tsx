import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, RefreshCcw } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';

const FinanceList: React.FC = () => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'RECEIVABLE',
    amount: '',
    category: '',
    description: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transData, summaryData] = await Promise.all([
        api.get('/finance'),
        api.get('/finance/summary')
      ]);
      setTransactions((Array.isArray(transData) ? transData : transData?.data) || []);
      setSummary(summaryData);
    } catch (err) {
      showToast('Erro ao carregar dados financeiros.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/finance', formData);
      showToast('Transação registrada com sucesso!');
      setShowModal(false);
      setFormData({ type: 'RECEIVABLE', amount: '', category: '', description: '' });
      fetchData();
    } catch (err) {
      showToast('Erro ao registrar transação.', 'error');
    }
  };

  return (
    <div className={styles.listContainer} style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(0, 230, 176, 0.1)', color: '#00e6b0', padding: 10, borderRadius: 12 }}>
            <Wallet size={24} />
          </div>
          <h2 className={styles.title} style={{ margin: 0 }}>Fluxo de Caixa</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={styles.newBtn} onClick={() => setShowModal(true)}>
            <Plus size={20} /> Nova Transação
          </button>
          <button 
            className={`${styles.refreshBtn} ${loading ? styles.refreshBtnLoading : ''}`}
            onClick={fetchData}
            title="Atualizar Dados"
          >
            <RefreshCcw size={20} />
          </button>
        </div>
      </div>

      {/* Sumário */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#23283a', padding: 20, borderRadius: 20, border: '1px solid rgba(0, 230, 176, 0.1)' }}>
          <div style={{ color: '#8a99a8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ArrowUpRight size={16} color="#00e6b0" /> Total Receitas
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#00e6b0' }}>R$ {summary.totalIncome.toLocaleString()}</div>
        </div>
        <div style={{ background: '#23283a', padding: 20, borderRadius: 20, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
          <div style={{ color: '#8a99a8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ArrowDownLeft size={16} color="#ef4444" /> Total Despesas
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>R$ {summary.totalExpense.toLocaleString()}</div>
        </div>
        <div style={{ background: '#23283a', padding: 20, borderRadius: 20, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ color: '#8a99a8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            Saldo Geral
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: summary.balance >= 0 ? '#fff' : '#ef4444' }}>R$ {summary.balance.toLocaleString()}</div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr className={styles.tableHeader}>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Data</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Categoria</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Tipo</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Valor</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Carregando dados...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>Nenhuma transação registrada.</td></tr>
            ) : transactions.map(t => (
              <tr key={t.id} className={styles.tableRow}>
                <td style={{ padding: '16px 20px' }}>{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '16px 20px' }}><span style={{ color: '#8a99a8', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>{t.category}</span></td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ 
                    color: t.type === 'RECEIVABLE' ? '#00e6b0' : '#ef4444',
                    fontWeight: 700, fontSize: 13
                  }}>
                    {t.type === 'RECEIVABLE' ? 'RECEITA' : 'DESPESA'}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 800 }}>R$ {t.amount.toLocaleString()}</td>
                <td style={{ padding: '16px 20px', color: '#8a99a8', fontSize: 13 }}>{t.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#1c222d', width: 500, padding: 32, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20 }}>Nova Transação</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Tipo de Transação</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, type: 'RECEIVABLE'})}
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: formData.type === 'RECEIVABLE' ? '1px solid #00e6b0' : '1px solid transparent', background: formData.type === 'RECEIVABLE' ? 'rgba(0, 230, 176, 0.1)' : '#23283a', color: formData.type === 'RECEIVABLE' ? '#00e6b0' : '#8a99a8', cursor: 'pointer', fontWeight: 700 }}
                  >Receita (+)</button>
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, type: 'PAYABLE'})}
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: formData.type === 'PAYABLE' ? '1px solid #ef4444' : '1px solid transparent', background: formData.type === 'PAYABLE' ? 'rgba(239, 68, 68, 0.1)' : '#23283a', color: formData.type === 'PAYABLE' ? '#ef4444' : '#8a99a8', cursor: 'pointer', fontWeight: 700 }}
                  >Despesa (-)</button>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Valor (R$)</label>
                  <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} placeholder="0,00" />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Categoria</label>
                  <input type="text" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} placeholder="Ex: Venda, Aluguel..." />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#8a99a8', marginBottom: 8, fontSize: 13 }}>Descrição</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#23283a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minHeight: 80 }} placeholder="Notas opcionais..." />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#00e6b0', color: '#181c24', fontWeight: 700, cursor: 'pointer' }}>Salvar Transação</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceList;
