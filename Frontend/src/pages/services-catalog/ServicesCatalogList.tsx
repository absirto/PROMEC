import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tag, Search, Plus, Eye, Edit2, Trash2, Banknote } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const ServicesCatalogList: React.FC = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/services')
      .then((data: any) => setServices(data))
      .catch(() => setError('Erro ao carregar serviços.'))
      .finally(() => setLoading(false));
  }, []);

  const handleView = (id: number) => navigate(`/services-catalog/${id}`);
  const handleEdit = (id: number) => navigate(`/services-catalog/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Excluir este serviço do catálogo?')) {
      api.delete(`/services/${id}`)
        .then(() => setServices(services.filter(s => s.id !== id)))
        .catch(() => alert('Erro ao excluir serviço.'));
    }
  };

  const filtered = services.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Catálogo de Serviços</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar serviço..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/services-catalog/new" className={styles.newBtn}>
            <Plus size={20} /> Novo Serviço
          </Link>
        </div>
      </div>

      {loading && <div className={styles.stats}>Carregando catálogo...</div>}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input type="checkbox" />
                </th>
                <th>Serviço</th>
                <th>Preço Base</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input type="checkbox" />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <Tag size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 13, color: '#8a99a8' }}>{s.description || 'Sem descrição'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                      <Banknote size={16} color="#00e6b0" />
                      R$ {s.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${styles.badgeActive}`}>Ativo</span>
                  </td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleView(s.id)} className={`${styles.actionBtn} ${styles.viewBtn}`}><Eye size={16} /></button>
                      <button onClick={() => handleEdit(s.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(s.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.stats}>
              {filtered.length} serviços cadastrados
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ServicesCatalogList;
