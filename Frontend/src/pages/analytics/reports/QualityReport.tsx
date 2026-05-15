import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseList.module.css';
import { useToast } from '../../../components/ToastProvider';
import { buildReportQuery, formatDate, getDefaultDateRange } from './reportUtils';

const QualityReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => ({ ...getDefaultDateRange(), status: '' }));

  const loadReport = async (currentFilters = filters) => {
    setLoading(true);
    try {
      const result = await api.get(`/reports/operational/quality${buildReportQuery(currentFilters)}`);
      setData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar relatório de qualidade.', 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport({ ...getDefaultDateRange(), status: '' });
  }, []);

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <h2 className={styles.title}>Controle de Qualidade</h2>
            <div className={styles.stats}>Inspeções, não conformidades e evidências por período.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <input type="date" className={styles.searchInput} value={filters.start} onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" className={styles.searchInput} value={filters.end} onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))} />
          <select className={styles.searchInput} value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">Todos os status</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Pendente">Pendente</option>
          </select>
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
        </div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Data</th>
            <th>OS</th>
            <th>Inspetor</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Medições</th>
            <th style={{ textAlign: 'right' }}>NCs abertas</th>
            <th style={{ textAlign: 'right' }}>Fotos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className={styles.tableRow}>
              <td className={styles.tableCell}>{formatDate(row.inspectionDate)}</td>
              <td className={styles.tableCell}>{row.serviceOrderCode || row.serviceOrderId || '-'}</td>
              <td className={styles.tableCell}>{row.inspectorName}</td>
              <td className={styles.tableCell}>{row.status}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{row.measurementsCount}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{row.openNonConformities}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{row.photosCount}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}><td className={styles.tableCell} colSpan={7}>Nenhum controle de qualidade encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default QualityReport;