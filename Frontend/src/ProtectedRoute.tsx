import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { clearStoredSession, getRemainingSessionTime, getValidStoredToken } from './utils/authSession';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const [token, setToken] = useState<string | null>(() => getValidStoredToken());
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    const syncToken = () => {
      setToken(getValidStoredToken());
    };

    syncToken();
    window.addEventListener('storage', syncToken);

    return () => {
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const remainingTime = getRemainingSessionTime();
    if (remainingTime === null) {
      setToken(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearStoredSession();
      setToken(null);
    }, remainingTime);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [token]);

  if (!token) {
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
