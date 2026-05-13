import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={styles.pagination}>
      <div className={styles.info}>
        Mostrando <span className={styles.bold}>{startItem}-{endItem}</span> de <span className={styles.bold}>{totalItems}</span> registros
      </div>
      
      <div className={styles.controls}>
        <button 
          onClick={() => onPageChange(1)} 
          disabled={currentPage === 1}
          className={styles.button}
          title="Primeira página"
        >
          <ChevronsLeft size={18} />
        </button>
        
        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          className={styles.button}
        >
          <ChevronLeft size={18} />
        </button>

        <div className={styles.pages}>
          Página <span className={styles.bold}>{currentPage}</span> de <span className={styles.bold}>{totalPages}</span>
        </div>

        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages}
          className={styles.button}
        >
          <ChevronRight size={18} />
        </button>
        
        <button 
          onClick={() => onPageChange(totalPages)} 
          disabled={currentPage === totalPages}
          className={styles.button}
          title="Última página"
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
