import React from 'react';
import Skeleton from './Skeleton';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 5 }) => {
  return (
    <div style={{ width: '100%', marginTop: '32px' }}>
      {/* Rows Skeletons matching the border-less gap design */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} style={{ 
          display: 'flex', 
          gap: '24px', 
          padding: '16px 24px', 
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '12px',
          alignItems: 'center'
        }}>
          {/* Avatar Skeleton */}
          <Skeleton variant="rect" width="44px" height="44px" borderRadius="12px" />
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton variant="text" width="40%" height="16px" />
            <Skeleton variant="text" width="25%" height="12px" />
          </div>

          {Array.from({ length: columns - 1 }).map((_, colIndex) => (
            <div key={colIndex} style={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height="14px" />
            </div>
          ))}
          
          {/* Actions Skeleton */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Skeleton variant="rect" width="32px" height="32px" borderRadius="8px" />
            <Skeleton variant="rect" width="32px" height="32px" borderRadius="8px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonTable;
