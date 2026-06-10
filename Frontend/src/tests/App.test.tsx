import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

describe('App', () => {
  it('deve renderizar o título do sistema', async () => {
    render(<App />);
    await waitFor(() => {
      const elements = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent?.includes('ProMEC'));
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});
