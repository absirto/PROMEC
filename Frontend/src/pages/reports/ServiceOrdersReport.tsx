import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import { buildReportQuery, downloadPdfReport, formatDate, getDefaultDateRange } from './reportUtils';

const ServiceOrdersReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState(() => getDefaultDateRange());

  const loadReport = async (currentDates = dates) => {
    setLoading(true);
    try {
      const result = await api.get(`/reports/operational/service-orders${buildReportQuery(currentDates)}`);
      setData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar relatório de ordens de serviço.', 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport(getDefaultDateRange());
  }, []);

  const totalOrders = data.reduce((sum, row) => sum + Number(row._count?._all || row._count || 0), 0);

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <h2 className={styles.title}>Relatório de Ordens de Serviço</h2>
            <div className={styles.stats}>Status consolidados por período.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <input type="date" className={styles.searchInput} value={dates.start} onChange={(e) => setDates((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" className={styles.searchInput} value={dates.end} onChange={(e) => setDates((prev) => ({ ...prev, end: e.target.value }))} />
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
          <button className={styles.actionBtn} onClick={() => void downloadPdfReport('/reports/operational/service-orders/pdf', 'relatorio_ordens_servico.pdf', dates).catch((error) => showToast(error || 'Erro ao baixar PDF.', 'error'))} title="Baixar PDF"><Download size={18} /></button>
        </div>
      </div>

      <div className={styles.footer} style={{ marginTop: 0 }}>
        <div className={styles.stats}>Período: {formatDate(dates.start)} até {formatDate(dates.end)}</div>
        <div className={styles.stats}>Total de OS: {totalOrders}</div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.status} className={styles.tableRow}>
              <td className={styles.tableCell}>{row.status}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{row._count?._all || row._count || 0}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}><td className={styles.tableCell} colSpan={2}>Nenhuma ordem de serviço encontrada no período informado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ServiceOrdersReport;
