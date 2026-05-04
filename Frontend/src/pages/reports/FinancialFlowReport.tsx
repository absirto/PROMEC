import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const FinancialFlowReport: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get('/reports/admin/financial-flow');
        setData(result || null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) return <div>Carregando...</div>;
  if (!data) return <div>Nenhum dado encontrado.</div>;

  return (
    <div>
      <h3>Fluxo Financeiro</h3>
      <table>
        <tbody>
          <tr>
            <td>Total Receitas</td>
            <td>{data.totalIncome}</td>
          </tr>
          <tr>
            <td>Total Despesas</td>
            <td>{data.totalExpense}</td>
          </tr>
          <tr>
            <td>Saldo</td>
            <td>{data.balance}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default FinancialFlowReport;
