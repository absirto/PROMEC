import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus, RefreshCcw, Landmark, Receipt, PieChart, TrendingUp, X, Save } from 'lucide-react';
import api from '../../../services/api';
import commonStyles from '../../../styles/common/BaseList.module.css';
import styles from './FinanceList.module.css';
import { useToast } from '../../../components/ToastProvider';
import StatsCard from '../../../components/StatsCard';
import EmptyState from '../../../components/EmptyState';
import SkeletonTable from '../../../components/SkeletonTable';

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
      setSummary(summaryData || { totalIncome: 0, totalExpense: 0, balance: 0 });
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
    <div className={commonStyles.listContainer}>
      <header className={commonStyles.header}>
        <div className={commonStyles.headerInfo}>
          <h2 className={commonStyles.title}>Fluxo de Caixa</h2>
          <p className={commonStyles.stats}>Gestão financeira e tesouraria ProMEC</p>
        </div>
        <div className={commonStyles.controls}>
          <button 
            className={`${commonStyles.refreshBtn} ${loading ? commonStyles.refreshBtnLoading : ''}`}
            onClick={fetchData}
            title="Sincronizar"
          >
            <RefreshCcw size={18} />
          </button>
          <button className={commonStyles.newBtn} onClick={() => setShowModal(true)}>
            <Plus size={18} />
            <span>Registrar Movimento</span>
          </button>
        </div>
      </header>

      {/* Mini Dashboard Financeiro */}
      <section className={styles.statsGrid}>
        <StatsCard 
          title="Receitas Brutas" 
          value={`R$ ${summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={ArrowUpRight} 
          color="var(--success)"
          trend={{ value: 'Realizado', isPositive: true }}
        />
        <StatsCard 
          title="Despesas Totais" 
          value={`R$ ${summary.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={ArrowDownLeft} 
          color="var(--danger)"
          trend={{ value: 'Saídas', isPositive: false }}
        />
        <StatsCard 
          title="Saldo em Caixa" 
          value={`R$ ${summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={Landmark} 
          color={summary.balance >= 0 ? 'var(--primary)' : 'var(--danger)'}
          trend={{ value: 'Patrimônio', isPositive: summary.balance >= 0 }}
        />
        <StatsCard 
          title="Margem Prevista" 
          value="24.5%" 
          icon={TrendingUp} 
          color="#a855f7"
          trend={{ value: '+2.1%', isPositive: true }}
        />
      </section>

      {loading ? (
        <SkeletonTable columns={5} rows={10} />
      ) : transactions.length > 0 ? (
        <div className="animate-fade-in">
          <table className={commonStyles.tableContainer}>
            <thead className={commonStyles.tableHeader}>
              <tr>
                <th>Data da Operação</th>
                <th>Categoria / Descrição</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Valor Consolidado</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className={commonStyles.tableRow}>
                  <td className={commonStyles.tableCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className={commonStyles.avatar} style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <Receipt size={18} color="var(--text-muted)" />
                      </div>
                      <span className={commonStyles.primaryText}>{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </td>
                  <td className={commonStyles.tableCell}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={commonStyles.primaryText}>{t.category}</span>
                      <span className={commonStyles.secondaryText}>{t.description || 'Sem notas adicionais'}</span>
                    </div>
                  </td>
                  <td className={commonStyles.tableCell}>
                    <span className={`${commonStyles.badge} ${t.type === 'RECEIVABLE' ? commonStyles.badgeActive : commonStyles.badgeInactive}`}>
                      {t.type === 'RECEIVABLE' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className={commonStyles.tableCell} style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: 15, 
                      fontWeight: 800, 
                      color: t.type === 'RECEIVABLE' ? 'var(--success)' : 'var(--danger)',
                      fontFamily: 'Outfit'
                    }}>
                      {t.type === 'RECEIVABLE' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState 
          title="Sem Movimentações"
          description="O fluxo de caixa está vazio para o período. Registre uma nova receita ou despesa para iniciar."
          actionLabel="Registrar Primeiro Movimento"
          onAction={() => setShowModal(true)}
        />
      )}

      {/* Modal Moderno Glassmorphism */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <header className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <div className={styles.modalIcon}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className={styles.modalTitle}>Novo Lançamento</h3>
                  <p className={styles.modalSubtitle}>Registro de entrada ou saída financeira</p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={20} /></button>
            </header>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.typeToggle}>
                <button 
                  type="button" 
                  className={`${styles.toggleBtn} ${formData.type === 'RECEIVABLE' ? styles.toggleActiveSuccess : ''}`}
                  onClick={() => setFormData({...formData, type: 'RECEIVABLE'})}
                >
                  <ArrowUpRight size={18} /> Receita
                </button>
                <button 
                  type="button" 
                  className={`${styles.toggleBtn} ${formData.type === 'PAYABLE' ? styles.toggleActiveDanger : ''}`}
                  onClick={() => setFormData({...formData, type: 'PAYABLE'})}
                >
                  <ArrowDownLeft size={18} /> Despesa
                </button>
              </div>

              <div className={styles.formGridMini}>
                <div className={styles.field}>
                  <label>Valor Nominal</label>
                  <div className={styles.inputBox}>
                    <span className={styles.currencyPrefix}>R$</span>
                    <input type="number" step="0.01" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0,00" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Categoria</label>
                  <input type="text" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ex: Serviços, Venda Peças..." />
                </div>
              </div>

              <div className={styles.field}>
                <label>Descrição / Nota Fiscal</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Informações complementares..." />
              </div>

              <button type="submit" className={styles.submitBtn}>
                <Save size={18} /> Efetivar Lançamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceList;
