import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ClipboardCheck, Search, Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import SkeletonTable from '../../components/SkeletonTable';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const QualityControlsList: React.FC = () => {
  const navigate = useNavigate();
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/quality-controls')
      .then((data: any) => setControls(data))
      .catch(() => setError('Erro ao carregar controles.'))
      .finally(() => setLoading(false));
  }, []);

  const handleView = (id: number) => navigate(`/quality-controls/${id}`);
  const handleEdit = (id: number) => navigate(`/quality-controls/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Excluir este controle?')) {
      api.delete(`/quality-controls/${id}`)
        .then(() => setControls(controls.filter(c => c.id !== id)))
        .catch(() => alert('Erro ao excluir controle.'));
    }
  };

  const filtered = controls.filter(c => 
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusClass = (status: string) => {
    if (status === 'Aprovado') return styles.badgeActive;
    if (status === 'Reprovado') return styles.badgeInactive;
    return ''; // Pendente ou outros
  };

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Controle de Qualidade</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar inspeção..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/quality-controls/new" className={styles.newBtn}>
            <Plus size={20} /> Nova Inspeção
          </Link>
        </div>
      </div>

      {loading && <SkeletonTable columns={5} rows={10} />}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input type="checkbox" />
                </th>
                <th>Inspeção / Descrição</th>
                <th>Referência</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ctrl => (
                <tr key={ctrl.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input type="checkbox" />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <ClipboardCheck size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>ID #{ctrl.id}</div>
                        <div style={{ fontSize: 13, color: '#8a99a8' }}>{ctrl.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    {ctrl.serviceOrderId ? `OS #${ctrl.serviceOrderId}` : ctrl.materialId ? `Mat. ID #${ctrl.materialId}` : 'Geral'}
                  </td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${getStatusClass(ctrl.status)}`}>
                      {ctrl.status}
                    </span>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleView(ctrl.id)} className={`${styles.actionBtn} ${styles.viewBtn}`}><Eye size={16} /></button>
                      <button onClick={() => handleEdit(ctrl.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(ctrl.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.stats}>
              {filtered.length} registros de qualidade
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default QualityControlsList;
