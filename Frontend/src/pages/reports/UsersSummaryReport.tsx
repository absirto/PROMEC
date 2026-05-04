import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const UsersSummaryReport: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.get('/reports/admin/users-summary');
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
      <h3>Resumo de Usuários</h3>
      <table>
        <tbody>
          <tr>
            <td>Total de Usuários</td>
            <td>{data.total}</td>
          </tr>
          <tr>
            <td>Administradores</td>
            <td>{data.admins}</td>
          </tr>
          <tr>
            <td>Usuários Comuns</td>
            <td>{data.users}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default UsersSummaryReport;
