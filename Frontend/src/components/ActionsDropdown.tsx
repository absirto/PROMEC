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
                    color: '#e0e0e0',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <EllipsisVertical />
            </button>
            
            {isOpen && (
                <div role="menu" aria-label="Ações" style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    background: '#232323',
                    border: '1px solid #444',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 10,
                    minWidth: 120
                }}>
                    {onView && (
                        <button onClick={onView} style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', color: '#e0e0e0', padding: '8px 12px', cursor: 'pointer' }}>
                            <Eye style={{ marginRight: 8 }} /> Visualizar
                        </button>
                    )}
                    {onEdit && (
                        <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', color: '#e0e0e0', padding: '8px 12px', cursor: 'pointer' }}>
                            <Pencil style={{ marginRight: 8 }} /> Editar
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', color: '#e0e0e0', padding: '8px 12px', cursor: 'pointer' }}>
                            <Trash2 style={{ marginRight: 8 }} /> Excluir
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionsDropdown;
