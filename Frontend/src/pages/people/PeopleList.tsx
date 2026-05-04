import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, Eye, Edit2, Trash2, UserPlus } from 'lucide-react';
import api from '../../services/api';
import styles from '../../styles/common/BaseList.module.css';

const PeopleList: React.FC = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get('/people')
      .then((data: any) => setPeople(data))
      .catch(() => setError('Erro ao carregar pessoas.'))
      .finally(() => setLoading(false));
  }, []);

  const handleView = (id: number) => navigate(`/people/${id}`);
  const handleEdit = (id: number) => navigate(`/people/${id}/edit`);
  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
      api.delete(`/people/${id}`)
        .then(() => setPeople(people.filter(p => p.id !== id)))
        .catch(() => alert('Erro ao excluir pessoa.'));
    }
  };

  const filtered = people.filter(p => {
    const name = p.naturalPerson?.name || p.legalPerson?.corporateName || '';
    const doc = p.naturalPerson?.cpf || p.legalPerson?.cnpj || '';
    return name.toLowerCase().includes(search.toLowerCase()) || 
           doc.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Cadastros (Pessoas)</h2>
        <div className={styles.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#5c6b7a' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar por nome, CPF ou CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          <Link to="/people/new" className={styles.newBtn}>
            <UserPlus size={20} /> Novo Cadastro
          </Link>
        </div>
      </div>

      {loading && <div className={styles.stats}>Buscando registros...</div>}
      {error && <div className={styles.badge + ' ' + styles.badgeInactive}>{error}</div>}

      {!loading && !error && (
        <>
          <table className={styles.tableContainer}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input 
                    type="checkbox" 
                    onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])}
                    checked={selected.length === filtered.length && filtered.length > 0}
                  />
                </th>
                <th>Nome / Razão Social</th>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Insc. Estadual/RG</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={styles.tableRow}>
                  <td style={{ paddingLeft: 20 }}>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(p.id)}
                      onChange={() => setSelected(prev => prev.includes(p.id) ? prev.filter(s => s !== p.id) : [...prev, p.id])}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.mainInfoCell}>
                      <div className={styles.avatar}>
                        <Users size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{p.naturalPerson?.name || p.legalPerson?.corporateName || 'Sem Nome'}</div>
                        <div style={{ fontSize: 13, color: '#8a99a8' }}>{p.contacts?.[0]?.value || 'Sem contato'}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tableCell} style={{ fontWeight: 500 }}>{p.naturalPerson?.cpf || p.legalPerson?.cnpj || '-'}</td>
                  <td className={styles.tableCell}>
                    <span style={{ 
                      fontSize: 12, padding: '2px 8px', borderRadius: 4, 
                      background: p.type === 'J' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 230, 176, 0.1)',
                      color: p.type === 'J' ? '#3b82f6' : '#00e6b0'
                    }}>
                      {p.type === 'J' ? 'Jurídica' : 'Física'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>{p.naturalPerson?.rg || p.legalPerson?.stateRegistration || '-'}</td>
                  <td className={styles.tableCell} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => handleView(p.id)} className={`${styles.actionBtn} ${styles.viewBtn}`}><Eye size={16} /></button>
                      <button onClick={() => handleEdit(p.id)} className={`${styles.actionBtn} ${styles.editBtn}`}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.footer}>
            <div className={styles.batchActions}>
              <button 
                className={styles.batchBtn}
                disabled={selected.length === 0}
                onClick={() => alert(`Ações em lote para ${selected.length} itens.`)}
              >
                Excluir Selecionados ({selected.length})
              </button>
            </div>
            <div className={styles.stats}>
              {filtered.length} registros encontrados
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PeopleList;
