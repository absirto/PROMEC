import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Tratamento automático para ChunkLoadError (novo deploy detectado)
    if (error?.name === 'ChunkLoadError' || String(error?.message).includes('Loading chunk')) {
      const isReloaded = sessionStorage.getItem('chunk_error_reloaded');
      if (!isReloaded) {
        sessionStorage.setItem('chunk_error_reloaded', 'true');
        window.location.reload();
        return;
      }
    }
    
    // Log para outros erros
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'var(--bg-main)',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ 
            background: 'var(--bg-surface)',
            padding: '48px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center',
            maxWidth: '500px',
            width: '90%',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: 'var(--danger)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '16px', fontSize: '24px' }}>Ocorreu um erro inesperado</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
              Detectamos uma inconsistência no sistema (possivelmente uma nova atualização sendo aplicada).
            </p>
            <button 
              onClick={() => {
                sessionStorage.removeItem('chunk_error_reloaded');
                window.location.reload();
              }}
              style={{ 
                background: 'var(--primary)',
                color: 'var(--primary-fg)',
                border: 'none',
                padding: '12px 32px',
                borderRadius: 'var(--radius-md)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
