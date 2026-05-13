import React from 'react';
import Skeleton from './Skeleton';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 5 }) => {
  return (
    <div style={{ width: '100%', marginTop: '20px' }}>
      {/* Header Skeleton */}
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        padding: '15px 20px', 
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px 12px 0 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="20px" width={`${100/columns}%`} />
        ))}
      </div>

      {/* Rows Skeletons */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} style={{ 
          display: 'flex', 
          gap: '20px', 
          padding: '20px', 
          borderBottom: '1px solid rgba(255,255,255,0.03)'
        }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height="16px" width={`${100/columns}%`} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default SkeletonTable;
