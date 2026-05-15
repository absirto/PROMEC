import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Search } from 'lucide-react';
import api from '../../../services/api';
import styles from '../../../styles/common/BaseList.module.css';
import { useToast } from '../../../components/ToastProvider';
import { buildReportQuery, formatCurrency, getDefaultDateRange } from './reportUtils';

const ProfitabilityReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState(() => getDefaultDateRange());

  const fetchReport = async (currentDates = dates) => {
    if (!currentDates.start || !currentDates.end) {
      showToast('Selecione o período para gerar o relatório.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/reports/admin/profitability${buildReportQuery(currentDates)}`);
      setData(Array.isArray(response) ? response : []);
    } catch {
      showToast('Erro ao gerar relatório de rentabilidade.', 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport(getDefaultDateRange());
  }, []);

  const totalRevenue = data.reduce((sum, row) => sum + Number(row.finalTotal || 0), 0);
  const totalEstimatedProfit = data.reduce((sum, row) => sum + Number(row.estimatedProfit || 0), 0);
  const totalTaxes = data.reduce((sum, row) => sum + Number(row.taxes || 0), 0);
  const averageMargin = data.length
    ? data.reduce((sum, row) => sum + Number(row.margin || 0), 0) / data.length
    : 0;

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className={styles.title}>Rentabilidade por Ordem de Serviço</h2>
            <div className={styles.stats}>Margem, impostos e total final por OS concluída.</div>
          </div>
        </div>

        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Calendar size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="date"
              className={styles.searchInput}
              style={{ paddingLeft: 40, width: 170 }}
              value={dates.start}
              onChange={(e) => setDates({ ...dates, start: e.target.value })}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Calendar size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="date"
              className={styles.searchInput}
              style={{ paddingLeft: 40, width: 170 }}
              value={dates.end}
              onChange={(e) => setDates({ ...dates, end: e.target.value })}
            />
          </div>
          <button className={styles.newBtn} onClick={() => void fetchReport()} disabled={loading}>
            <Search size={18} /> {loading ? 'Gerando...' : 'Gerar'}
          </button>
        </div>
      </div>

      <div className={styles.footer} style={{ marginTop: 0 }}>
        <div className={styles.stats}>OS concluídas: {data.length}</div>
        <div className={styles.stats}>Faturamento total: {formatCurrency(totalRevenue)}</div>
        <div className={styles.stats}>Lucro estimado: {formatCurrency(totalEstimatedProfit)}</div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>OS #</th>
            <th>Cliente</th>
            <th style={{ textAlign: 'right' }}>Subtotal</th>
            <th style={{ textAlign: 'right' }}>Lucro Est.</th>
            <th style={{ textAlign: 'right' }}>Impostos</th>
            <th style={{ textAlign: 'right' }}>Total Final</th>
            <th style={{ textAlign: 'center' }}>Margem</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row.id}-${index}`} className={styles.tableRow}>
              <td className={styles.tableCell}><strong>{row.id}</strong></td>
              <td className={styles.tableCell}>{row.customer}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(row.subtotal)}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{formatCurrency(row.estimatedProfit)}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right', color: '#ef4444' }}>{formatCurrency(row.taxes)}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(row.finalTotal)}</td>
              <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                <span className={`${styles.badge} ${Number(row.margin || 0) >= 0 ? styles.badgeActive : styles.badgeInactive}`}>
                  {row.margin}%
                </span>
              </td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}>
              <td className={styles.tableCell} colSpan={7}>
                Nenhum dado para exibir. Selecione um período e clique em Gerar.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {data.length > 0 && (
        <div className={styles.footer}>
          <div className={styles.stats}>Subtotal consolidado: {formatCurrency(data.reduce((sum, row) => sum + Number(row.subtotal || 0), 0))}</div>
          <div className={styles.stats}>Impostos estimados: {formatCurrency(totalTaxes)}</div>
          <div className={styles.stats}>Margem média: {averageMargin.toFixed(1)}%</div>
        </div>
      )}
    </div>
  );
};

export default ProfitabilityReport;
