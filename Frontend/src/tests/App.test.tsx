import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

describe('App', () => {
  it('deve renderizar o título do sistema', () => {
    render(<App />);
    expect(screen.getByText(/ProMEC/i)).toBeInTheDocument();
  });
});
