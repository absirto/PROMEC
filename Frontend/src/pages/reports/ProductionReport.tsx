import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const ProductionReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get('/reports/operational/production');
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
      <h3>Produção por Funcionário/Área</h3>
      <table>
        <thead>
          <tr>
            <th>Funcionário</th>
            <th>Área</th>
            <th>Serviço</th>
            <th>Horas Trabalhadas</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id}>
              <td>{row.employee?.person?.name || '-'}</td>
              <td>{row.employee?.workArea?.name || '-'}</td>
              <td>{row.serviceOrder?.description || '-'}</td>
              <td>{row.hoursWorked}</td>
              <td>{row.serviceOrder?.openingDate ? new Date(row.serviceOrder.openingDate).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductionReport;
