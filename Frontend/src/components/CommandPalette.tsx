import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Package, Wrench, Home, Settings, X, Command } from 'lucide-react';
import styles from './CommandPalette.module.css';

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const commands = [
    { id: 'home', title: 'Ir para Dashboard', icon: Home, action: () => navigate('/') },
    { id: 'people', title: 'Gerenciar Pessoas', icon: Users, action: () => navigate('/people') },
    { id: 'people-new', title: 'Cadastrar Nova Pessoa', icon: Users, action: () => navigate('/people/new'), subtext: 'Atalho rápido' },
    { id: 'materials', title: 'Estoque de Materiais', icon: Package, action: () => navigate('/materials') },
    { id: 'os', title: 'Ordens de Serviço', icon: Wrench, action: () => navigate('/service-orders') },
    { id: 'settings', title: 'Configurações do Sistema', icon: Settings, action: () => navigate('/settings') },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.searchBar}>
          <Search size={20} className={styles.searchIcon} />
          <input 
            autoFocus
            type="text" 
            placeholder="O que você deseja fazer? (Esc para fechar)" 
            className={styles.input}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.kbd}>ESC</div>
        </div>

        <div className={styles.results}>
          {filteredCommands.map(cmd => (
            <button 
              key={cmd.id} 
              className={styles.resultItem}
              onClick={() => {
                cmd.action();
                setIsOpen(false);
              }}
            >
              <div className={styles.itemIcon}>
                <cmd.icon size={18} />
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemTitle}>{cmd.title}</span>
                {cmd.subtext && <span className={styles.itemSubtext}>{cmd.subtext}</span>}
              </div>
            </button>
          ))}
          {filteredCommands.length === 0 && (
            <div className={styles.noResults}>
              Nenhum comando encontrado para "{search}"
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span>Pressione <span className={styles.kbd}>ENTER</span> para selecionar</span>
          <div className={styles.brand}>
            <Command size={12} /> ProMEC Intelligence
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
