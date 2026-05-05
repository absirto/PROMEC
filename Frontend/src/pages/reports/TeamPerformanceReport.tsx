import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';
import { useToast } from '../../components/ToastProvider';
import { downloadPdfReport, formatCurrency } from './reportUtils';

const TeamPerformanceReport: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const result = await api.get('/reports/admin/team-performance');
      setData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      showToast(error || 'Erro ao gerar resumo de equipe.', 'error');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.actionBtn} onClick={() => navigate('/reports')} title="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <h2 className={styles.title}>Resumo de Equipe</h2>
            <div className={styles.stats}>Performance consolidada por colaborador.</div>
          </div>
        </div>
        <div className={styles.controls}>
          <button className={styles.newBtn} onClick={() => void loadReport()} disabled={loading}><RefreshCw size={18} /> {loading ? 'Gerando...' : 'Gerar'}</button>
          <button className={styles.actionBtn} onClick={() => void downloadPdfReport('/reports/admin/team-performance/pdf', 'relatorio_desempenho_equipes.pdf', {}).catch((error) => showToast(error || 'Erro ao baixar PDF.', 'error'))} title="Baixar PDF"><Download size={18} /></button>
        </div>
      </div>

      <table className={styles.tableContainer}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Colaborador</th>
            <th>Área</th>
            <th>Função</th>
            <th style={{ textAlign: 'right' }}>Serviços</th>
            <th style={{ textAlign: 'right' }}>Horas</th>
            <th style={{ textAlign: 'right' }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.employeeId} className={styles.tableRow}>
              <td className={styles.tableCell}>{row.employeeName}</td>
              <td className={styles.tableCell}>{row.workAreaName}</td>
              <td className={styles.tableCell}>{row.jobRoleName}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{row.servicesCount}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{Number(row.totalHours || 0).toFixed(1)}</td>
              <td className={styles.tableCell} style={{ textAlign: 'right' }}>{formatCurrency(row.totalRevenue)}</td>
            </tr>
          ))}
          {!loading && data.length === 0 && (
            <tr className={styles.tableRow}><td className={styles.tableCell} colSpan={6}>Nenhum apontamento de equipe encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TeamPerformanceReport;
