import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div>Navegando para {to}</div>,
}));

// Mock do api para simular chamadas /auth/me
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    defaults: { baseURL: '/v1' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

import ProtectedRoute from '../ProtectedRoute';
import api from '../services/api';

function renderProtectedRoute() {
  return render(
    <ProtectedRoute>
      <div>Área restrita</div>
    </ProtectedRoute>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redireciona para /login quando a sessão (cookie) é inválida', async () => {
    // Simula cookie inválido/expirado — /auth/me retorna 401
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ response: { status: 401 } });

    renderProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText('Navegando para /login')).toBeInTheDocument();
    });

    expect(localStorage.getItem('user')).toBeNull();
  });

  it('renderiza conteúdo protegido quando a sessão (cookie) é válida', async () => {
    // Simula cookie válido — /auth/me retorna 200
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, firstName: 'Test' });
    localStorage.setItem('user', JSON.stringify({ role: 'user', group: { permissions: [] } }));

    renderProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText('Área restrita')).toBeInTheDocument();
    });
  });
});