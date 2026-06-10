import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/auth/Login';

describe('LoginPage', () => {
  it('deve exibir campos de login', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/usuário|e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('deve permitir digitar usuário e senha', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    const userInput = screen.getByLabelText(/usuário|e-mail/i);
    const passInput = screen.getByLabelText(/senha/i);
    await userEvent.type(userInput, 'admin');
    await userEvent.type(passInput, 'admin123');
    expect(userInput).toHaveValue('admin');
    expect(passInput).toHaveValue('admin123');
  });
});
