import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div>Navegando para {to}</div>,
}));

import ProtectedRoute from '../ProtectedRoute';

function createToken(expirationTimeMs: number) {
  const encode = (value: Record<string, unknown>) => btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: Math.ceil(expirationTimeMs / 1000) })}.signature`;
}

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
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('redireciona imediatamente quando o token já expirou', () => {
    localStorage.setItem('token', createToken(Date.now() - 60_000));
    localStorage.setItem('user', JSON.stringify({ role: 'user', group: { permissions: [] } }));

    renderProtectedRoute();

    expect(screen.getByText('Navegando para /login')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('derruba a sessão automaticamente quando o token vence com a tela aberta', async () => {
    localStorage.setItem('token', createToken(Date.now() + 1_500));
    localStorage.setItem('user', JSON.stringify({ role: 'user', group: { permissions: [] } }));

    renderProtectedRoute();

    expect(screen.getByText('Área restrita')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByText('Navegando para /login')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});