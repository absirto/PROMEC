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
    // Aqui você pode logar o erro em um serviço externo
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMsg = 'Tente recarregar a página.';
      if (this.state.error) {
        if (typeof this.state.error === 'string') {
          errorMsg = this.state.error;
        } else if (this.state.error.message) {
          errorMsg = this.state.error.message;
        } else {
          try {
            errorMsg = JSON.stringify(this.state.error);
          } catch {
            errorMsg = String(this.state.error);
          }
        }
      }
      return (
        <div style={{ padding: 32, textAlign: 'center', color: '#dc3545' }}>
          <h2>Ocorreu um erro inesperado.</h2>
          <p>{errorMsg}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
