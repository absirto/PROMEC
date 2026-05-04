import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import styles from './ReportsDashboard.module.css';

const OperationalReports: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <Outlet />
    </div>
  );
};

export default OperationalReports;
