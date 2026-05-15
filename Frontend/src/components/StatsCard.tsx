import React from 'react';
import { LucideIcon } from 'lucide-react';
import styles from './StatsCard.module.css';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'var(--primary)' 
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrapper} style={{ backgroundColor: `${color}15`, color }}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`${styles.trend} ${trend.isPositive ? styles.positive : styles.negative}`}>
            {trend.value}
          </div>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.value}>{value}</div>
        <div className={styles.title}>{title}</div>
      </div>
    </div>
  );
};

export default StatsCard;
