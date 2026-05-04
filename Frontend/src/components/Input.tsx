import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, ...props }) => {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa', fontSize: '0.9rem' }}>{label}</label>
      <input
        {...props}
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: '4px',
          border: error ? '1.5px solid #dc3545' : '1px solid #444',
          background: 'var(--input-bg)',
          color: 'var(--text-primary)',
          fontSize: '1rem',
          outline: error ? '2px solid #dc3545' : 'none',
          boxShadow: error ? '0 0 0 2px #dc3545' : 'none',
          transition: 'border 0.2s, box-shadow 0.2s'
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.name}-error` : undefined}
      />
      {error && <span id={`${props.name}-error`} style={{ color: '#dc3545', fontSize: '0.85rem' }}>{error}</span>}
    </div>
  );
};

export default Input;
