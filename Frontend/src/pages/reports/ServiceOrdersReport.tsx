import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const ServiceOrdersReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get('/reports/operational/service-orders');
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
      <h3>Ordens de Serviço por Status</h3>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.status}>
              <td>{row.status}</td>
              <td>{row._count?._all || row._count || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServiceOrdersReport;
