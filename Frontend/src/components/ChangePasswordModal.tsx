import React, { useState } from 'react';
import styles from './ChangePasswordModal.module.css';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (oldPassword: string, newPassword: string) => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose, onSubmit }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    onSubmit(oldPassword, newPassword);
  };

  return (
    <div className={styles['modal-backdrop']}>
      <div className={styles['modal-content']}>
        <h2>Alterar Senha</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Senha atual
            <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
          </label>
          <label>
            Nova senha
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </label>
          <label>
            Confirmar nova senha
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </label>
          {error && <div className={styles['modal-error']}>{error}</div>}
          <div className={styles['modal-actions']}>
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
