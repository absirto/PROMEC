import React, { useState } from 'react';
import { X, Save, User, Building2 } from 'lucide-react';
import api from '../services/api';
import styles from './QuickModal.module.css';

interface QuickPersonModalProps {
  onClose: () => void;
  onSuccess: (person: any) => void;
}

const QuickPersonModal: React.FC<QuickPersonModalProps> = ({ onClose, onSuccess }) => {
  const [type, setType] = useState<'NATURAL' | 'LEGAL'>('NATURAL');
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        type,
        ...(type === 'NATURAL' 
          ? { naturalPerson: { name, cpf: document } }
          : { legalPerson: { corporateName: name, cnpj: document } })
      };
      const response = await api.post('/people', payload);
      onSuccess(response.data);
    } catch (error) {
      console.error('Erro ao criar pessoa rápida:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h3>Novo Cadastro Rápido</h3>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.typeSelector}>
            <button 
              type="button" 
              className={type === 'NATURAL' ? styles.active : ''} 
              onClick={() => setType('NATURAL')}
            >
              <User size={16} /> Pessoa Física
            </button>
            <button 
              type="button" 
              className={type === 'LEGAL' ? styles.active : ''} 
              onClick={() => setType('LEGAL')}
            >
              <Building2 size={16} /> Pessoa Jurídica
            </button>
          </div>

          <div className={styles.field}>
            <label>{type === 'NATURAL' ? 'Nome Completo' : 'Razão Social'}</label>
            <input 
              autoFocus 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={type === 'NATURAL' ? 'João Silva' : 'Empresa LTDA'}
            />
          </div>

          <div className={styles.field}>
            <label>{type === 'NATURAL' ? 'CPF' : 'CNPJ'}</label>
            <input 
              required 
              value={document} 
              onChange={e => setDocument(e.target.value)} 
              placeholder="Apenas números"
            />
          </div>

          <footer className={styles.footer}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
            <button type="submit" disabled={loading} className={styles.saveBtn}>
              <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default QuickPersonModal;
