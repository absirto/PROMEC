import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  width, 
  height, 
  borderRadius = '8px', 
  className = '',
  variant = 'rect',
  style = {}
}) => {
  const combinedStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: variant === 'circle' ? '50%' : borderRadius,
    ...style
  };

  return (
    <div 
      className={`skeleton-loader ${variant} ${className}`} 
      style={combinedStyle}
    />
  );
};

export default Skeleton;
