import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from './services/api';
import { clearStoredSession, getStoredUser } from './utils/authSession';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const user = getStoredUser();

  useEffect(() => {
    // Validar sessão via cookie HttpOnly chamando /auth/me
    api.get('/auth/me')
      .then(() => setAuthState('authenticated'))
      .catch(() => {
        clearStoredSession();
        setAuthState('unauthenticated');
      });
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{
        background: 'var(--bg-main, #0f172a)',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary, #00e6b0)',
        fontWeight: 800
      }}>
        Verificando sessão...
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (permission && user) {
    if (user.role === 'admin') return <>{children}</>;
    
    const userPermissions = user.group?.permissions || [];
    if (!userPermissions.includes(permission)) {
      return <Navigate to="/" replace />; // Redirect to home if no permission
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
