import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseList.module.css';
import { useToast } from '../../../components/ToastProvider';
import { buildReportQuery, downloadPdfReport, formatCurrency, formatDate, getDefaultDateRange } from './reportUtils';

const AccountsReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [dates, setDates] = useState(() => getDefaultDateRange());

  const loadReport = async (nextStatus = status, nextDates = dates) => {
    setLoading(true);
    try {
      const result = await api.get(`/reports/admin/accounts${buildReportQuery({ ...nextDates, status: nextStatus })}`);
      setData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar relatório de contas.', 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport('RECEIVABLE', getDefaultDateRange());
  }, []);

  const totalAmount = data.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <h2 className={styles.title}>Contas a Receber e a Pagar</h2>
            <div className={styles.stats}>Lançamentos financeiros por tipo e período.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <button className={styles.actionBtn} onClick={() => { setStatus('RECEIVABLE'); void loadReport('RECEIVABLE'); }} disabled={status === 'RECEIVABLE'}>A Receber</button>
          <button className={styles.actionBtn} onClick={() => { setStatus('PAYABLE'); void loadReport('PAYABLE'); }} disabled={status === 'PAYABLE'}>A Pagar</button>
          <input type="date" className={styles.searchInput} value={dates.start} onChange={(e) => setDates((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" className={styles.searchInput} value={dates.end} onChange={(e) => setDates((prev) => ({ ...prev, end: e.target.value }))} />
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
          <button className={styles.actionBtn} onClick={() => void downloadPdfReport('/reports/admin/accounts/pdf', 'relatorio_contas.pdf', { ...dates, status }).catch((error) => showToast(error || 'Erro ao baixar PDF.', 'error'))} title="Baixar PDF"><Download size={18} /></button>
        </div>
      </div>

      <div className={styles.footer} style={{ marginTop: 0 }}>
        <div className={styles.stats}>Tipo: {status === 'RECEIVABLE' ? 'A receber' : 'A pagar'}</div>
        <div className={styles.stats}>Total do período: {formatCurrency(totalAmount)}</div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Data</th>
            <th>Categoria</th>
            <th style={{ textAlign: 'right' }}>Valor</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id} className={styles.tableRow}>
              <td className={styles.tableCell}>{formatDate(row.date)}</td>
              <td className={styles.tableCell}>{row.category}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(row.amount)}</td>
              <td className={styles.tableCell}>{row.description || '-'}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}><td className={styles.tableCell} colSpan={4}>Nenhum lançamento encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AccountsReport;
