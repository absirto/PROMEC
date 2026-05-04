
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Calendar, Download, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const ProfitabilityReport: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState({ start: '', end: '' });

  const fetchReport = async () => {
    if (!dates.start || !dates.end) {
      alert('Selecione o período para gerar o relatório.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(`/reports/admin/profitability?start=${dates.start}&end=${dates.end}`);
      setData(response);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className={styles.backBtn} onClick={() => navigate('/reports')}>
            <ArrowLeft size={18} />
          </button>
          <h2 className={styles.title}>Rentabilidade por Ordem de Serviço</h2>
        </div>
        
        <div className={styles.controls}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Calendar size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
              <input 
                type="date" 
                className={styles.searchInput} 
                style={{ paddingLeft: 40, width: 160 }}
                value={dates.start}
                onChange={e => setDates({...dates, start: e.target.value})}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Calendar size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
              <input 
                type="date" 
                className={styles.searchInput} 
                style={{ paddingLeft: 40, width: 160 }}
                value={dates.end}
                onChange={e => setDates({...dates, end: e.target.value})}
              />
            </div>
            <button className={styles.newBtn} onClick={fetchReport} disabled={loading}>
              <Search size={18} /> {loading ? 'Gerando...' : 'Filtrar'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead className={styles.tableHeader}>
            <tr>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>OS #</th>
              <th style={{ padding: '16px 20px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Subtotal</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Lucro Est.</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Impostos</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Total Final</th>
              <th style={{ padding: '16px 20px', textAlign: 'center' }}>Margem</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={styles.tableRow}>
                <td style={{ padding: '16px 20px' }}><strong>{row.id}</strong></td>
                <td style={{ padding: '16px 20px' }}>{row.customer}</td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  R$ {row.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                  R$ {row.estimatedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right', color: '#ef4444' }}>
                  R$ {row.taxes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800 }}>
                  R$ {row.finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                   <span style={{ 
                     background: 'rgba(16, 185, 129, 0.1)', 
                     color: '#10b981', 
                     padding: '4px 10px', 
                     borderRadius: 20, 
                     fontSize: 12, 
                     fontWeight: 700 
                   }}>
                     {row.margin}%
                   </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a99a8' }}>
                  Nenhum dado para exibir. Selecione um período e clique em Filtrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {data.length > 0 && (
        <div className={styles.footer} style={{ marginTop: 24, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 24, background: 'rgba(255,255,255,0.03)', padding: '20px 30px', borderRadius: 16 }}>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: 12, color: '#8a99a8', textTransform: 'uppercase' }}>Faturamento Total</div>
               <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                 R$ {data.reduce((s, r) => s + r.finalTotal, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
               </div>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: 12, color: '#8a99a8', textTransform: 'uppercase' }}>Lucro Estimado Total</div>
               <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>
                 R$ {data.reduce((s, r) => s + r.estimatedProfit, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitabilityReport;
