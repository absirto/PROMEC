import React, { useState, useRef, useEffect } from 'react';
import { EllipsisVertical, Eye, Pencil, Trash2 } from 'lucide-react';

interface ActionsDropdownProps {
    onEdit?: () => void;
    onDelete?: () => void;
    onView?: () => void;
    disabled?: boolean;
}

const ActionsDropdown: React.FC<ActionsDropdownProps> = ({ onEdit, onDelete, onView, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="actions-dropdown" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
                disabled={disabled}
                title="Ações"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label="Abrir menu de ações"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <EllipsisVertical size={20} />
            </button>
            
            {isOpen && (
                <div role="menu" aria-label="Ações" style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10,
                    minWidth: 140,
                    padding: '4px',
                    marginTop: '4px'
                }}>
                    {onView && (
                        <button 
                            onClick={onView} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                width: '100%', 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-main)', 
                                padding: '8px 12px', 
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Eye size={16} style={{ marginRight: 8 }} /> Visualizar
                        </button>
                    )}
                    {onEdit && (
                        <button 
                            onClick={onEdit} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                width: '100%', 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--text-main)', 
                                padding: '8px 12px', 
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Pencil size={16} style={{ marginRight: 8 }} /> Editar
                        </button>
                    )}
                    {onDelete && (
                        <button 
                            onClick={onDelete} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                width: '100%', 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--danger)', 
                                padding: '8px 12px', 
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Trash2 size={16} style={{ marginRight: 8 }} /> Excluir
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionsDropdown;
