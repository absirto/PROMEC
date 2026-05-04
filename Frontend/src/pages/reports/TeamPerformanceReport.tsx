import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const TeamPerformanceReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get('/reports/admin/team-performance');
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
      <h3>Desempenho de Equipes</h3>
      <table>
        <thead>
          <tr>
            <th>ID Funcionário</th>
            <th>Quantidade de Serviços</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.employeeId}>
              <td>{row.employeeId}</td>
              <td>{row._count?._all || row._count || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TeamPerformanceReport;
