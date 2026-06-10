import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Compatibilidade de Jest para Vitest
(globalThis as any).jest = vi as any;


// Mock global do useToast para evitar necessidade de ToastProvider nos testes unitários
vi.mock('./components/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
  ToastProvider: ({ children }: any) => children,
}));
