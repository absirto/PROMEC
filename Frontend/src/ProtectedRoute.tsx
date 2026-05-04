import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

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
