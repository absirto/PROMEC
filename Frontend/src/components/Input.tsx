import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, ...props }) => {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>{label}</label>
      <input
        {...props}
        style={{
          width: '100%',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          border: error ? '1px solid var(--danger)' : '1px solid var(--border-subtle)',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          fontSize: '1rem',
          outline: 'none',
          boxShadow: error ? '0 0 0 4px rgba(239, 68, 68, 0.1)' : 'none',
          transition: 'all 0.2s'
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.name}-error` : undefined}
      />
      {error && <span id={`${props.name}-error`} style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>{error}</span>}
    </div>
  );
};

export default Input;
