import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseList.module.css';
import { useToast } from '../../../components/ToastProvider';
import { buildReportQuery, downloadPdfReport, formatDate, getDefaultDateRange } from './reportUtils';

const StockMovementsReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState(() => getDefaultDateRange());

  const loadReport = async (currentDates = dates) => {
    setLoading(true);
    try {
      const result = await api.get(`/reports/operational/stock-movements${buildReportQuery(currentDates)}`);
      setData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar relatório de estoque.', 'error');
      setData([]);
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
            <h2 className={styles.title}>Movimentação de Estoque</h2>
            <div className={styles.stats}>Entradas e saídas consolidadas por período.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <input type="date" className={styles.searchInput} value={dates.start} onChange={(e) => setDates((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" className={styles.searchInput} value={dates.end} onChange={(e) => setDates((prev) => ({ ...prev, end: e.target.value }))} />
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
          <button className={styles.actionBtn} onClick={() => void downloadPdfReport('/reports/operational/stock-movements/pdf', 'relatorio_movimentacao_estoque.pdf', dates).catch((error) => showToast(error || 'Erro ao baixar PDF.', 'error'))} title="Baixar PDF"><Download size={18} /></button>
        </div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Data</th>
            <th>Material</th>
            <th style={{ textAlign: 'right' }}>Quantidade</th>
            <th>Tipo</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id} className={styles.tableRow}>
              <td className={styles.tableCell}>{formatDate(row.createdAt)}</td>
              <td className={styles.tableCell}>{row.material?.name || '-'}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{Number(row.quantity || 0).toFixed(2)}</td>
              <td className={styles.tableCell}>{row.type}</td>
              <td className={styles.tableCell}>{row.description || '-'}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}><td className={styles.tableCell} colSpan={5}>Nenhuma movimentação encontrada.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StockMovementsReport;
