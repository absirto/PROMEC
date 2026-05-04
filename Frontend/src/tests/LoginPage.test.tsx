import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/auth/Login';

describe('LoginPage', () => {
  it('deve exibir campos de login', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/usuário|email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('deve permitir digitar usuário e senha', async () => {
    render(<LoginPage />);
    const userInput = screen.getByLabelText(/usuário|email/i);
    const passInput = screen.getByLabelText(/senha/i);
    await userEvent.type(userInput, 'admin');
    await userEvent.type(passInput, 'admin123');
    expect(userInput).toHaveValue('admin');
    expect(passInput).toHaveValue('admin123');
  });
});
