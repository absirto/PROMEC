import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import { buildReportQuery, formatCurrency, formatDate, getDefaultDateRange } from './reportUtils';

const ProductionReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState(() => getDefaultDateRange());

  const loadReport = async (currentDates = dates) => {
    setLoading(true);
    try {
      const result = await api.get(`/reports/operational/production${buildReportQuery(currentDates)}`);
      setData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar relatório de produção.', 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport(getDefaultDateRange());
  }, []);

  const totalHours = data.reduce((sum, row) => sum + Number(row.hoursWorked || 0), 0);
  const totalRevenue = data.reduce((sum, row) => sum + Number(row.totalPrice || 0), 0);
  const uniqueTechnicians = new Set(data.map((row) => row.employeeId).filter(Boolean)).size;

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <h2 className={styles.title}>Produção por Técnico</h2>
            <div className={styles.stats}>Horas, serviços e valor produzido por técnico.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <input type="date" className={styles.searchInput} value={dates.start} onChange={(e) => setDates((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" className={styles.searchInput} value={dates.end} onChange={(e) => setDates((prev) => ({ ...prev, end: e.target.value }))} />
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
        </div>
      </div>

      <div className={styles.footer} style={{ marginTop: 0 }}>
        <div className={styles.stats}>Técnicos: {uniqueTechnicians}</div>
        <div className={styles.stats}>Horas totais: {totalHours.toFixed(1)}</div>
        <div className={styles.stats}>Valor produzido: {formatCurrency(totalRevenue)}</div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Técnico</th>
            <th>Área</th>
            <th>Serviço</th>
            <th>OS</th>
            <th style={{ textAlign: 'right' }}>Horas</th>
            <th style={{ textAlign: 'right' }}>Valor</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id} className={styles.tableRow}>
              <td className={styles.tableCell}>{row.employeeName}</td>
              <td className={styles.tableCell}>{row.workAreaName}</td>
              <td className={styles.tableCell}>{row.serviceName}</td>
              <td className={styles.tableCell}>{row.serviceOrderCode || row.serviceOrderId || '-'}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{Number(row.hoursWorked || 0).toFixed(1)}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(row.totalPrice)}</td>
              <td className={styles.tableCell}>{formatDate(row.openingDate)}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}><td className={styles.tableCell} colSpan={7}>Nenhum apontamento de produção encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductionReport;
