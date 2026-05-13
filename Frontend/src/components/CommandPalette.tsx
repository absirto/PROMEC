import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, Wrench, Users, Package, FileText, X, LayoutDashboard } from 'lucide-react';
import styles from './CommandPalette.module.css';

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard, category: 'Navegação' },
    { label: 'Ordens de Serviço', to: '/service-orders', icon: Wrench, category: 'Operacional' },
    { label: 'Nova Ordem de Serviço', to: '/service-orders/new', icon: Wrench, category: 'Ações Rápidas' },
    { label: 'Estoque', to: '/stock', icon: Package, category: 'Suprimentos' },
    { label: 'Materiais', to: '/materials', icon: Package, category: 'Suprimentos' },
    { label: 'Pessoas', to: '/people', icon: Users, category: 'Cadastros' },
    { label: 'Nova Pessoa', to: '/people/new', icon: Users, category: 'Ações Rápidas' },
    { label: 'Configurações', to: '/settings', icon: FileText, category: 'Sistema' },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (to: string) => {
    navigate(to);
    setIsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex].to);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.searchBar}>
          <Search size={20} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            placeholder="O que você está procurando? (Ctrl + K)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
            className={styles.input}
          />
          <div className={styles.shortcutHint}>ESC para fechar</div>
        </div>

        <div className={styles.results}>
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.to}
                className={`${styles.resultItem} ${idx === selectedIndex ? styles.resultItemActive : ''}`}
                onClick={() => handleSelect(cmd.to)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={styles.itemIcon}>
                  <cmd.icon size={18} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemLabel}>{cmd.label}</div>
                  <div className={styles.itemCategory}>{cmd.category}</div>
                </div>
                {idx === selectedIndex && (
                  <div className={styles.enterHint}>Pressione Enter</div>
                )}
              </div>
            ))
          ) : (
            <div className={styles.noResults}>
              Nenhum comando encontrado para "{search}"
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span>Use as setas para navegar</span>
          <Command size={14} />
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
