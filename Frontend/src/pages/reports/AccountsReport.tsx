import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const AccountsReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get(`/reports/admin/accounts?status=${status}`);
        setData(Array.isArray(result) ? result : []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [status]);

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <h3>Contas a Receber/Pagar</h3>
      <div>
        <button onClick={() => setStatus('RECEIVABLE')} disabled={status === 'RECEIVABLE'}>A Receber</button>
        <button onClick={() => setStatus('PAYABLE')} disabled={status === 'PAYABLE'}>A Pagar</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Categoria</th>
            <th>Valor</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id}>
              <td>{new Date(row.date).toLocaleDateString()}</td>
              <td>{row.category}</td>
              <td>{row.amount}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccountsReport;
