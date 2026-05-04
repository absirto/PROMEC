import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const StockMovementsReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get('/reports/operational/stock-movements');
        setData(Array.isArray(result) ? result : []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <h3>Movimentação de Estoque</h3>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Material</th>
            <th>Quantidade</th>
            <th>Tipo</th>
            <th>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleDateString()}</td>
              <td>{row.material?.name}</td>
              <td>{row.quantity}</td>
              <td>{row.type}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockMovementsReport;
