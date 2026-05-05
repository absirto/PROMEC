import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import { buildReportQuery, downloadPdfReport, formatCurrency, formatDate, getDefaultDateRange } from './reportUtils';

const FinancialFlowReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState(() => getDefaultDateRange());

  const loadReport = async (currentDates = dates) => {
    setLoading(true);
    try {
      const result = await api.get(`/reports/admin/financial-flow${buildReportQuery(currentDates)}`);
      setData(result || null);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar relatório financeiro.', 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport(getDefaultDateRange());
  }, []);

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <h2 className={styles.title}>Fluxo de Caixa</h2>
            <div className={styles.stats}>Resumo de receitas, despesas e saldo.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <input type="date" className={styles.searchInput} value={dates.start} onChange={(e) => setDates((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" className={styles.searchInput} value={dates.end} onChange={(e) => setDates((prev) => ({ ...prev, end: e.target.value }))} />
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
          <button className={styles.actionBtn} onClick={() => void downloadPdfReport('/reports/admin/financial-flow/pdf', 'relatorio_fluxo_financeiro.pdf', dates).catch((error) => showToast(error || 'Erro ao baixar PDF.', 'error'))} title="Baixar PDF"><Download size={18} /></button>
        </div>
      </div>

      <div className={styles.footer} style={{ marginTop: 0 }}>
        <div className={styles.stats}>Período: {formatDate(dates.start)} até {formatDate(dates.end)}</div>
        <div className={styles.stats}>Receitas: {formatCurrency(data?.totalIncome)}</div>
        <div className={styles.stats}>Despesas: {formatCurrency(data?.totalExpense)}</div>
        <div className={styles.stats}>Saldo: {formatCurrency(data?.balance)}</div>
      </div>

      <table className={styles.tableContainer}>
        <tbody>
          <tr className={styles.tableRow}><td className={styles.tableCell}>Total de receitas</td><td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(data?.totalIncome)}</td></tr>
          <tr className={styles.tableRow}><td className={styles.tableCell}>Total de despesas</td><td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(data?.totalExpense)}</td></tr>
          <tr className={styles.tableRow}><td className={styles.tableCell}>Saldo do período</td><td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(data?.balance)}</td></tr>
        </tbody>
      </table>
    </div>
  );
};

export default FinancialFlowReport;
